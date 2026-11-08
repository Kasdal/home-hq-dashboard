#!/bin/bash
# One-time setup on the NAS. No sudo is needed when the user can use docker
# and crontab. Safe to run again after changes to the deploy files.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BASE="${HOME}/homehq"
PORT="${PORT:-8088}"
CONTAINER="homehq-web"
API="homehq-api"
LLM="homehq-llm"
NETWORK="homehq"
REPO_URL="https://github.com/Kasdal/home-hq-dashboard.git"

echo "Base directory: ${BASE}"

mkdir -p "${BASE}/releases/bootstrap" "${BASE}/data/photos" "${BASE}/data/photo-cache"
mkdir -p "${BASE}/data/recipes/files" "${BASE}/data/recipes/thumbs" "${BASE}/.build"
mkdir -p "${BASE}/llm"

install -m 644 "${HERE}/nginx.conf" "${BASE}/nginx.conf"
install -m 755 "${HERE}/pull.sh" "${BASE}/pull.sh"
install -m 755 "${HERE}/photos.py" "${BASE}/photos.py"
install -m 755 "${HERE}/google_album.py" "${BASE}/google_album.py"
install -m 755 "${HERE}/nest.py" "${BASE}/nest.py"
install -m 755 "${HERE}/api.py" "${BASE}/api.py"
install -m 755 "${HERE}/backup.sh" "${BASE}/backup.sh"
install -m 644 "${HERE}/Dockerfile.api" "${BASE}/Dockerfile.api"

# Remove the retired calendar job and script.
if crontab -l 2>/dev/null | grep -F "fetch-calendar.py" >/dev/null; then
    { crontab -l 2>/dev/null | grep -v -F "fetch-calendar.py" || true; } | crontab - || true
    echo "Removed the old calendar cron job."
fi
rm -f "${BASE}/fetch-calendar.py"

if [ ! -f "${BASE}/data/shopping.json" ]; then
    install -m 644 "${HERE}/sample-shopping.json" "${BASE}/data/shopping.json"
    echo "Installed the sample shopping list."
fi

# photos.json is the album config now. Move an old generated list out of the way.
if [ -f "${BASE}/data/photos.json" ] && ! grep -q '"albumUrl"' "${BASE}/data/photos.json"; then
    mv "${BASE}/data/photos.json" "${BASE}/data/photos.json.legacy"
    echo "Moved the old photo list to photos.json.legacy."
fi
if [ ! -f "${BASE}/data/photos.json" ]; then
    cat > "${BASE}/data/photos.json" <<'JSON'
{
  "albumUrl": "",
  "refreshMinutes": 60,
  "intervalSeconds": 20
}
JSON
    chmod 644 "${BASE}/data/photos.json"
    echo "Wrote the photos.json template. Add an albumUrl."
fi

if [ ! -f "${BASE}/releases/bootstrap/index.html" ]; then
    cat > "${BASE}/releases/bootstrap/index.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Home HQ</title>
    <style>
      body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
             background: #f2eee6; color: #7c7568; font-family: system-ui, sans-serif; text-align: center; }
      strong { display: block; color: #111; font-size: 28px; margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <div>
      <strong>Home HQ is starting</strong>
      The first published build is not on this NAS yet.
    </div>
  </body>
</html>
HTML
fi

if [ ! -L "${BASE}/current" ] || [ ! -e "${BASE}/current" ]; then
    ln -sfn "releases/bootstrap" "${BASE}/current"
fi

# Pull the built site once, if the gh-pages branch exists.
if [ ! -d "${BASE}/repo/.git" ]; then
    if git ls-remote --exit-code --heads "${REPO_URL}" gh-pages >/dev/null 2>&1; then
        git clone --branch gh-pages --depth 1 "${REPO_URL}" "${BASE}/repo"
    else
        echo "gh-pages branch is missing. Push to main first, then run this again."
    fi
fi

docker network inspect "${NETWORK}" >/dev/null 2>&1 || docker network create "${NETWORK}"

# API image. Tesseract and Poppler read recipe text. Pillow makes thumbnails.
# The code is mounted at runtime, so a rebuild is only needed for tool changes.
echo "Building the API image (Tesseract, Poppler, Pillow)..."
docker build -t homehq-api:local -f "${BASE}/Dockerfile.api" "${BASE}/.build"

# Data API. Runs as the owner of the data folder and has no open port.
docker rm -f "${API}" >/dev/null 2>&1 || true
docker run -d \
    --name "${API}" \
    --restart unless-stopped \
    --network "${NETWORK}" \
    --user "$(id -u):$(id -g)" \
    -e DATA_DIR=/data \
    -v "${BASE}/api.py:/api/api.py:ro" \
    -v "${BASE}/data:/data" \
    homehq-api:local python3 /api/api.py

# Local LLM for manual recipe parsing. No published port. The model unloads
# after two idle minutes, so RAM is free between parses.
docker rm -f "${LLM}" >/dev/null 2>&1 || true
docker run -d \
    --name "${LLM}" \
    --restart unless-stopped \
    --network "${NETWORK}" \
    -v "${BASE}/llm:/root/.ollama" \
    ollama/ollama

for _ in $(seq 1 30); do
    if docker exec "${LLM}" ollama list >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
echo "Pulling the recipe model (about 1 GB, first run only)..."
docker exec "${LLM}" ollama pull qwen2.5:1.5b

# Start or replace the web container.
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
docker run -d \
    --name "${CONTAINER}" \
    --restart unless-stopped \
    --network "${NETWORK}" \
    -p "${PORT}:80" \
    -v "${BASE}:/site:ro" \
    -v "${BASE}/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "${BASE}/data:/sitedata:ro" \
    nginx:alpine

# Install the timers if they are not present.
add_cron() {
    local line="$1"
    local needle="$2"
    if ! crontab -l 2>/dev/null | grep -F "${needle}" >/dev/null; then
        { crontab -l 2>/dev/null || true; echo "${line}"; } | crontab -
        echo "Cron entry added: ${needle}"
    fi
}

# The backup needs the rclone login first. See the Backup section of
# deploy/README.md.
if [ -f "${HOME}/.config/rclone/rclone.conf" ]; then
    add_cron "30 3 * * * ${BASE}/backup.sh >> ${BASE}/backup.log 2>&1" "${BASE}/backup.sh"
else
    echo "Backup not scheduled: set up the rclone login first."
fi

add_cron "*/5 * * * * ${BASE}/pull.sh >> ${BASE}/pull.log 2>&1" "${BASE}/pull.sh"
add_cron "*/10 * * * * python3 ${BASE}/photos.py >> ${BASE}/photos.log 2>&1" "${BASE}/photos.py"
add_cron "*/5 * * * * python3 ${BASE}/nest.py >> ${BASE}/nest.log 2>&1" "${BASE}/nest.py"

python3 "${BASE}/photos.py" || true
if [ -f "${HOME}/.config/homehq/nest-credentials.json" ]; then
    python3 "${BASE}/nest.py" || true
fi

if [ -d "${BASE}/repo/.git" ]; then
    "${BASE}/pull.sh"
fi

sleep 2
docker ps --filter "name=${CONTAINER}"
docker ps --filter "name=${API}"
docker ps --filter "name=${LLM}"
curl -sS -o /dev/null -w "HTTP %{http_code} on port ${PORT}\n" "http://127.0.0.1:${PORT}/"
curl -sS -o /dev/null -w "API %{http_code}\n" "http://127.0.0.1:${PORT}/api/health"
