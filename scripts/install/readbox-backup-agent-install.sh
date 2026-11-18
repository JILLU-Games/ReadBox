#!/usr/bin/env bash
# BR-02: opt-in installer. It never starts backup/restore and never modifies data volumes.
set -Eeuo pipefail
umask 077

[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo "ROOT_REQUIRED" >&2; exit 2; }
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
[[ "$ROOT" == "/opt/readbox" && -f "$ROOT/docker-compose.yml" ]] || {
  echo "APPROVED_COMPOSE_ROOT_REQUIRED" >&2; exit 2;
}
for executable in docker python3 age age-keygen systemctl stat flock sha256sum mktemp readlink; do
  command -v "$executable" >/dev/null 2>&1 || {
    echo "BACKUP_AGENT_PREREQUISITE_MISSING: $executable" >&2; exit 2;
  }
done
# BR-03 R2 SDK lock is for CPython 3.12; refuse implicit Python upgrades.
[[ "$(/usr/bin/python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')" == "3.12" ]] || {
  echo "BR03_PYTHON_312_REQUIRED" >&2; exit 2;
}
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

# P-02: only this installer owns the root-only, versioned R2 Python runtime.
# The existing broker's own in-process 15-second scheduler is authoritative.
# Do NOT install/enable the optional systemd timer (it starts the service, not a job).
LOCK="$ROOT/deployment/backup-agent/requirements.lock"
[[ -f "$LOCK" && ! -L "$LOCK" ]] || {
  echo "BR03_HASH_LOCK_MISSING_OR_UNSAFE" >&2; exit 2
}
LOCK_SHA="$(sha256sum -- "$LOCK" | cut -d' ' -f1)"
[[ "$LOCK_SHA" =~ ^[0-9a-f]{64}$ ]] || { echo "BR03_LOCK_DIGEST_INVALID" >&2; exit 2; }
RUNTIME=/opt/readbox-backup-agent
RELEASES="$RUNTIME/releases"
CURRENT="$RUNTIME/current"
for folder in "$RUNTIME" "$RELEASES"; do
  [[ ! -L "$folder" ]] || { echo "BR03_RUNTIME_SYMLINK_REFUSED" >&2; exit 2; }
  if [[ -e "$folder" ]]; then
    [[ -d "$folder" && "$(stat -c '%u:%g:%a' "$folder")" == "0:0:700" ]] || {
      echo "BR03_RUNTIME_ROOT_UNSAFE" >&2; exit 2
    }
  else
    install -d -m 0700 "$folder"
  fi
done
INSTALL_LOCK="$RUNTIME/install.lock"
[[ ! -L "$INSTALL_LOCK" ]] || { echo "BR03_INSTALL_LOCK_UNSAFE" >&2; exit 2; }
exec 8>"$INSTALL_LOCK"
chmod 0600 "$INSTALL_LOCK"
flock -n 8 || { echo "BR03_CONCURRENT_INSTALL_REFUSED" >&2; exit 2; }

UNIT=/etc/systemd/system/readbox-backup-agent.service
SOURCE_UNIT="$ROOT/deployment/backup-agent/systemd/readbox-backup-agent.service"
[[ -f "$SOURCE_UNIT" && ! -L "$SOURCE_UNIT" ]] || {
  echo "BR03_SOURCE_UNIT_UNSAFE" >&2; exit 2
}
# Only the exact original BR-02 unit or our own P-02 unit may be replaced.
# Unknown service customizations are never overwritten.
OLD_BR02_UNIT_SHA256=d667df88d72dba84a8c99cb693b1db3b63ad0162ea459f3a0950cbf666028dd4
OLD_UNIT=0
UNIT_NEEDS_UPDATE=1
if [[ -e "$UNIT" || -L "$UNIT" ]]; then
  [[ -f "$UNIT" && ! -L "$UNIT" && "$(stat -c '%u:%g:%a' "$UNIT")" == "0:0:644" ]] || {
    echo "UNSAFE_EXISTING_SYSTEMD_UNIT" >&2; exit 2
  }
  OLD_UNIT=1
  if cmp -s "$SOURCE_UNIT" "$UNIT"; then
    UNIT_NEEDS_UPDATE=0
  elif [[ "$(sha256sum -- "$UNIT" | cut -d' ' -f1)" != "$OLD_BR02_UNIT_SHA256" ]]; then
    echo "EXISTING_SERVICE_DIFFERS_REVIEW_MANUALLY" >&2; exit 2
  fi
