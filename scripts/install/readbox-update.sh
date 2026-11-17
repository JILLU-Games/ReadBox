#!/usr/bin/env bash
# QIS-01 safe host-side Docker update; NO automatic destructive rollback.
set -Eeuo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$ROOT"
PROJECT="${READBOX_COMPOSE_PROJECT:-readbox}"
ENV="$ROOT/.env"
if [[ $# -ne 0 || ! "$PROJECT" =~ ^[a-z][a-z0-9_-]{2,55}$ ]]; then
  echo "Usage: bash scripts/install/readbox-update.sh" >&2; exit 2
fi
for cmd in git docker python3 age; do
  command -v "$cmd" >/dev/null || { echo "Missing: $cmd" >&2; exit 2; }
done
if [[ ! -f "$ENV" || -L "$ENV" || "$(stat -c %a "$ENV")" != "600" ]]; then
  echo "Private .env missing or unsafe. Refusing update." >&2; exit 2
fi
if ! git diff --quiet HEAD -- || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Checkout has local changes. Refusing automatic update." >&2; exit 2
fi
remote="$(git remote get-url origin)"
case "$remote" in
  https://github.com/vibtoolshq/ReadBox|https://github.com/vibtoolshq/ReadBox.git|https://github.com/JILLU-Games/ReadBox|https://github.com/JILLU-Games/ReadBox.git)
    ;;
  *) echo "Unapproved Git remote; refusing update." >&2; exit 2 ;;
esac
recipient="${READBOX_BACKUP_RECIPIENT:-}"
if [[ -z "$recipient" ]]; then
  count="$(grep -Ec '^READBOX_BACKUP_RECIPIENT=' "$ENV" || true)"
  if [[ "$count" == "1" ]]; then
    value="$(grep -E '^READBOX_BACKUP_RECIPIENT=' "$ENV")"
    recipient="${value#*=}"
  fi
fi
if ! [[ "$recipient" =~ ^age1[023456789acdefghjklmnpqrstuvwxyz]{55,}$ ]]; then
  echo "An age backup public recipient is required before any code update." >&2
  exit 2
fi
docker image inspect ubuntu:24.04 >/dev/null || {
  echo "Pre-pull and audit ubuntu:24.04 recovery sidecar before updating." >&2; exit 2
}
docker compose --project-name "$PROJECT" -f docker-compose.yml config --quiet
before="$(git rev-parse HEAD)"
git fetch --no-tags origin main
after="$(git rev-parse FETCH_HEAD)"
if [[ "$before" == "$after" ]]; then
  echo "QIS01_ALREADY_UP_TO_DATE"; exit 0
fi
git merge-base --is-ancestor "$before" "$after" || {
  echo "Non-fast-forward upgrade refused." >&2; exit 2
}
BACKUP_DIR="${READBOX_BACKUP_DIR:-$HOME/.local/share/readbox/backup}"
[[ "$BACKUP_DIR" = /* && ! -L "$BACKUP_DIR" ]] || {
  echo "Backup target must be a real absolute directory." >&2; exit 2
}
mkdir -p -- "$BACKUP_DIR"
chmod 0700 "$BACKUP_DIR"
snapshot="$BACKUP_DIR/pre-update-$before-$(date -u +%Y%m%dT%H%M%SZ).age"
python3 deployment/operations/compose_recovery.py backup \
  --compose-file "$ROOT/docker-compose.yml" --project "$PROJECT" \
  --db-user readbox --db-name readbox --recipient "$recipient" \
  --output "$snapshot" --confirm-maintenance
echo "QIS01_ENCRYPTED_PRE_UPDATE_BACKUP_READY"
git merge --ff-only "$after"
if ! docker compose --project-name "$PROJECT" -f docker-compose.yml up -d --build postgres web worker; then
  echo "QIS01_UPDATE_FAILED: the encrypted rollback artifact is preserved." >&2
  echo "Database migrations may already have been applied. Do NOT run git reset or delete volumes." >&2
  echo "Follow an explicitly approved rollback/restore plan; no automatic destructive rollback." >&2
  exit 1
fi
echo "QIS01_SAFE_COMPOSE_UPDATE_COMPLETED"
echo "SMTP/public TLS/DNS are not altered by the updater."
