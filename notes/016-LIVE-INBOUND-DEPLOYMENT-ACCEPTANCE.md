# 016 — Authorized live inbound deployment: observed acceptance (2026-11-18)

This note records results from operator-provided PuTTY output and screenshots, **not a fresh independent audit**. No raw SMTP bodies, passwords, authentication secrets, PII-rich log files, TLS private keys or backup archives are stored here.

| Check | Operator observation | Evidence scope |
|---|---|---|
| Source and mirror | Both `main` SHA `0849bc8d4f4b703800ba73f157f16d5a742ee6e7` at inspection | GitHub HEAD comparison before this documentation commit |
| HTTPS | `/health/live` HTTP 200, TLS previously checked | Liveness only; not equivalent to `/health/ready` |
| Five Compose services | PostgreSQL/web/worker/Dovecot/Postfix healthy after backup | One VPS snapshot |
| Public SMTP | `173.212.201.250:25`, STARTTLS PASS | Tested from the VPS, not a second independent external probe |
| SMTP security | Nonlocal RCPT `554`; unknown local RCPT `550` | Only those two negative cases |
| Real inbound mail | Gmail-sent “ReadBox External Gmail Test 01” displayed with subject, body, date in authenticated inbox | One successful message; no attachment digest or broad MIME/size negatives |
| System mailboxes | `postmaster@anyinbox.cc` and `abuse@anyinbox.cc` active; one user mailbox active | Dashboard screenshots; assignment/monitoring not validated |
| Local backup | `/var/backups/readbox/20261117T205245Z`, SHA-256 PASS, `pg_restore -l` readable | Backup archive consistency; **not** actual restore |
| Encrypted local archive | `/var/backups/readbox-encrypted/20261117T205245Z.tar.gz.gpg`, owner root mode 0600; symmetric AES256 encryption + decrypt/list PASS | **No** encrypted offsite copy, disaster recovery or isolated restore |
| Operational state | Installation phase manually closed for inbound use | **Not** a formal production release GO |

## Release decision

**R-06 formal production NO-GO remains in force.** Keep the original 32-finding register, seven OPEN entries and 17-gate acceptance contract unchanged until individually evidenced and independently reviewed. This note does not claim all 17 PASS and is not a signed production acceptance report.

Next-phase work: offsite encrypted backup strategy, isolated restore/rollback, monitored capacity/alerting, evidence reconciliation, provenance and dependency signoff, then a separately approved stable release. Avoid repetitive verification loops; one targeted verification per scope-locked phase.
---

## 2026-11-20 — Post-update Manual Mode two-domain live inbound acceptance

On authorized ReadBox VPS (`/opt/readbox`, `173.212.201.250`), operator completed guarded non-force update `6f3bc1e3...` -> `9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5`. PuTTY showed encrypted pre-update backup PASS, Compose updater success, exact SHA readback, clean worktree, six healthy containers. Backup agent's historical R2 journal listed 3 remote-verified backups; current encrypted escrow was downloaded to private Windows storage, decrypted with operator-held passphrase, and its public recipient matched the agent. No real restore or independent current R2 GET was performed.

UI screenshots: manual external-account domains **`vibmail.my` and `pypal.pl`** displayed **Active / routing DNS verified**. The newly created inboxes each displayed a received Gmail test message. For `vibmail.my`, DKIM public value was initially absent; after using `Provision / Repair DKIM` with Cloudflare publishing off, a copyable public DKIM TXT and `DKIM key: ready` were shown. An intermediate screenshot showed DKIM `DNS: missing`. Later domain **DNS verified** is a routing MX+A verdict, not independent all-five-record/DKIM TXT proof. No customer addresses/message bodies or secrets are copied to Git.

**Decision: manual-mode inbound live functional acceptance operator-PASS, feature production-use approved within this observed inbound scope.** It is **not** a formal full product production release GO. Independent DKIM authority, automatic Cloudflare provider gates, TLS/PTR, offsite restore, complete MIME/attachment checks and 17 human review gates remain as documented in [006](006-VERIFICATION-AND-RELEASE-GATES.md). Historical 2026-11-18 evidence above is preserved.

## LIVE-VPS-UPDATE-01 — guarded update and manual acceptance addendum (2026-11-21 UTC)
- Host `vmi3585287` / `173.212.201.250`, `/opt/readbox`. User-approved update `9c3d99d4ec26707c2aec3a5c9ee959dea39dcbb5` → `54e15ddfce5fd824fab89fdb1e2b3100d0b70dde` via verified root-only bootstrap and FF-only Git/Compose. Preflight `AU_R2_PREFLIGHT_PASS`, root-managed V2 archive remote receipt `AU_R2_MANAGED_LOCAL_AND_REMOTE_SHA256_PASS`, independent R05 `R05_ENCRYPTED_BACKUP_PASS`, `QIS01_SAFE_COMPOSE_UPDATE_COMPLETED`.
- **Nuance:** no `AU_R2_UPDATE_HEALTH_PASS` or `AU_BOOTSTRAP_HEALTH_PASS_MANUAL_ACCEPTANCE_PENDING` marker was printed by the automatic updater; stopped Docker CLI process group prevented the original final Prisma check from returning. After operator safely canceled only that verification group, noninteractive `SKIP_MIGRATIONS=true` Prisma `migrate status` independently returned 0 (`postgres:5432`; 8 migrations up-to-date); a separate `POST_UPDATE_HEALTH_CHECK_PASS` confirmed clean target SHA, 6 healthy services, active host backup agent, app live and ready.
- User explicitly confirmed **all five manual acceptance items PASS**: admin login, dashboard/inbox, existing messages/attachments accessible, authorized test mailbox send/receive, logout/login. No account identifiers, customer addresses or message contents copied.
- **Decision:** LIVE-VPS-UPDATE-01 **operationally ACCEPTED/CLOSED on user-provided live evidence**, with automatic CLI suspension recorded as follow-up; this is not an assertion that the original final automated marker appeared. No extra VPS operation is needed for this notes-only documentation phase. Previously observed inbound limits, independent restore requirement and **formal R-06 17-gate NO-GO** remain unchanged. A subsequent notes-only Git commit must be synchronized to source/backup branches but should **not** be applied to the deployed VPS merely to match documentation HEAD.
