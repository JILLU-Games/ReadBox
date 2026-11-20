#!/usr/bin/env bash
# AU-R2-BOOTSTRAP-01: pinned Git object staging, root-only, no live action by itself.
# Intended entrypoint only after separate explicit host-specific authorization.
set -Eeuo pipefail
umask 077
ROOT=/opt/readbox
stop() { printf 'AU_BOOTSTRAP_STOP:%s\n' "$1" >&2; exit 2; }
[[ "${EUID:-$(id -u)}" == 0 ]] || stop ROOT_REQUIRED
[[ "$#" == 2 && "$1" == --target-sha && "$2" =~ ^[0-9a-f]{40}$ ]] ||
  stop EXACT_TARGET_REQUIRED
target="$2"
for cmd in git mktemp stat flock bash; do
  command -v "$cmd" >/dev/null 2>&1 || stop REQUIRED_HOST_TOOL_MISSING
done
[[ -d "$ROOT/.git" && ! -L "$ROOT" && -f "$ROOT/docker-compose.yml" ]] ||
  stop APPROVED_HOST_ROOT_REQUIRED
cd "$ROOT"
[[ "$(git branch --show-current)" == main &&
   -z "$(git status --porcelain)" ]] || stop CLEAN_MAIN_REQUIRED
remote="$(git remote get-url origin)"
case "$remote" in
  https://github.com/vibtoolshq/ReadBox|https://github.com/vibtoolshq/ReadBox.git|https://github.com/JILLU-Games/ReadBox|https://github.com/JILLU-Games/ReadBox.git) ;;
  *) stop UNAPPROVED_HOST_ORIGIN ;;
esac
[[ -d /run/lock && ! -L /run/lock/readbox-au-r2-bootstrap.lock ]] ||
  stop BOOTSTRAP_LOCK_UNSAFE
exec 7<>/run/lock/readbox-au-r2-bootstrap.lock || stop BOOTSTRAP_LOCK_UNAVAILABLE
chmod 0600 /run/lock/readbox-au-r2-bootstrap.lock
[[ "$(stat -c '%u:%a' /run/lock/readbox-au-r2-bootstrap.lock)" == 0:600 ]] ||
  stop BOOTSTRAP_LOCK_UNSAFE
flock -n 7 || stop BOOTSTRAP_ALREADY_RUNNING
# Fixed read-only refs checked before fetching or staging an object.
read_ref() {
  local actual
  actual="$(git ls-remote --exit-code "$1" "$2")" || stop SOURCE_REF_UNAVAILABLE
  [[ "$actual" == "$target"$'\t'"$2" ]] || stop SOURCE_REF_SHA_MISMATCH
}
read_ref https://github.com/vibtoolshq/ReadBox.git refs/heads/main
read_ref https://github.com/JILLU-Games/ReadBox.git refs/heads/backup/dns-final-primary-20261119
read_ref https://github.com/MdNurnobi-Dev/ReadBox.git refs/heads/backup/dns-final-primary-20261119
# Resolve an exact frozen object in the canonical repository, not origin/main.
git -c gc.auto=0 -c maintenance.auto=false fetch --no-auto-gc --no-tags \
  https://github.com/vibtoolshq/ReadBox.git refs/heads/main >/dev/null ||
  stop CANONICAL_FETCH_FAILED
[[ "$(git rev-parse FETCH_HEAD)" == "$target" ]] ||
  stop CANONICAL_FETCH_SHA_MISMATCH
before="$(git rev-parse HEAD)"
[[ "$before" =~ ^[0-9a-f]{40}$ ]] || stop CURRENT_HEAD_INVALID
[[ "$before" != "$target" ]] || {
  echo AU_BOOTSTRAP_ALREADY_AT_TARGET_NO_UPDATE
  exit 0
}
git merge-base --is-ancestor "$before" "$target" ||
  stop NON_FAST_FORWARD_UPDATE_REFUSED
# This bootstrap script itself must be a verified blob at the SAME target.
entry="$(realpath -e -- "${BASH_SOURCE[0]}")" || stop BOOTSTRAP_ENTRY_MISSING
[[ -f "$entry" && ! -L "$entry" ]] || stop BOOTSTRAP_ENTRY_UNSAFE
case "$entry" in
  /run/readbox-au-r2-entry.*)
    [[ "$(stat -c '%u:%a' "$entry")" == 0:600 ]] ||
      stop BOOTSTRAP_ENTRY_UNSAFE ;;
  "$ROOT/scripts/install/readbox-update-bootstrap.sh")
    [[ "$(stat -c '%u' "$entry")" == 0 ]] ||
      stop BOOTSTRAP_ENTRY_UNSAFE ;;
  *) stop BOOTSTRAP_ENTRY_OUTSIDE_ALLOWED_PATH ;;
esac
[[ "$(git hash-object -- "$entry")" == \
   "$(git rev-parse "$target:scripts/install/readbox-update-bootstrap.sh")" ]] ||
  stop BOOTSTRAP_ENTRY_SHA_MISMATCH
# Private staging is never inside the tracked checkout. A controlled trap
# removes ONLY this newly-created directory, never a backup, Git ref or volume.
STAGE="$(mktemp -d -p /run readbox-au-r2-bootstrap.XXXXXXXX)" ||
  stop PRIVATE_STAGING_CREATION_FAILED
trap 'rm -rf -- "$STAGE"' EXIT
chmod 0700 "$STAGE"
[[ "$STAGE" =~ ^/run/readbox-au-r2-bootstrap\.[A-Za-z0-9]{8}$ &&
   ! -L "$STAGE" && "$(stat -c '%u:%a' "$STAGE")" == 0:700 ]] ||
  stop PRIVATE_STAGING_UNSAFE
install -d -m 0700 "$STAGE/scripts/install" "$STAGE/scripts/updater"
for path in scripts/install/readbox-guarded-update.sh \
            scripts/install/readbox-update.sh \
            scripts/updater/backup_r2_gate.py; do
  git cat-file blob "$target:$path" > "$STAGE/$path" ||
    stop VERIFIED_BLOB_UNAVAILABLE
  chmod 0600 "$STAGE/$path"
  [[ "$(stat -c '%u:%a' "$STAGE/$path")" == 0:600 &&
     "$(git hash-object -- "$STAGE/$path")" == "$(git rev-parse "$target:$path")" ]] ||
    stop STAGED_BLOB_SHA_MISMATCH
done
# Recheck that no tracked/untracked changes appeared during staging.
[[ "$(git branch --show-current)" == main &&
   -z "$(git status --porcelain)" ]] || stop WORKTREE_CHANGED_DURING_STAGING
echo AU_BOOTSTRAP_VERIFIED_TARGET_STAGED
# Existing guarded runner owns V2/R2 update gates and bounded health.
READBOX_AU_STAGE_DIR="$STAGE" bash "$STAGE/scripts/install/readbox-guarded-update.sh" \
  --target-sha "$target" || stop GUARDED_UPDATE_BLOCKED_BACKUPS_PRESERVED
echo AU_BOOTSTRAP_HEALTH_PASS_MANUAL_ACCEPTANCE_PENDING
