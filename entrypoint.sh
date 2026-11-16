#!/bin/sh
set -eu

# Ensure persistent storage directories are present when mounted
for dir in \
  "${MAIL_STORAGE_ROOT:-/var/vmail}" \
  "${ATTACHMENT_STORAGE_ROOT:-/var/lib/readbox/attachments}" \
  "${MEDIA_ROOT:-/var/lib/readbox/media}" \
  "${MAILBOX_PROVISION_LOCK_ROOT:-/var/lock/readbox-provision}" \
  "${OPENDKIM_KEYS_ROOT:-/etc/opendkim/keys}" \
  "${UPDATE_RUNTIME_DIR:-/run/vibmail}"
do
  if [ -n "$dir" ] && [ ! -d "$dir" ]; then
    mkdir -p "$dir" 2>/dev/null || true
  fi
done

# Run idempotent Prisma migrations on container boot (never drops or resets data)
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] Applying idempotent Prisma migrations..."
  max_attempts=10
  attempt=1
  until node ./node_modules/prisma/build/index.js migrate deploy; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "[entrypoint] ERROR: Prisma migrate deploy failed after ${max_attempts} attempts." >&2
      exit 1
    fi
    echo "[entrypoint] Database not ready yet (attempt ${attempt}/${max_attempts}); retrying in 3s..."
    attempt=$((attempt + 1))
    sleep 3
  done
  echo "[entrypoint] Database migrations are up to date."
else
  echo "[entrypoint] WARNING: DATABASE_URL is not set; skipping database migrations." >&2
fi

echo "[entrypoint] Starting ReadBox server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
exec "$@"
