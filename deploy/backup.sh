#!/bin/bash
# Plain off-site copy of the dashboard data.
#
# rclone copies readable files to Google Drive. Nothing is encrypted, so any
# file opens straight from the Drive web page.
#
# The Nest credentials, the restic password and the OpenRouter key are NOT
# copied. They stay in ~/.config/homehq on the NAS.
set -euo pipefail

export PATH="${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin"
RCLONE="${HOME}/.local/bin/rclone"
DEST="gdrive:homehq-backup-plain"

BASE="${HOME}/homehq"
LOG="${BASE}/backup.log"
LOCK="${BASE}/.backup.lock"
STAMP="$(date +%F)"

# Keep the log small. One old copy is enough.
if [ -f "${LOG}" ] && [ "$(stat -c %s "${LOG}")" -gt 1048576 ]; then
    mv -f "${LOG}" "${LOG}.1"
fi

say() { echo "=== $(date -Is) $*" >> "${LOG}"; }

# One run at a time.
exec 9>"${LOCK}"
if ! flock -n 9; then
    say "skipped, another backup is running"
    exit 0
fi

say "start ${STAMP}"

# Data files, uploads and the album cache. Lock files are skipped.
"${RCLONE}" copy "${BASE}/data" "${DEST}/daily/${STAMP}/data" \
    --exclude "*.lock" \
    --exclude "*.tmp" >> "${LOG}" 2>&1

# The live scripts. The rest of the project is in git.
"${RCLONE}" copy "${BASE}" "${DEST}/daily/${STAMP}/scripts" \
    --max-depth 1 \
    --include "*.py" \
    --include "*.sh" \
    --include "nginx.conf" \
    --include "Dockerfile.api" >> "${LOG}" 2>&1

# Weekly and monthly keep points. A server-side copy, so no upload.
if [ "$(date +%u)" = "7" ]; then
    "${RCLONE}" copy "${DEST}/daily/${STAMP}" "${DEST}/weekly/$(date +%G-W%V)" >> "${LOG}" 2>&1
fi
if [ "$(date +%d)" = "01" ]; then
    "${RCLONE}" copy "${DEST}/daily/${STAMP}" "${DEST}/monthly/$(date +%Y-%m)" >> "${LOG}" 2>&1
fi

# Keep the newest N folders in one tier.
prune() {
    local tier="$1" keep="$2" name
    "${RCLONE}" lsf --dirs-only "${tier}" 2>/dev/null | sort | head -n "-${keep}" | while read -r name; do
        [ -n "${name}" ] || continue
        "${RCLONE}" purge --drive-use-trash=false "${tier}/${name}" >> "${LOG}" 2>&1
    done || true
}

prune "${DEST}/daily" 7
prune "${DEST}/weekly" 4
prune "${DEST}/monthly" 12

say "done ${STAMP}"
