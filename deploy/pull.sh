#!/bin/bash
# Pull the published site from GitHub and point the live symlink at it.
# Run from cron. Uses no secret: the repository is public.
set -euo pipefail

BASE="${HOME}/homehq"
REPO="${BASE}/repo"
KEEP=3

exec 9>"${BASE}/.pull.lock"
if ! flock -n 9; then
    echo "$(date -Is) another pull is running"
    exit 0
fi

cd "${REPO}"

git fetch --depth 1 origin gh-pages
git reset --hard origin/gh-pages

SHA=$(git rev-parse --short HEAD)
DEST="${BASE}/releases/${SHA}"

if [ ! -d "${DEST}" ]; then
    mkdir -p "${DEST}"
    git archive HEAD | tar -x -C "${DEST}"
fi

if [ "$(readlink "${BASE}/current")" != "${DEST}" ]; then
    ln -sfn "${DEST}" "${BASE}/current.new"
    mv -Tf "${BASE}/current.new" "${BASE}/current"
    echo "$(date -Is) switched to ${SHA}"
fi

# Keep the three newest releases plus the bootstrap page.
ls -1dt "${BASE}"/releases/* | grep -v '/bootstrap$' | tail -n +$((KEEP + 1)) | xargs -r rm -rf
