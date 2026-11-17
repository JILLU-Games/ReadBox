#!/usr/bin/env bash
# R-05 disposable Compose/PostgreSQL/named-volume recovery rehearsal. NEVER VPS.
set -Eeuo pipefail
PROJECT=readboxr05-ci
ROOT="$(mktemp -d)"
chmod 0700 "$ROOT"
export READBOX_R05_DISPOSABLE=1
COMPOSE="$PWD/deployment/operations/ci-compose.yml"
RECOVERY="$PWD/deployment/operations/compose_recovery.py"
C=(docker compose -f "$COMPOSE" --project-name "$PROJECT" --profile mailserver)
cleanup(){ "${C[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf "$ROOT"; }
trap cleanup EXIT
"${C[@]}" config --quiet
docker pull ubuntu:24.04 >/dev/null
"${C[@]}" up -d --wait postgres web worker dovecot postfix
WEB="$("${C[@]}" ps -q web)"
POSTFIX="$("${C[@]}" ps -q postfix)"
test -n "$WEB" && test -n "$POSTFIX"
age-keygen -o "$ROOT/identity.txt" >/dev/null 2>&1
chmod 0600 "$ROOT/identity.txt"
RECIPIENT="$(age-keygen -y "$ROOT/identity.txt")"
R05_ARGS=(--compose-file "$COMPOSE" --project "$PROJECT" --db-user readbox --db-name readbox --recipient "$RECIPIENT")

"${C[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U readbox -d readbox <<'SQL'
CREATE SCHEMA mailserver;
CREATE TABLE public.r05_probe(id int PRIMARY KEY,payload text NOT NULL);
CREATE TABLE mailserver.r05_probe(id int PRIMARY KEY,payload text NOT NULL);
INSERT INTO public.r05_probe VALUES (1,'BEFORE');
INSERT INTO mailserver.r05_probe VALUES (1,'MAILSERVER_BEFORE');
SQL
docker run --rm --network none --volumes-from "$WEB" busybox:1.37 sh -ec '
 mkdir -p /var/vmail/example.test/ops/Maildir/new /var/vmail/example.test/ops/Maildir/cur /var/vmail/example.test/ops/Maildir/tmp
 printf "R05_MAILDIR_ORIGINAL\n" > /var/vmail/example.test/ops/Maildir/new/r05-message
 printf "R05_ATTACHMENT_ORIGINAL\n" > /var/lib/readbox/attachments/r05-attachment
 printf "R05_MEDIA_ORIGINAL\n" > /var/lib/readbox/media/r05-media
 chown -R 1001:1001 /var/vmail /var/lib/readbox/attachments /var/lib/readbox/media
 chmod 0600 /var/vmail/example.test/ops/Maildir/new/r05-message
'
docker run --rm --network none --volumes-from "$POSTFIX" busybox:1.37 sh -ec '
 mkdir -p /var/spool/postfix/deferred
 printf "R05_QUEUE_ORIGINAL\n" > /var/spool/postfix/deferred/r05-queued
 chown -R 1001:1001 /var/spool/postfix/deferred
'
MAIL_VOLUME_PATH="$(docker volume inspect -f '{{.Mountpoint}}' "${PROJECT}_mail")"
sudo setfacl -m u:1002:r "$MAIL_VOLUME_PATH/example.test/ops/Maildir/new/r05-message"
sudo getfacl -cp "$MAIL_VOLUME_PATH/example.test/ops/Maildir/new/r05-message" | grep -q 'user:1002:r--'

python3 "$RECOVERY" backup "${R05_ARGS[@]}" --output "$ROOT/original.age" --confirm-maintenance
test "$(stat -c '%a' "$ROOT/original.age")" = 600
! grep -aq 'R05_MAILDIR_ORIGINAL' "$ROOT/original.age"
echo R05_ENCRYPTED_PRIVATE_BACKUP_PASS

"${C[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U readbox -d readbox <<'SQL'
UPDATE public.r05_probe SET payload='CHANGED';
UPDATE mailserver.r05_probe SET payload='MAILSERVER_CHANGED';
SQL
docker run --rm --network none --volumes-from "$WEB" busybox:1.37 sh -ec '
 rm /var/vmail/example.test/ops/Maildir/new/r05-message
 printf "TRANSIENT\n" >/var/vmail/example.test/ops/Maildir/new/transient
 printf "REPLACED\n" >/var/lib/readbox/attachments/r05-attachment
'
docker run --rm --network none --volumes-from "$POSTFIX" busybox:1.37 sh -ec '
 printf "REPLACED\n" >/var/spool/postfix/deferred/r05-queued
'
python3 "$RECOVERY" restore "${R05_ARGS[@]}" --input "$ROOT/original.age" \
 --identity "$ROOT/identity.txt" --rollback-output "$ROOT/pre-restore.age" \
 --confirm-maintenance --confirm-restore
test -s "$ROOT/pre-restore.age"
test "$(stat -c '%a' "$ROOT/pre-restore.age")" = 600
test "$("${C[@]}" exec -T postgres psql -U readbox -d readbox -Atc 'SELECT payload FROM public.r05_probe' | tr -d '\r')" = BEFORE
test "$("${C[@]}" exec -T postgres psql -U readbox -d readbox -Atc 'SELECT payload FROM mailserver.r05_probe' | tr -d '\r')" = MAILSERVER_BEFORE
docker run --rm --network none --volumes-from "$WEB" busybox:1.37 sh -ec '
 test "$(cat /var/vmail/example.test/ops/Maildir/new/r05-message)" = R05_MAILDIR_ORIGINAL
 test "$(cat /var/lib/readbox/attachments/r05-attachment)" = R05_ATTACHMENT_ORIGINAL
 test "$(cat /var/lib/readbox/media/r05-media)" = R05_MEDIA_ORIGINAL
 test ! -e /var/vmail/example.test/ops/Maildir/new/transient
 test "$(stat -c %u:%g /var/vmail/example.test/ops/Maildir/new/r05-message)" = 1001:1001
'
sudo getfacl -cp "$MAIL_VOLUME_PATH/example.test/ops/Maildir/new/r05-message" | grep -q 'user:1002:r--'
docker run --rm --network none --volumes-from "$POSTFIX" busybox:1.37 sh -ec '
 test "$(cat /var/spool/postfix/deferred/r05-queued)" = R05_QUEUE_ORIGINAL
'
echo R05_DB_MAILDIR_QUEUE_UID_ACL_RESTORE_PASS

# Deliberately fail after PostgreSQL apply on a disposable '-ci' project.
"${C[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U readbox -d readbox <<'SQL'
UPDATE public.r05_probe SET payload='ROLLBACK_PRESTATE';
UPDATE mailserver.r05_probe SET payload='ROLLBACK_MAIL_PRESTATE';
SQL
docker run --rm --network none --volumes-from "$WEB" busybox:1.37 sh -ec '
 printf "R05_BEFORE_FAILED_RESTORE\n" > /var/vmail/example.test/ops/Maildir/new/r05-message
 chown 1001:1001 /var/vmail/example.test/ops/Maildir/new/r05-message
'
if READBOX_R05_INJECT_FAILURE=1 python3 "$RECOVERY" restore "${R05_ARGS[@]}" \
 --input "$ROOT/original.age" --identity "$ROOT/identity.txt" \
 --rollback-output "$ROOT/forced-rollback.age" \
 --confirm-maintenance --confirm-restore >"$ROOT/forced-restore.log" 2>&1; then
 echo 'Injected failure was not detected' >&2; exit 1
fi
grep -Fq "R05_CI_FAILPOINT_AFTER_DATABASE_APPLY" "$ROOT/forced-restore.log"
grep -Fq "R05_AUTOMATIC_ROLLBACK_PASS" "$ROOT/forced-restore.log"
if grep -Fq "R05_CRITICAL" "$ROOT/forced-restore.log"; then
 echo 'Rollback reported critical failure' >&2; exit 1
fi
echo R05_PROVEN_POST_DATABASE_APPLY_AUTOMATIC_ROLLBACK_PASS
test -s "$ROOT/forced-rollback.age"
test "$("${C[@]}" exec -T postgres psql -U readbox -d readbox -Atc 'SELECT payload FROM public.r05_probe' | tr -d '\r')" = ROLLBACK_PRESTATE
test "$("${C[@]}" exec -T postgres psql -U readbox -d readbox -Atc 'SELECT payload FROM mailserver.r05_probe' | tr -d '\r')" = ROLLBACK_MAIL_PRESTATE
docker run --rm --network none --volumes-from "$WEB" busybox:1.37 sh -ec '
 test "$(cat /var/vmail/example.test/ops/Maildir/new/r05-message)" = R05_BEFORE_FAILED_RESTORE
'
echo R05_AUTOMATIC_ROLLBACK_DB_MAILDIR_PASS

cp "$ROOT/original.age" "$ROOT/tampered.age"
python3 - "$ROOT/tampered.age" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); b=bytearray(p.read_bytes()); b[len(b)//2]^=0x55; p.write_bytes(b)
PY
if python3 "$RECOVERY" restore "${R05_ARGS[@]}" \
 --input "$ROOT/tampered.age" --identity "$ROOT/identity.txt" \
 --rollback-output "$ROOT/corrupt-rollback.age" \
 --confirm-maintenance --confirm-restore; then
 echo 'Tampered encrypted backup was accepted' >&2; exit 1
fi
test ! -e "$ROOT/corrupt-rollback.age"
test "$("${C[@]}" exec -T postgres psql -U readbox -d readbox -Atc 'SELECT payload FROM public.r05_probe' | tr -d '\r')" = ROLLBACK_PRESTATE
echo R05_TAMPER_NO_MUTATION_PASS
test "$("${C[@]}" ps --services --status running | wc -l)" -eq 5
echo R05_DISPOSABLE_ONE_SHOT_BACKUP_RESTORE_ROLLBACK_PASS
