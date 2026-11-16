#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

[[ ${EUID:-$(id -u)} -eq 0 ]] || { printf 'Run as root.\n' >&2; exit 1; }

ENV_FILE=${READBOX_ENV_FILE:-${VIBMAIL_ENV_FILE:-/etc/readbox/readbox.env}}
if [[ ! -r "$ENV_FILE" && -r "/etc/vibmail/vibmail.env" ]]; then
  ENV_FILE="/etc/vibmail/vibmail.env"
fi
[[ -r "$ENV_FILE" ]] || { printf 'Environment file is missing: %s\n' "$ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

BACKUP_ROOT=${BACKUP_ROOT:-${READBOX_BACKUP_ROOT:-/var/backups/readbox}}
if [[ ! -d "$BACKUP_ROOT" && -d "/var/backups/vibmail" ]]; then
  BACKUP_ROOT="/var/backups/vibmail"
fi
PG_DB_NAME=${PG_DB_NAME:-readbox}
MAIL_DOMAIN=${MAIL_DOMAIN:?MAIL_DOMAIN is missing from the environment file}
APP_HOSTNAME=${APP_HOSTNAME:?APP_HOSTNAME is missing from the environment file}
MAIL_HOSTNAME=${MAIL_HOSTNAME:?MAIL_HOSTNAME is missing from the environment file}
MAIL_STORAGE_ROOT=${MAIL_STORAGE_ROOT:-/var/vmail}
ATTACHMENT_STORAGE_ROOT=${ATTACHMENT_STORAGE_ROOT:-/var/lib/readbox/attachments}
MEDIA_ROOT=${MEDIA_ROOT:-/var/lib/readbox/media}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$BACKUP_ROOT/$STAMP"

[[ "$BACKUP_ROOT" == /* ]] || { printf 'BACKUP_ROOT must be absolute.\n' >&2; exit 1; }
case "$BACKUP_ROOT" in
  /|/var|/var/backups|/etc|/opt) printf 'Unsafe BACKUP_ROOT refused.\n' >&2; exit 1 ;;
esac
[[ "$PG_DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || { printf 'Unsafe PostgreSQL database identifier.\n' >&2; exit 1; }
[[ -d "$MAIL_STORAGE_ROOT" ]] || { printf 'Maildir root is missing.\n' >&2; exit 1; }
[[ -d "$ATTACHMENT_STORAGE_ROOT" ]] || { printf 'Attachment root is missing.\n' >&2; exit 1; }
[[ -d "$MEDIA_ROOT" ]] || { printf 'Media root is missing.\n' >&2; exit 1; }
for command_name in pg_dump gzip tar sha256sum systemctl python3; do
  command -v "$command_name" >/dev/null 2>&1 \
    || { printf 'Required command is missing: %s\n' "$command_name" >&2; exit 1; }
done

CONFIG_PATHS=()
if [[ -f "/etc/readbox/readbox.env" ]]; then
  CONFIG_PATHS+=(etc/readbox/readbox.env)
elif [[ -f "/etc/vibmail/vibmail.env" ]]; then
  CONFIG_PATHS+=(etc/vibmail/vibmail.env)
fi

for svc in readbox-web vibmail-web; do
  if [[ -f "/etc/systemd/system/${svc}.service" ]]; then
    CONFIG_PATHS+=("etc/systemd/system/${svc}.service")
    break
  fi
done

for svc in readbox-ingestion vibmail-ingestion; do
  if [[ -f "/etc/systemd/system/${svc}.service" ]]; then
    CONFIG_PATHS+=("etc/systemd/system/${svc}.service")
    break
  fi
done

for pf in etc/postfix/main.cf etc/postfix/master.cf etc/postfix/pgsql-virtual-domains.cf etc/postfix/pgsql-virtual-mailboxes.cf etc/postfix/pgsql-virtual-aliases.cf; do
  if [[ -f "/$pf" ]]; then
    CONFIG_PATHS+=("$pf")
  fi
done

if [[ -f /etc/nginx/sites-available/readbox-app.conf ]]; then
  CONFIG_PATHS+=(etc/nginx/sites-available/readbox-app.conf)
elif [[ -f /etc/nginx/sites-available/vibmail-app.conf ]]; then
  CONFIG_PATHS+=(etc/nginx/sites-available/vibmail-app.conf)
fi

if [[ -f /etc/dovecot/conf.d/99-readbox.conf ]]; then
  CONFIG_PATHS+=(etc/dovecot/conf.d/99-readbox.conf)
elif [[ -f /etc/dovecot/conf.d/99-vibmail.conf ]]; then
  CONFIG_PATHS+=(etc/dovecot/conf.d/99-vibmail.conf)
fi

install -d -m 0700 "$DEST"

SERVICES=(postfix dovecot)
for candidate in "${READBOX_INGESTION_SERVICE:-}" "readbox-ingestion" "vibmail-ingestion"; do
  unit="${candidate%.service}"
  if systemctl list-unit-files "${unit}.service" >/dev/null 2>&1; then
    SERVICES+=("$unit")
    break
  fi
done
for candidate in "${READBOX_WEB_SERVICE:-}" "readbox-web" "vibmail-web"; do
  unit="${candidate%.service}"
  if systemctl list-unit-files "${unit}.service" >/dev/null 2>&1; then
    SERVICES+=("$unit")
    break
  fi
done
ACTIVE_SERVICES=()
for service in "${SERVICES[@]}"; do
  if systemctl is-active --quiet "$service.service"; then
    ACTIVE_SERVICES+=("$service")
  fi
done
restart_services() {
  local index
  for ((index=${#ACTIVE_SERVICES[@]}-1; index>=0; index--)); do
    systemctl start "${ACTIVE_SERVICES[$index]}.service" || true
  done
}
cleanup_on_exit() {
  local status=$?
  restart_services
  exit "$status"
}
trap cleanup_on_exit EXIT INT TERM

for service in "${SERVICES[@]}"; do
  systemctl stop "$service.service" 2>/dev/null || true
done

# Single PostgreSQL database dump (includes both public and mailserver schemas per AGENTS.md)
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --no-owner --no-privileges --clean --if-exists "$DATABASE_URL" \
    | gzip -9 > "$DEST/postgres-database.sql.gz"
else
  pg_dump --no-owner --no-privileges --clean --if-exists --dbname="$PG_DB_NAME" \
    | gzip -9 > "$DEST/postgres-database.sql.gz"
fi

tar --acls --xattrs --numeric-owner --one-file-system \
  -C "$(dirname "$MAIL_STORAGE_ROOT")" -czf "$DEST/maildir.tar.gz" "$(basename "$MAIL_STORAGE_ROOT")"
tar --acls --xattrs --numeric-owner --one-file-system \
  -C "$(dirname "$ATTACHMENT_STORAGE_ROOT")" -czf "$DEST/attachments.tar.gz" "$(basename "$ATTACHMENT_STORAGE_ROOT")"
tar --acls --xattrs --numeric-owner --one-file-system \
  -C "$(dirname "$MEDIA_ROOT")" -czf "$DEST/media.tar.gz" "$(basename "$MEDIA_ROOT")"
tar --acls --xattrs --numeric-owner -C / \
  -czf "$DEST/configuration.tar.gz" "${CONFIG_PATHS[@]}"

python3 - "$DEST/BACKUP_METADATA.json" "$STAMP" "$MAIL_DOMAIN" "$APP_HOSTNAME" \
  "$MAIL_HOSTNAME" "$PG_DB_NAME" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
data = {
    "format_version": 3,
    "database_engine": "postgresql",
    "schemas": ["public", "mailserver"],
    "created_at_utc": sys.argv[2],
    "mail_domain": sys.argv[3],
    "app_hostname": sys.argv[4],
    "mail_hostname": sys.argv[5],
    "postgresql_database": sys.argv[6],
}
path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
path.chmod(0o600)
PY

gzip -t "$DEST/postgres-database.sql.gz"
for archive in maildir.tar.gz attachments.tar.gz media.tar.gz configuration.tar.gz; do
  tar -tzf "$DEST/$archive" >/dev/null
done

sha256sum \
  "$DEST/postgres-database.sql.gz" \
  "$DEST/maildir.tar.gz" \
  "$DEST/attachments.tar.gz" \
  "$DEST/media.tar.gz" \
  "$DEST/configuration.tar.gz" \
  "$DEST/BACKUP_METADATA.json" \
  > "$DEST/SHA256SUMS"
(cd "$DEST" && sha256sum --check SHA256SUMS >/dev/null)

trap - EXIT INT TERM
restart_services
printf 'Backup created and verified at %s\n' "$DEST"
