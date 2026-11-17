#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

usage() {
  cat >&2 <<'EOF'
Usage:
  sudo /opt/readbox/app/scripts/updater/upgrade.sh \
    --archive /absolute/path/readbox-X.Y.Z-source.zip \
    --checksum /absolute/path/readbox-X.Y.Z-source.zip.sha256 \
    [--allow-migrations] \
    --confirm-upgrade
EOF
  exit 2
}

STATUS_FILE="${UPDATE_STATUS_FILE:-/run/readbox/update_status.json}"
report_progress() {
  local step="$1"
  local message="$2"
  local progress="$3"
  printf '{"step": "%s", "message": "%s", "progress": %d}\n' "$step" "$message" "$progress" > "$STATUS_FILE" 2>/dev/null || true
  chmod 0644 "$STATUS_FILE" 2>/dev/null || true
  chown vmail:vmail "$STATUS_FILE" 2>/dev/null || true
}

die() {
  printf 'UPGRADE_FINDING=%s\n' "$*" >&2
  printf '{"step": "error", "message": "%s", "progress": -1}\n' "$*" > "$STATUS_FILE" 2>/dev/null || true
  chmod 0644 "$STATUS_FILE" 2>/dev/null || true
  chown vmail:vmail "$STATUS_FILE" 2>/dev/null || true
  exit 1
}

[[ ${EUID:-$(id -u)} -eq 0 ]] || die "run as root"

ARCHIVE=""
CHECKSUM=""
ALLOW_MIGRATIONS=0
CONFIRM=0
while (($#)); do
  case "$1" in
    --archive) ARCHIVE=${2:?}; shift 2 ;;
    --checksum) CHECKSUM=${2:?}; shift 2 ;;
    --allow-migrations) ALLOW_MIGRATIONS=1; shift ;;
    --confirm-upgrade) CONFIRM=1; shift ;;
    -h|--help) usage ;;
    *) die "unknown option: $1" ;;
  esac
done
[[ -n "$ARCHIVE" && -n "$CHECKSUM" && $CONFIRM -eq 1 ]] || usage

ARCHIVE=$(realpath -e -- "$ARCHIVE")
CHECKSUM=$(realpath -e -- "$CHECKSUM")
[[ -f "$ARCHIVE" && ! -L "$ARCHIVE" ]] || die "target archive must be a regular non-symlink file"
[[ -f "$CHECKSUM" && ! -L "$CHECKSUM" ]] || die "checksum must be a regular non-symlink file"

APP_ROOT=${APP_ROOT:-${READBOX_APP_ROOT:-/opt/readbox/app}}
if [[ ! -d "$APP_ROOT" && -d "/opt/vibmail/app" ]]; then
  APP_ROOT="/opt/vibmail/app"
fi

ENV_FILE=${READBOX_ENV_FILE:-${VIBMAIL_ENV_FILE:-/etc/readbox/readbox.env}}
if [[ ! -f "$ENV_FILE" && -f "/etc/vibmail/vibmail.env" ]]; then
  ENV_FILE="/etc/vibmail/vibmail.env"
fi

LOCK_FILE=${UPGRADE_LOCK_FILE:-/run/readbox/readbox-upgrade.lock}
if [[ ! -d "$(dirname -- "$LOCK_FILE")" && -d "/run/vibmail" ]]; then
  LOCK_FILE="/run/vibmail/vibmail-upgrade.lock"
fi

UPGRADE_ROOT=${UPGRADE_ROOT:-${READBOX_BACKUP_ROOT:-/var/backups/readbox/upgrades}}
if [[ ! -d "$UPGRADE_ROOT" && -d "/var/backups/vibmail/upgrades" ]]; then
  UPGRADE_ROOT="/var/backups/vibmail/upgrades"
fi

STAGING_ROOT=${STAGING_ROOT:-/opt/readbox-upgrades}
if [[ ! -d "$STAGING_ROOT" && -d "/opt/vibmail-upgrades" ]]; then
  STAGING_ROOT="/opt/vibmail-upgrades"