fi

OLD_TARGET=
if [[ -e "$CURRENT" || -L "$CURRENT" ]]; then
  [[ -L "$CURRENT" ]] || { echo "BR03_RUNTIME_POINTER_UNSAFE" >&2; exit 2; }
  OLD_TARGET="$(readlink -- "$CURRENT")"
  [[ "$OLD_TARGET" =~ ^releases/[a-f0-9]{64}$ &&
     -d "$RUNTIME/$OLD_TARGET" && ! -L "$RUNTIME/$OLD_TARGET" ]] || {
    echo "BR03_RUNTIME_POINTER_UNSAFE" >&2; exit 2
  }
fi
RELEASE="$RELEASES/$LOCK_SHA"
[[ ! -L "$RELEASE" ]] || { echo "BR03_RUNTIME_RELEASE_UNSAFE" >&2; exit 2; }
TX="$(mktemp -d "$RUNTIME/.upgrade.XXXXXXXX")"
CREATED_RELEASE=0
UNIT_CHANGED=0
POINTER_CHANGED=0
COMPLETE=0
WAS_ACTIVE=0
WAS_ENABLED=0
if systemctl is-active --quiet readbox-backup-agent.service; then WAS_ACTIVE=1; fi
if systemctl is-enabled --quiet readbox-backup-agent.service; then WAS_ENABLED=1; fi
if [[ "$OLD_UNIT" == 1 ]]; then cp -p -- "$UNIT" "$TX/old.service"; fi

rollback() {
  local result=$?
  trap - EXIT
  set +e  # Failure cleanup is best-effort; always attempt original service restore.
  if [[ "$COMPLETE" != 1 ]]; then
    if [[ "$POINTER_CHANGED" == 1 ]]; then
      if [[ -n "$OLD_TARGET" ]]; then
        ln -s -- "$OLD_TARGET" "$TX/restore-link"
        mv -Tf -- "$TX/restore-link" "$CURRENT"
      else
        rm -f -- "$CURRENT"
      fi
    fi
    if [[ "$UNIT_CHANGED" == 1 ]]; then
      if [[ "$OLD_UNIT" == 1 ]]; then
        install -m 0644 "$TX/old.service" "$TX/old-unit.tmp"
        mv -Tf -- "$TX/old-unit.tmp" "$UNIT"
      else
        rm -f -- "$UNIT"
      fi
    fi
    if [[ "$UNIT_CHANGED" == 1 || "$POINTER_CHANGED" == 1 ]]; then
      systemctl daemon-reload >/dev/null 2>&1 || true
      if [[ "$WAS_ACTIVE" == 1 ]]; then
        systemctl restart readbox-backup-agent.service >/dev/null 2>&1 || true
      else
        systemctl stop readbox-backup-agent.service >/dev/null 2>&1 || true
      fi
      if [[ "$WAS_ENABLED" == 0 ]]; then
        systemctl disable readbox-backup-agent.service >/dev/null 2>&1 || true
      fi
    fi
    if [[ "$CREATED_RELEASE" == 1 ]]; then rm -rf -- "$RELEASE"; fi
    echo "BR03_INSTALL_ROLLBACK_ATTEMPTED_PREVIOUS_RUNTIME_PRESERVED" >&2
  fi
  rm -rf -- "$TX"
  exit "$result"
}
trap rollback EXIT

# A complete release is keyed to the exact hashed lock; no in-place pip
# updates or reinstallation on an unchanged runtime.
if [[ -e "$RELEASE" ]]; then
  [[ -d "$RELEASE" && "$(stat -c '%u:%g:%a' "$RELEASE")" == "0:0:700" &&
     -f "$RELEASE/.readbox-lock.sha256" && ! -L "$RELEASE/.readbox-lock.sha256" &&
     "$(<"$RELEASE/.readbox-lock.sha256")" == "$LOCK_SHA" ]] || {
    echo "BR03_EXISTING_RELEASE_UNTRUSTED" >&2; exit 2
  }
