#!/usr/bin/env bash
# AU-R2-UPDATE-01: approved root-only, pinned source update; no restore/release.
set -Eeuo pipefail
umask 077
ROOT=/opt/readbox
die() { printf 'AU_R2_UPDATE_STOP:%s\n' "$1" >&2; exit 2; }
[[ "${EUID:-$(id -u)}" == 0 ]] || die ROOT_REQUIRED
[[ "$#" == 2 && "$1" == --target-sha && "$2" =~ ^[0-9a-f]{40}$ ]] || die PINNED_SHA_REQUIRED
target="$2"
[[ -d "$ROOT/.git" && -f "$ROOT/docker-compose.yml" && ! -L "$ROOT" ]] ||
  die APPROVED_COMPOSE_ROOT_REQUIRED
cd "$ROOT"
[[ -f scripts/updater/backup_r2_gate.py && ! -L scripts/updater/backup_r2_gate.py &&
   -f scripts/install/readbox-update.sh && ! -L scripts/install/readbox-update.sh ]] ||
  die GUARDED_UPDATER_FILES_REQUIRED
# Never silently use an older updater that ignores the new R2 receipt gate.
grep -Fq READBOX_R2_GUARDED scripts/install/readbox-update.sh ||
  die GUARDED_UPDATER_VERSION_REQUIRED
for cmd in git docker python3 age-keygen flock stat sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || die HOST_PREREQUISITE_MISSING
done
[[ -d /run/lock && ! -L /run/lock/readbox-au-r2-guard.lock ]] ||
  die UPDATE_GUARD_LOCK_UNSAFE
exec 8<>/run/lock/readbox-au-r2-guard.lock || die UPDATE_GUARD_LOCK_UNAVAILABLE
chmod 0600 /run/lock/readbox-au-r2-guard.lock
flock -n 8 || die ANOTHER_GUARDED_UPDATE_RUNNING
[[ -f .env && ! -L .env && "$(stat -c %a .env)" == 600 ]] ||
  die PRIVATE_ENV_REQUIRED
[[ "$(git branch --show-current)" == main && -z "$(git status --porcelain)" ]] ||
  die CLEAN_MAIN_REQUIRED
remote="$(git remote get-url origin)"
case "$remote" in
  https://github.com/vibtoolshq/ReadBox|https://github.com/vibtoolshq/ReadBox.git|https://github.com/JILLU-Games/ReadBox|https://github.com/JILLU-Games/ReadBox.git) ;;
  *) die UNAPPROVED_GIT_ORIGIN ;;
esac
source_ref=refs/heads/main
backup_ref=refs/heads/backup/dns-final-primary-20261119
# Target/three fixed refs are verified before any data-changing action.
read_ref() {
  local output
  output="$(git ls-remote --exit-code "$1" "$2")" || die GIT_REF_UNAVAILABLE
  [[ "$output" == "$target"$'$\t'"$2" ]] || die GIT_REF_SHA_MISMATCH
}
read_ref https://github.com/vibtoolshq/ReadBox.git "$source_ref"
read_ref https://github.com/JILLU-Games/ReadBox.git "$backup_ref"
read_ref https://github.com/MdNurnobi-Dev/ReadBox.git "$backup_ref"
current="$(git rev-parse HEAD)"
[[ "$current" =~ ^[0-9a-f]{40}$ ]] || die CURRENT_SHA_INVALID
if [[ "$current" == "$target" ]]; then
  echo AU_R2_ALREADY_UP_TO_DATE_NO_UPDATE
  exit 0
fi
docker compose --project-name readbox -f docker-compose.yml config --quiet ||
  die COMPOSE_CONFIG_INVALID
docker image inspect ubuntu:24.04 >/dev/null || die RECOVERY_IMAGE_MISSING
systemctl is-active --quiet readbox-backup-agent.service ||
  die BACKUP_AGENT_INACTIVE
# Pre-update service inventory is retained in-process, not printed into logs.
mapfile -t before_services < <(docker compose --project-name readbox -f docker-compose.yml ps --services --status running)
for service in postgres web worker; do
  [[ " ${before_services[*]} " == *" $service "* ]] || die REQUIRED_SERVICE_NOT_RUNNING
done
# Read-only, no R2 test probe/PUT at this stage.
python3 scripts/updater/backup_r2_gate.py preflight >/dev/null ||
  die BACKUP_R2_PREFLIGHT_FAILED
