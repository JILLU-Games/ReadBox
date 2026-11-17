#!/usr/bin/env bash
# BR-02: opt-in installer. It never starts backup/restore and never modifies data volumes.
set -Eeuo pipefail
umask 077

[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo "ROOT_REQUIRED" >&2; exit 2; }
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
[[ "$ROOT" == "/opt/readbox" && -f "$ROOT/docker-compose.yml" ]] || {
  echo "APPROVED_COMPOSE_ROOT_REQUIRED" >&2; exit 2;
}
for executable in docker python3 age age-keygen systemctl stat; do
  command -v "$executable" >/dev/null 2>&1 || {
    echo "BACKUP_AGENT_PREREQUISITE_MISSING: $executable" >&2; exit 2;
  }
done
[[ -f "$ROOT/.env" && ! -L "$ROOT/.env" &&
   "$(stat -c %a "$ROOT/.env")" == "600" ]] || {
  echo "EXISTING_PRIVATE_ENV_REQUIRED" >&2; exit 2;
}
# This release has a fixed, audited Compose/database target. Do not guess other stacks.
grep -Fxq 'POSTGRES_USER=readbox' "$ROOT/.env"
grep -Fxq 'POSTGRES_DB=readbox' "$ROOT/.env"
docker compose -f "$ROOT/docker-compose.yml" --project-name readbox config --quiet

VOLUME=readbox_readbox_backup_ipc
if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "IPC_VOLUME_NOT_YET_CREATED: deploy the approved Compose config first" >&2
  exit 2
fi
SOCKET_DIR="$(docker volume inspect "$VOLUME" --format '{{.Mountpoint}}')"
[[ -n "$SOCKET_DIR" && "$SOCKET_DIR" == /* && -d "$SOCKET_DIR" && ! -L "$SOCKET_DIR" ]] || {
  echo "UNSAFE_IPC_VOLUME" >&2; exit 2;
}
# An existing, unrelated socket/dir is not ours to replace.
for item in "$SOCKET_DIR"/* "$SOCKET_DIR"/.[!.]*; do
  [[ -e "$item" || -L "$item" ]] || continue
  case "${item##*/}" in access.token|agent.sock) ;;
    *) echo "NONEMPTY_FOREIGN_IPC_VOLUME" >&2; exit 2 ;;
  esac
done

STATE=/var/lib/readbox-backup
ARCHIVES=/var/backups/readbox-managed
[[ ! -L "$STATE" && ! -L "$ARCHIVES" ]] || {
  echo "SYMBOLIC_BACKUP_DIRECTORY_REFUSED" >&2; exit 2;
}
install -d -m 0700 "$STATE" "$ARCHIVES"
IDENTITY="$STATE/identity.txt"
RECIPIENT="$STATE/recipient.txt"

if [[ ! -e "$IDENTITY" ]]; then
  stage="$(mktemp -d "$STATE/.key.XXXXXXXX")"
  trap 'rm -rf -- "${stage:-}"' EXIT
  age-keygen -o "$stage/identity.txt" >/dev/null 2>&1
  chmod 0600 "$stage/identity.txt"
  if ! ln "$stage/identity.txt" "$IDENTITY" 2>/dev/null; then
    echo "CONCURRENT_IDENTITY_CREATION_REFUSED" >&2; exit 2
  fi
  rm -rf -- "$stage"
  trap - EXIT
fi
[[ -f "$IDENTITY" && ! -L "$IDENTITY" &&
   "$(stat -c %a "$IDENTITY")" == "600" ]] || {
  echo "UNSAFE_EXISTING_AGE_IDENTITY" >&2; exit 2
}
PUBLIC_RECIPIENT="$(age-keygen -y "$IDENTITY")"
if [[ -e "$RECIPIENT" ]]; then
  [[ -f "$RECIPIENT" && ! -L "$RECIPIENT" ]] || {
    echo "UNSAFE_RECIPIENT_FILE" >&2; exit 2
  }
  [[ "$(<"$RECIPIENT")" == "$PUBLIC_RECIPIENT" ]] || {
    echo "RECIPIENT_IDENTITY_MISMATCH" >&2; exit 2
  }
else
  tmp="$(mktemp "$STATE/.recipient.XXXXXXXX")"
  printf '%s\n' "$PUBLIC_RECIPIENT" > "$tmp"
  chmod 0600 "$tmp"
  if ! ln "$tmp" "$RECIPIENT" 2>/dev/null; then
    echo "RECIPIENT_CONFLICT_REFUSED" >&2; exit 2
  fi
  rm -f "$tmp"
fi

CONFIG=/etc/readbox-backup-agent.env
EXPECTED="READBOX_BACKUP_SOCKET_DIR=$SOCKET_DIR"
if [[ -e "$CONFIG" ]]; then
  [[ -f "$CONFIG" && ! -L "$CONFIG" &&
     "$(<"$CONFIG")" == "$EXPECTED" ]] || {
    echo "EXISTING_AGENT_CONFIG_MISMATCH" >&2; exit 2;
  }
else
  tmp="$(mktemp /etc/.readbox-backup-agent.XXXXXXXX)"
  printf '%s\n' "$EXPECTED" > "$tmp"
  chmod 0600 "$tmp"
  if ! ln "$tmp" "$CONFIG" 2>/dev/null; then
    echo "CONCURRENT_CONFIG_CREATION_REFUSED" >&2; exit 2
  fi
  rm -f "$tmp"
fi

UNIT=/etc/systemd/system/readbox-backup-agent.service
SOURCE_UNIT="$ROOT/deployment/backup-agent/systemd/readbox-backup-agent.service"
if [[ -e "$UNIT" && ! -f "$UNIT" ]]; then
  echo "UNSAFE_EXISTING_SYSTEMD_UNIT" >&2; exit 2
fi
if [[ -f "$UNIT" ]] && ! cmp -s "$SOURCE_UNIT" "$UNIT"; then
  echo "EXISTING_SERVICE_DIFFERS_REVIEW_MANUALLY" >&2; exit 2
fi
if [[ ! -e "$UNIT" ]]; then
  install -m 0644 "$SOURCE_UNIT" "$UNIT"
fi
systemctl daemon-reload
systemctl enable --now readbox-backup-agent.service >/dev/null
systemctl is-active --quiet readbox-backup-agent.service || {
  echo "AGENT_NOT_HEALTHY_CHECK_JOURNAL" >&2; exit 1;
}
echo "BR02_HOST_AGENT_SERVICE_ACTIVE"
echo "RECOVERY_IDENTITY_ROOT_ONLY: independently preserve the age private identity before disaster"
echo "NO_PRODUCTION_BACKUP_OR_RESTORE_TRIGGERED"