else
  mkdir -m 0700 -- "$RELEASE"
  CREATED_RELEASE=1
  /usr/bin/python3 -m venv "$RELEASE" || {
    echo "BR03_PYTHON_VENV_REQUIRED" >&2; exit 2
  }
  # --isolated ignores pip environment/user config; binary-only wheels avoid
  # unreviewed build hooks. Every resolved package must match a lockfile SHA256.
  "$RELEASE/bin/python" -m pip --isolated install --require-hashes \
    --only-binary=:all: --no-input --disable-pip-version-check --no-cache-dir \
    --index-url https://pypi.org/simple -r "$LOCK" >/dev/null || {
    echo "BR03_HASH_LOCK_INSTALL_FAILED" >&2; exit 2
  }
  printf '%s\n' "$LOCK_SHA" > "$RELEASE/.readbox-lock.sha256"
  chmod 0600 "$RELEASE/.readbox-lock.sha256"
fi
[[ -x "$RELEASE/bin/python" && ! -L "$RELEASE/.readbox-lock.sha256" ]] || {
  echo "BR03_RUNTIME_BINARY_UNSAFE" >&2; exit 2
}
"$RELEASE/bin/python" -m pip --isolated check >/dev/null || {
  echo "BR03_RUNTIME_DEPENDENCY_CHECK_FAILED" >&2; exit 2
}
"$RELEASE/bin/python" -c 'import sys, boto3, botocore, cryptography; assert sys.version_info[:2] == (3, 12)' || {
  echo "BR03_RUNTIME_IMPORT_CHECK_FAILED" >&2; exit 2
}

# Refuse to switch interpreters or restart while any job/maintenance is live.
GLOBAL_LOCK=/run/lock/readbox-backup-global.lock
[[ ! -L "$GLOBAL_LOCK" ]] || { echo "BR03_GLOBAL_LOCK_UNSAFE" >&2; exit 2; }
exec 9<>"$GLOBAL_LOCK"
flock -n 9 || { echo "BR03_LIVE_MAINTENANCE_REFUSED" >&2; exit 2; }
/usr/bin/python3 - "$STATE/jobs" <<'CHECK_JOBS' || {
  echo "BR03_ACTIVE_JOB_OR_UNREADABLE_JOURNAL_REFUSED" >&2; exit 2;
}
import json, pathlib, sys
directory = pathlib.Path(sys.argv[1])
if directory.is_symlink():
    raise SystemExit(2)
if directory.exists():
    for path in directory.glob("*.json"):
        if path.is_symlink() or not path.is_file():
            raise SystemExit(2)
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(job, dict) or job.get("state") in {"queued", "running"}:
                raise SystemExit(2)
        except (OSError, ValueError):
            raise SystemExit(2)
CHECK_JOBS

if [[ "$OLD_TARGET" != "releases/$LOCK_SHA" ]]; then
  ln -s -- "releases/$LOCK_SHA" "$TX/new-link"
  mv -Tf -- "$TX/new-link" "$CURRENT"
  POINTER_CHANGED=1
fi
if [[ "$UNIT_NEEDS_UPDATE" == 1 ]]; then
  UNIT_TMP="$(mktemp /etc/systemd/system/.readbox-backup-agent.XXXXXXXX)"
  install -m 0644 "$SOURCE_UNIT" "$UNIT_TMP"
  mv -Tf -- "$UNIT_TMP" "$UNIT"
  UNIT_CHANGED=1
fi
# Timer remains deliberately disabled/uninstalled: agent.py already polls its
# persisted UTC schedule every 15 seconds; service auto-start covers restarts.
systemctl daemon-reload
if [[ "$UNIT_CHANGED" == 1 || "$POINTER_CHANGED" == 1 || "$WAS_ACTIVE" == 0 ]]; then
  systemctl enable readbox-backup-agent.service >/dev/null
  systemctl restart readbox-backup-agent.service
else
  systemctl enable --now readbox-backup-agent.service >/dev/null
fi
sleep 1
systemctl is-active --quiet readbox-backup-agent.service && [[ -S "$SOCKET_DIR/agent.sock" ]] || {
  echo "BR03_AGENT_NOT_HEALTHY_ROLLING_BACK" >&2; exit 1
}
COMPLETE=1
echo "BR03_HOST_RUNTIME_HASH_VERIFIED_SERVICE_ACTIVE"
echo "BR03_SCHEDULER_IN_PROCESS_ONLY_TIMER_NOT_ENABLED"
echo "EXISTING_AGE_IDENTITY_BACKUPS_ENV_AND_VOLUMES_UNCHANGED"
echo "NO_PRODUCTION_BACKUP_OR_RESTORE_TRIGGERED"