echo AU_R2_PREFLIGHT_PASS
# The agent uses the global maintenance lock for each backup/verify/R2 job.
# Do not hold that lock here: the existing updater acquires it afterwards.
gate="$(python3 scripts/updater/backup_r2_gate.py run)" ||
  die ENCRYPTED_R2_BACKUP_NOT_VERIFIED
read -r backup_id digest extra <<< "$gate"
[[ "$backup_id" =~ ^[0-9a-f]{32}$ && "$digest" =~ ^[0-9a-f]{64}$ && -z "${extra:-}" ]] ||
  die GUARDED_RECEIPT_INVALID
echo AU_R2_MANAGED_LOCAL_AND_REMOTE_SHA256_PASS
[[ -d /root/.readbox-secrets/pre-update &&
   ! -L /root/.readbox-secrets/pre-update &&
   "$(stat -c %a /root/.readbox-secrets/pre-update)" == 700 ]] ||
  die PRIVATE_ROLLBACK_DIRECTORY_REQUIRED
# PUBLIC age recipient only; private identity never leaves host or logs.
recipient="$(age-keygen -y /var/lib/readbox-backup/identity.txt)" ||
  die AGE_RECIPIENT_UNAVAILABLE
[[ "$recipient" =~ ^age1[023456789acdefghjklmnpqrstuvwxyz]{55,}$ ]] ||
  die AGE_RECIPIENT_INVALID
# Existing guarded script still captures an independent R05 rollback snapshot.
# Re-attestation occurs inside that script before Git advances.
READBOX_UPDATE_TARGET_SHA="$target" READBOX_UPDATE_REQUIRE_PARITY=1 \
READBOX_R2_GUARDED=1 READBOX_R2_BACKUP_ID="$backup_id" \
READBOX_R2_BACKUP_SHA256="$digest" READBOX_BACKUP_RECIPIENT="$recipient" \
READBOX_BACKUP_DIR=/root/.readbox-secrets/pre-update \
READBOX_COMPOSE_PROJECT=readbox bash scripts/install/readbox-update.sh ||
  die COMPOSE_UPDATE_FAILED_PRESERVE_BACKUPS
# One bounded consolidated post-update gate. No automatic DB restore/reset.
[[ "$(git rev-parse HEAD)" == "$target" && -z "$(git status --porcelain)" ]] ||
  die POST_UPDATE_SHA_OR_WORKTREE_MISMATCH
for service in "${before_services[@]}"; do
  [[ -n "$service" ]] || continue
  cid="$(docker compose --project-name readbox -f docker-compose.yml ps -q "$service")"
  [[ -n "$cid" ]] || die POST_UPDATE_SERVICE_MISSING
  condition="$(docker inspect -f '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")"
  if [[ "$service" == postgres || "$service" == web || "$service" == worker ]]; then
    [[ "$condition" == "running|healthy" ]] || die POST_UPDATE_CORE_UNHEALTHY
  else
    [[ "$condition" == "running|healthy" || "$condition" == "running|none" ]] ||
      die POST_UPDATE_PREVIOUS_SERVICE_UNHEALTHY
  fi
done
# Node runs inside the web container; endpoints are private loopback only.
docker compose --project-name readbox -f docker-compose.yml exec -T web node -e '
(async () => {
  for (const path of ["/health/live", "/health/ready"]) {
    const reply = await fetch("http://127.0.0.1:3000" + path, {signal: AbortSignal.timeout(8000)});
    if (!reply.ok) process.exit(1);
    const body = await reply.json();
    if (body.status !== (path.endsWith("/ready") ? "ready" : "live")) process.exit(1);
  }
})().catch(() => process.exit(1));
' >/dev/null || die POST_UPDATE_APP_READINESS_FAILED
# Read-only migration status. Web boot has already applied migrations.
timeout 60 docker compose --project-name readbox -f docker-compose.yml exec -T web \
  node ./node_modules/prisma/build/index.js migrate status >/dev/null ||
  die POST_UPDATE_MIGRATION_STATUS_FAILED
systemctl is-active --quiet readbox-backup-agent.service ||
  die POST_UPDATE_BACKUP_AGENT_INACTIVE
echo AU_R2_UPDATE_HEALTH_PASS
echo AU_R2_UPDATE_MANUAL_ACCEPTANCE_PENDING
