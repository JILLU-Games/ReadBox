#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

usage() {
  printf 'Usage: %s --backup /absolute/path --confirm-restore\n' "$0" >&2
  exit 2
}

validate_tar_archive() {
  /usr/bin/python3 - "$1" <<'PY'
import pathlib
import sys
import tarfile

archive = pathlib.Path(sys.argv[1])
with tarfile.open(archive, "r:gz") as handle:
    for member in handle.getmembers():
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts:
            raise SystemExit(f"Unsafe archive member: {member.name}")
        if member.issym() or member.islnk() or member.isdev() or member.isfifo():
            raise SystemExit(f"Unsupported archive member type: {member.name}")
PY
}

[[ ${EUID:-$(id -u)} -eq 0 ]] || { printf 'Run as root.\n' >&2; exit 1; }
[[ ${1:-} == --backup && -n ${2:-} && ${3:-} == --confirm-restore && $# -eq 3 ]] || usage
BACKUP=$(realpath -e -- "$2")
case "$BACKUP" in /|/etc|/opt|/var|/var/backups) printf 'Unsafe backup path refused.\n' >&2; exit 1;; esac

REQUIRED=(postgres-database.sql.gz maildir.tar.gz attachments.tar.gz media.tar.gz configuration.tar.gz SHA256SUMS)
for required in "${REQUIRED[@]}"; do
  [[ -f "$BACKUP/$required" ]] \
    || { printf 'Incomplete backup: %s is missing.\n' "$required" >&2; exit 1; }
done
(cd "$BACKUP" && sha256sum --check SHA256SUMS)
gzip -t "$BACKUP/postgres-database.sql.gz"
validate_tar_archive "$BACKUP/maildir.tar.gz"
validate_tar_archive "$BACKUP/attachments.tar.gz"
validate_tar_archive "$BACKUP/media.tar.gz"
validate_tar_archive "$BACKUP/configuration.tar.gz"

SERVICES=(postfix dovecot vibmail-ingestion vibmail-web)
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

ENV_FILE=${VIBMAIL_ENV_FILE:-/etc/vibmail/vibmail.env}
if [[ -r "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi
PG_DB_NAME=${PG_DB_NAME:-readbox}

if [[ -n "${DATABASE_URL:-}" ]]; then
  gzip -dc "$BACKUP/postgres-database.sql.gz" | psql --set ON_ERROR_STOP=1 "$DATABASE_URL"
else
  gzip -dc "$BACKUP/postgres-database.sql.gz" | psql --set ON_ERROR_STOP=1 --dbname="$PG_DB_NAME"
fi

MAIL_STORAGE_ROOT=${MAIL_STORAGE_ROOT:-/var/vmail}
ATTACHMENT_STORAGE_ROOT=${ATTACHMENT_STORAGE_ROOT:-/var/lib/readbox/attachments}
MEDIA_ROOT=${MEDIA_ROOT:-/var/lib/readbox/media}

tar --numeric-owner -C "$(dirname "$MAIL_STORAGE_ROOT")" -xzf "$BACKUP/maildir.tar.gz"
tar --numeric-owner -C "$(dirname "$ATTACHMENT_STORAGE_ROOT")" -xzf "$BACKUP/attachments.tar.gz"
tar --numeric-owner -C "$(dirname "$MEDIA_ROOT")" -xzf "$BACKUP/media.tar.gz"
tar --numeric-owner -C / -xzf "$BACKUP/configuration.tar.gz"

chown -R vmail:vmail "$MAIL_STORAGE_ROOT" "$ATTACHMENT_STORAGE_ROOT" "$MEDIA_ROOT"
chown root:vmail /etc/vibmail/vibmail.env
chmod 0640 /etc/vibmail/vibmail.env

systemctl daemon-reload
postfix check
if command -v doveconf >/dev/null 2>&1; then doveconf -n >/dev/null; fi
nginx -t

trap - EXIT INT TERM
restart_services
printf 'Restore completed and configuration validated.\n'
