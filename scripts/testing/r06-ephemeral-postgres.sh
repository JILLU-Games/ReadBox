#!/usr/bin/env bash
# R-06 verified local PostgreSQL integration target (DISPOSABLE CI ONLY).
# Original application schema/Prisma migrations and test guard remain unchanged.
set -Eeuo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${GITHUB_REPOSITORY:-}" != "vibtoolshq/ReadBox" ]]; then
  echo "R06: refusing non-CI PostgreSQL integration target" >&2
  exit 2
fi
if [[ -e compose.yaml ]]; then
  echo "R06: refusing to overwrite an existing compose.yaml" >&2
  exit 2
fi
test -f compose.dev.yaml
export AUTH_TEST_DATABASE_NAME="readbox_auth_test_$(openssl rand -hex 16)"
export AUTH_TEST_POSTGRES_PASSWORD="R06_Test_Db_Only_0123456789_Private_2026"
export AUTH_TEST_DATABASE_URL="postgresql://readbox_test:${AUTH_TEST_POSTGRES_PASSWORD}@127.0.0.1:55432/${AUTH_TEST_DATABASE_NAME}?schema=public"
unset DATABASE_URL
cp -- compose.dev.yaml compose.yaml
chmod 0600 compose.yaml
cleanup() {
  docker compose --project-name readbox-auth-test -f compose.yaml --profile integration down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f -- compose.yaml
}
trap cleanup EXIT
docker compose --project-name readbox-auth-test -f compose.yaml --profile integration up -d --wait postgres-test
npm run test:postgres
echo R06_EPHEMERAL_POSTGRES_TARGET_GUARDED_INTEGRATION_PASS
