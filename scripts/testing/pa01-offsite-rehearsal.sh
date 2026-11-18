#!/usr/bin/env bash
# PA01: offline "offsite" fixture; no VPS, Cloudflare or production volume.
set -Eeuo pipefail
umask 077
[[ "$READBOX_PA01_DISPOSABLE" == 1 && "$GITHUB_ACTIONS" == true &&
   "$GITHUB_REPOSITORY" == JILLU-Games/ReadBox ]] || {
  echo PA01_DISPOSABLE_RECOVERY_GUARD_REFUSED >&2; exit 70;
}
PROJECT=readboxpa01-ci
COMPOSE="$PWD/deployment/operations/ci-compose.yml"
ENGINE="$PWD/deployment/operations/compose_recovery.py"
test -f "$COMPOSE" && test -f "$ENGINE"
C=(docker compose -f "$COMPOSE" --project-name "$PROJECT" --profile mailserver)
ROOT="$(mktemp -d)"
chmod 0700 "$ROOT"
cleanup() { "${C[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf "$ROOT"; }
trap cleanup EXIT
mkdir -m 0700 "$ROOT/source" "$ROOT/offsite" "$ROOT/escrow" "$ROOT/recovered"
docker image inspect ubuntu:24.04 >/dev/null || docker pull ubuntu:24.04 >/dev/null
"${C[@]}" config --quiet
"${C[@]}" up -d --wait postgres web worker dovecot postfix
WEB="$("${C[@]}" ps -q web)"
POSTFIX="$("${C[@]}" ps -q postfix)"
test -n "$WEB" && test -n "$POSTFIX"
age-keygen -o "$ROOT/source/identity.txt" >/dev/null 2>&1
chmod 0600 "$ROOT/source/identity.txt"
RECIPIENT="$(age-keygen -y "$ROOT/source/identity.txt")"
cp "$ROOT/source/identity.txt" "$ROOT/escrow/identity.txt"
chmod 0600 "$ROOT/escrow/identity.txt"
ARGS=(--compose-file "$COMPOSE" --project "$PROJECT" --db-user readbox --db-name readbox --recipient "$RECIPIENT")
"${C[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U readbox -d readbox <<'SQL'
CREATE SCHEMA mailserver;
CREATE TABLE public.pa01_probe(id int PRIMARY KEY,payload text NOT NULL);
CREATE TABLE mailserver.pa01_probe(id int PRIMARY KEY,payload text NOT NULL);
INSERT INTO public.pa01_probe VALUES(1,'PA01_PUBLIC_FROM_SOURCE');
INSERT INTO mailserver.pa01_probe VALUES(1,'PA01_MAILSERVER_FROM_SOURCE');
SQL
docker run --rm --network none --volumes-from "$WEB" busybox:1.37 sh -ec '
 mkdir -p /var/vmail/pa01.invalid/ops/Maildir/new
 printf "PA01_SOURCE_MAIL\n" > /var/vmail/pa01.invalid/ops/Maildir/new/source-message
 printf "PA01_SOURCE_ATTACHMENT\n" > /var/lib/readbox/attachments/pa01-attachment
 printf "PA01_SOURCE_MEDIA\n" > /var/lib/readbox/media/pa01-media
 chown -R 1001:1001 /var/vmail /var/lib/readbox/attachments /var/lib/readbox/media
 chmod 0600 /var/vmail/pa01.invalid/ops/Maildir/new/source-message
'
docker run --rm --network none --volumes-from "$POSTFIX" busybox:1.37 sh -ec '
 mkdir -p /var/spool/postfix/deferred
 printf "PA01_SOURCE_QUEUE\n" > /var/spool/postfix/deferred/pa01-queued
'
MAIL_VOLUME="$(docker volume inspect -f '{{.Mountpoint}}' "${PROJECT}_mail")"
sudo setfacl -m u:1002:r "$MAIL_VOLUME/pa01.invalid/ops/Maildir/new/source-message"
python3 "$ENGINE" backup "${ARGS[@]}" --output "$ROOT/source/source.age" --confirm-maintenance
cp "$ROOT/source/source.age" "$ROOT/offsite/offsite.age"
sha256sum "$ROOT/offsite/offsite.age" | cut -d' ' -f1 > "$ROOT/offsite/sha256.txt"
test "$(sha256sum "$ROOT/source/source.age" | cut -d' ' -f1)" = "$(cat "$ROOT/offsite/sha256.txt")"
# The source host and its Docker volumes no longer exist.
"${C[@]}" down -v --remove-orphans >/dev/null
rm -rf "$ROOT/source"
test ! -e "$ROOT/source"
"${C[@]}" up -d --wait postgres web worker dovecot postfix
age-keygen -o "$ROOT/recovered/wrong-identity.txt" >/dev/null 2>&1
chmod 0600 "$ROOT/recovered/wrong-identity.txt"
cp "$ROOT/offsite/offsite.age" "$ROOT/recovered/retrieved.age"
test "$(sha256sum "$ROOT/recovered/retrieved.age" | cut -d' ' -f1)" = "$(cat "$ROOT/offsite/sha256.txt")"
if python3 "$ENGINE" restore "${ARGS[@]}" --input "$ROOT/recovered/retrieved.age" \
  --identity "$ROOT/recovered/wrong-identity.txt" --rollback-output "$ROOT/recovered/wrong-rollback.age" \
  --confirm-maintenance --confirm-restore >/dev/null 2>&1; then
  echo PA01_WRONG_ESCROW_KEY_ACCEPTED >&2; exit 1
fi
test ! -e "$ROOT/recovered/wrong-rollback.age"
test ! -e /etc/readbox-backup-restore.allow
cp "$ROOT/escrow/identity.txt" "$ROOT/recovered/identity.txt"
chmod 0600 "$ROOT/recovered/identity.txt"
test "$(age-keygen -y "$ROOT/recovered/identity.txt")" = "$RECIPIENT"
python3 "$ENGINE" restore "${ARGS[@]}" --input "$ROOT/recovered/retrieved.age" \
  --identity "$ROOT/recovered/identity.txt" --rollback-output "$ROOT/recovered/rollback.age" \
  --confirm-maintenance --confirm-restore
test -s "$ROOT/recovered/rollback.age"
test "$(stat -c '%a' "$ROOT/recovered/rollback.age")" = 600
test "$("${C[@]}" exec -T postgres psql -U readbox -d readbox -Atc 'SELECT payload FROM public.pa01_probe' | tr -d '\r')" = PA01_PUBLIC_FROM_SOURCE
test "$("${C[@]}" exec -T postgres psql -U readbox -d readbox -Atc 'SELECT payload FROM mailserver.pa01_probe' | tr -d '\r')" = PA01_MAILSERVER_FROM_SOURCE
WEB="$("${C[@]}" ps -q web)"
POSTFIX="$("${C[@]}" ps -q postfix)"
docker run --rm --network none --volumes-from "$WEB" busybox:1.37 sh -ec '
 test "$(cat /var/vmail/pa01.invalid/ops/Maildir/new/source-message)" = PA01_SOURCE_MAIL
 test "$(cat /var/lib/readbox/attachments/pa01-attachment)" = PA01_SOURCE_ATTACHMENT
 test "$(cat /var/lib/readbox/media/pa01-media)" = PA01_SOURCE_MEDIA
 test "$(stat -c %u:%g /var/vmail/pa01.invalid/ops/Maildir/new/source-message)" = 1001:1001
'
sudo getfacl -cp "$(docker volume inspect -f '{{.Mountpoint}}' "${PROJECT}_mail")/pa01.invalid/ops/Maildir/new/source-message" | grep -q 'user:1002:r--'
docker run --rm --network none --volumes-from "$POSTFIX" busybox:1.37 sh -ec '
 test "$(cat /var/spool/postfix/deferred/pa01-queued)" = PA01_SOURCE_QUEUE
'
echo PA01_INDEPENDENT_ESCROW_OFFSITE_LOST_VOLUME_AGE_RESTORE_ACL_QUEUE_PASS
