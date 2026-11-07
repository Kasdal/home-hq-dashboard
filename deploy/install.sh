#!/bin/bash
# One-time setup on the NAS. No sudo is needed when the user can use docker
# and crontab. Safe to run again after changes to nginx.conf or pull.sh.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BASE="${HOME}/homehq"
PORT="${PORT:-8088}"
CONTAINER="homehq-web"
REPO_URL="https://github.com/Kasdal/home-hq-dashboard.git"

echo "Base directory: ${BASE}"

mkdir -p "${BASE}/releases/bootstrap" "${BASE}/data"

install -m 644 "${HERE}/nginx.conf" "${BASE}/nginx.conf"
install -m 755 "${HERE}/pull.sh" "${BASE}/pull.sh"

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
             background: #0d1218; color: #93a3b3; font-family: system-ui, sans-serif; text-align: center; }
      strong { display: block; color: #e8eef4; font-size: 28px; margin-bottom: 10px; }
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

# Start or replace the web container.
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
docker run -d \
    --name "${CONTAINER}" \
    --restart unless-stopped \
    -p "${PORT}:80" \
    -v "${BASE}:/site:ro" \
    -v "${BASE}/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "${BASE}/data:/sitedata:ro" \
    nginx:alpine

# Install the pull timer if it is not present.
CRON_LINE="*/5 * * * * ${BASE}/pull.sh >> ${BASE}/pull.log 2>&1"
if ! crontab -l 2>/dev/null | grep -F "${BASE}/pull.sh" >/dev/null; then
    { crontab -l 2>/dev/null || true; echo "${CRON_LINE}"; } | crontab -
    echo "Cron entry added."
fi

if [ -d "${BASE}/repo/.git" ]; then
    "${BASE}/pull.sh"
fi

sleep 1
docker ps --filter "name=${CONTAINER}"
curl -sS -o /dev/null -w "HTTP %{http_code} on port ${PORT}\n" "http://127.0.0.1:${PORT}/"