fi
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
VERIFY_HELPER="$SCRIPT_DIR/verify_upgrade_archive.py"

for command_name in node npm python3 flock rsync tar sha256sum systemctl curl nginx postfix realpath readlink doveconf pg_dump; do
  command -v "$command_name" >/dev/null 2>&1 || die "required command is missing: $command_name"
done
[[ -f "$VERIFY_HELPER" ]] || die "upgrade archive verifier is missing: $VERIFY_HELPER"
[[ -f "$APP_ROOT/package.json" && -f "$APP_ROOT/prisma/schema.prisma" ]] || die "current ReadBox application is incomplete"
[[ -r "$ENV_FILE" ]] || die "environment file is missing: $ENV_FILE"

install -d -o root -g root -m 0755 "$(dirname -- "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || die "another ReadBox upgrade is already running"

report_progress "verify" "Verifying release archive and SHA-256 checksum" 10
install -d -o root -g root -m 0700 "$UPGRADE_ROOT" "$STAGING_ROOT"
STAGE_PARENT=$(mktemp -d "$STAGING_ROOT/stage.XXXXXX")
# The upgrade is host/systemd-only. A failure after any mutation attempts to
# restore both the old application tree and original database/Maildir snapshot.
# A rollback failure is reported as CRITICAL and never claimed as success.
MUTATION_STARTED=0
DATA_BACKUP_PATH=""
upgrade_cleanup() {
  local status=$?
  trap - EXIT
  if (( status != 0 && MUTATION_STARTED == 1 )) && [[ -n "$DATA_BACKUP_PATH" ]]; then
    printf '[readbox-upgrade] Upgrade failed; attempting local rollback. SMTP may be interrupted.\n' >&2
    report_progress "rollback" "Restoring pre-upgrade application and data" 90
    local staging_rollback
    staging_rollback=$(mktemp -d "$STAGING_ROOT/rollback.XXXXXX")
    if tar -xzf "$APP_ARCHIVE" -C "$staging_rollback" &&
       rsync -a --delete "$staging_rollback/" "$APP_ROOT/" &&
       "$APP_ROOT/scripts/ops/restore.sh" --backup "$DATA_BACKUP_PATH" --confirm-restore; then
      if [[ ${#WEB_SERVICES[@]} -gt 0 || ${#INGESTION_SERVICES[@]} -gt 0 ]]; then
        systemctl start "${WEB_SERVICES[@]}" "${INGESTION_SERVICES[@]}" || true
      fi
      printf '[readbox-upgrade] Application and local data rollback completed. Investigate original upgrade error.\n' >&2
      report_progress "error" "Upgrade failed; local rollback completed" -1
    else
      printf 'READBOX_UPGRADE_CRITICAL=ROLLBACK_FAILED\n' >&2
      report_progress "error" "Upgrade failed; rollback also failed; manual intervention required" -1
    fi
    rm -rf -- "$staging_rollback"
  fi
  rm -rf -- "$STAGE_PARENT"
  exit "$status"
}
trap upgrade_cleanup EXIT

VERIFY_OUTPUT=$(
  python3 "$VERIFY_HELPER" \
    --archive "$ARCHIVE" \
    --checksum "$CHECKSUM" \
    --current-app "$APP_ROOT" \
    --extract-to "$STAGE_PARENT"
) || die "target release archive verification failed"

CURRENT_VERSION=$(printf '%s\n' "$VERIFY_OUTPUT" | sed -n 's/^CURRENT_VERSION=//p')
TARGET_VERSION=$(printf '%s\n' "$VERIFY_OUTPUT" | sed -n 's/^TARGET_VERSION=//p')
TARGET_ROOT=$(printf '%s\n' "$VERIFY_OUTPUT" | sed -n 's/^TARGET_ROOT=//p')
NEW_MIGRATIONS=$(printf '%s\n' "$VERIFY_OUTPUT" | sed -n 's/^NEW_MIGRATIONS=//p')

if (( NEW_MIGRATIONS > 0 && ALLOW_MIGRATIONS == 0 )); then
  die "target contains $NEW_MIGRATIONS new Prisma migration(s); rerun only after review with --allow-migrations"
fi

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
ROLLBACK_ROOT="$UPGRADE_ROOT/${STAMP}-from-${CURRENT_VERSION}-to-${TARGET_VERSION}"
APP_ARCHIVE="$ROLLBACK_ROOT/application.tar.gz"
DATA_ROOT="$ROLLBACK_ROOT/data"

report_progress "backup" "Creating pre-upgrade application and PostgreSQL backup" 25
install -d -o root -g root -m 0700 "$ROLLBACK_ROOT" "$DATA_ROOT"
tar --one-file-system -C "$APP_ROOT" -czf "$APP_ARCHIVE" .
BACKUP_ROOT="$DATA_ROOT" "$APP_ROOT/scripts/ops/backup.sh"
mapfile -t rollback_snapshots < <(find "$DATA_ROOT" -mindepth 1 -maxdepth 1 -type d -print)
[[ ${#rollback_snapshots[@]} -eq 1 ]] || die "pre-upgrade rollback data snapshot unavailable"
DATA_BACKUP_PATH="${rollback_snapshots[0]}"

report_progress "mutate" "Stopping web/ingestion; Postfix/Dovecot were briefly paused during pre-upgrade consistent snapshot" 45
MUTATION_STARTED=1
WEB_SERVICES=()
for candidate in "${READBOX_WEB_SERVICE:-}" "readbox-web.service" "vibmail-web.service"; do
  if [[ -n "$candidate" ]] && systemctl list-unit-files "$candidate" >/dev/null 2>&1; then
    WEB_SERVICES+=("$candidate")
    break
  fi
done
INGESTION_SERVICES=()
for candidate in "${READBOX_INGESTION_SERVICE:-}" "readbox-ingestion.service" "vibmail-ingestion.service"; do
  if [[ -n "$candidate" ]] && systemctl list-unit-files "$candidate" >/dev/null 2>&1; then
    INGESTION_SERVICES+=("$candidate")
    break
  fi
done

if [[ ${#INGESTION_SERVICES[@]} -gt 0 || ${#WEB_SERVICES[@]} -gt 0 ]]; then
  systemctl stop "${INGESTION_SERVICES[@]}" "${WEB_SERVICES[@]}" 2>/dev/null || true
else
  systemctl stop vibmail-ingestion.service vibmail-web.service 2>/dev/null || true
fi
systemctl is-active --quiet postfix.service || die "Postfix stopped unexpectedly"
systemctl is-active --quiet dovecot.service || die "Dovecot stopped unexpectedly"

report_progress "mutate" "Deploying verified application files" 60
rsync -a --delete-delay \
  --exclude='.env*' --exclude='node_modules' --exclude='.next' --exclude='.runtime' \
  "$TARGET_ROOT/" "$APP_ROOT/"
chown -R root:vmail "$APP_ROOT"

report_progress "migrate" "Installing dependencies, applying Prisma migrations, and building production bundle" 75
cd "$APP_ROOT"
npm ci --no-audit --no-fund
npx prisma migrate deploy
npm run build
npm prune --omit=dev --no-audit --no-fund

report_progress "restart" "Restarting ReadBox services and verifying health readiness" 90
systemctl daemon-reload
if [[ ${#WEB_SERVICES[@]} -gt 0 || ${#INGESTION_SERVICES[@]} -gt 0 ]]; then
  systemctl start "${WEB_SERVICES[@]}" "${INGESTION_SERVICES[@]}"
else
  systemctl start vibmail-web.service vibmail-ingestion.service
fi
curl --fail --silent --show-error --max-time 20 "http://127.0.0.1:3000/health/ready" >/dev/null

MUTATION_STARTED=0
report_progress "complete" "Upgrade successfully completed" 100
printf 'READBOX_UPGRADE=PASS\n'
