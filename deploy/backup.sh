#!/bin/bash
# Encrypted off-site backup of the private dashboard data.
#
# restic writes to Google Drive through rclone. Both live in ~/.local/bin, so
# this needs no sudo and no package install.
#
# The repository password is in ~/.config/homehq/restic-password. Keep a copy
# outside the NAS. Without it the backup cannot be opened.
set -euo pipefail

export PATH="${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin"
export RESTIC_REPOSITORY="rclone:gdrive:homehq-backup"
export RESTIC_PASSWORD_FILE="${HOME}/.config/homehq/restic-password"
export RESTIC_CACHE_DIR="${HOME}/.cache/restic"

BASE="${HOME}/homehq"
LOG="${BASE}/backup.log"
LOCK="${BASE}/.backup.lock"

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

if [ ! -f "${RESTIC_PASSWORD_FILE}" ]; then
    say "error: ${RESTIC_PASSWORD_FILE} is missing"
    exit 1
fi

say "start"

# The unique data: shopping list, recipes, uploaded photos, the live scripts
# and the Nest credentials. The LLM model and the releases rebuild themselves.
restic backup \
    --tag homehq \
    --exclude ".nest.lock" \
    --exclude ".photos.lock" \
    --exclude "restic-password" \
    --exclude "*.tmp" \
    "${BASE}/data" \
    "${HOME}/.config/homehq" \
    "${BASE}"/*.py \
    "${BASE}"/*.sh \
    "${BASE}/nginx.conf" \
    "${BASE}/Dockerfile.api" >> "${LOG}" 2>&1

# 7 daily, 4 weekly and 12 monthly snapshots.
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune >> "${LOG}" 2>&1

# Read back a sample of the packs so damage shows up early.
restic check --read-data-subset=10% >> "${LOG}" 2>&1

say "done"
