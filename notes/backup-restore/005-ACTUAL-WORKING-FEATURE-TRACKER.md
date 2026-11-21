# 005 — Feature truth table by exact source state

| Feature | Actual MAIN at `c08b9cd77ec3` | BR-03 CANDIDATE at `b8f3fc662d38` | VPS / real R2 |
|---|---|---|---|
| Existing Inbox/auth/navigation/mailserver | Existing sources preserved | Unchanged by 14-path BR-03 patch | NOT retested here |
| Admin Backup route / admin guard | Exists (`page.tsx`) | Unchanged route | Agent on VPS NOT tested |
| Local age encrypted backup | BR-02 source+CI | Existing code retained; disposable regression PASS | Not installed by this work |
| V2 local age verification / job logs | BR-02 source+CI | Retained, disposable PASS | Live status unknown |
| R2 credential form/rotation | Not implemented | `actions.ts`, `backup-console.tsx`, `r2.py` | Real account **NOT TESTED** |
| Encrypted host R2 configuration AESGCM | Not implemented | `r2.py` source + mock test | Host runtime dependency gap OPEN |
| R2 test (list/PUT/GET/DELETE own probe) | Not implemented | Mock test PASS, TLS derived account endpoint | Real connection not verified |
| Manual V2-verified age upload to R2 | Not implemented | R2 fake S3 test PASS incl remote streamed SHA256 | Not deployed |
| Remote history | Not implemented | Owned prefix first 100 objects, return up to 30 | Pagination missing |
| Automatic backup UTC schedule | Not implemented | default OFF, 6/12/24h; in-process 15s tick mock test | Timer not installed; real host untested |
| Auto R2 upload after local backup | Not implemented | Best-effort enqueue; durable handoff gap | Not accepted |
| Local retention | Not implemented | Optional local-only, default OFF; >=3 local, verified remote prerequisite | Real safety untested |
| Remote R2 retention/deletion | Not implemented | **NOT IMPLEMENTED — no bulk/delete-by-prefix** | Not approved |
| R2 upload bounded retry/backoff | Not implemented | **NOT IMPLEMENTED** | Blocker |
| UI test restore | Not implemented | Not implemented; buttons disabled | BR-04 only |
| Guarded production restore | Not implemented | Not implemented; buttons disabled | **NOT AUTHORIZED** |
| GPG legacy conversion | Not implemented | Not implemented | Existing encrypted GPG ≠ age format |

**CI evidence:** [#44203727204](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) tests pinned SDK installation, frontend/auth/UI lint+typecheck+build, fake R2 failures, UTC schedule tests, disposable BR02 encrypted snapshot and R05 restore/rollback. **No live Cloudflare bucket or VPS probe.** Source/main and mirror were both `c08b9cd77ec30afc50fe36952eecb982ba90a982` at audit time; candidate is not merged.

**User-facing benefit after accepted/deployed BR-03 (future):** UI-driven R2 offsite encrypted backup without manual WinSCP. Do **not** promise until dependency install, resilience and R2 operator verification are explicitly completed.

## P-01 final source+CI truth update (supersedes frozen candidate-only columns above)

- **BR-03 R2 source integrated into next code baseline:** exact hardened candidate `e3a3128fd77ec7a9afa88bcf8bad2371c0cf8b93`, test tree `18dc81fce86f35db2b2a607cfa6333fad1d9f2b0`. Published app code commit `fbffce74040d63f5ea2a70f8e1f04dfcb725ab08`, whose non-notes blobs **785/785 match** the CI-tested candidate. [P-01 GitHub Actions PASS](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362).
- **Working in source/disposable CI only:** existing BR02 manual encrypted backup and V2 verification; admin R2 config/encryption/rotation, mocked connection test, owned health probe, V2-only upload/remote hash and history, UTC scheduling default OFF, local retention guard; now transient max3 retry, remote pagination with explicit 25-page fail-closed limit, crash-safe durable autoUpload and duplicate/budget guard. Existing R05 disposable recovery/rollback PASS.
- **Not working/proven on actual VPS:** R2 SDK host install; existing service still starts `/usr/bin/python3` without installing required packages. Real R2 test, real bucket remote files, timer installer, independent private-key custody, hosted download/restore and production offsite disaster recovery are **NOT RUN**. Original GPG file is not an age bundle. **P-02 exception required before host use**.
- **No other feature touched:** login/permissions, Prisma schema/migrations, mailserver, worker, REST restore controls and unrelated UI unchanged; publication uses source/mirror exact Git parity. No tag/release/deploy.

## P-02 actual host-packaging source implementation (2026-11-18)

- **Source code added:** version-addressed `/opt/readbox-backup-agent/releases/<lock digest>` CPython-3.12 venv; `python -m pip --isolated install --require-hashes --only-binary=:all:`; mode 0700 root-only release tree; SHA256 lock marker; `pip check` + explicit dependency imports; current symlink atomic switch and legacy BR-02 exact unit migration; idempotent same-SHA reuse; live-job/maintenance lock refusal; rollback of link/unit on failed activation. `deployment/backup-agent/systemd/readbox-backup-agent.service` executes `/opt/readbox-backup-agent/current/bin/python`, not system-wide Python. Existing `requirements.lock` content unchanged and reused.
- **Scheduler:** agent.py in-process 15s UTC poll is authoritative; optional `.timer` is **not installed or enabled**. No duplicate service-start timer. Schedule itself remains default OFF; manual backups unchanged.
- **Still not proven/activated:** no VPS installer run; R2 credentials, bucket, real uploads, offsite key custody, real service startup and rollback are not live-verified. Future operational acceptance must be separately approved. Existing BR-04 restore remains disabled.
- **Other features:** auth/admin route/UI theme, mailserver, Docker Compose, Prisma schema, mail data, age identity, original backup archives untouched. `AGENTS.md` rules are the only explicitly approved non-host source change.


**P-02 CI:** [Verified SUCCESS #44215136163](https://github.com/JILLU-Games/ReadBox/actions/runs/44215136163). Versioned Python runtime is implemented in installer source; actual VPS activation, rollback and R2 API are NOT RUN.

## BR-04 implemented source vs actual working (2026-11-18)

- **On source:** Admin UI can choose a managed local V2 backup and run decrypt/metadata Test restore without modifying services; `Restore backup` is disabled by default, and only becomes available when host operator root-only gate is externally set. One-time 90-second actor-bound hashed permit and exact backup-specific typed phrase are required before queueing.
- **On host agent source:** replay-resistant confirmation, fixed-path encrypted input and root-only rollback `/var/backups/readbox-managed/restore-rollback/<job>.age` preserved on failure, R05 automatic rollback, persistent job history, sanitized activity and manual review after interrupted/critical outcomes. No new PostgreSQL migration or custom restore engine.
- **Legacy:** GPG `.tar.gz.gpg` files remain **unsupported** by this age-only source restoration. No import/conversion was attempted.
- **Evidence pending:** focused disposable CI and final source/mirror parity; do not claim production operations or field readiness from source. Actual VPS gate is **NOT created**, production data NOT restored, R2 not used.
- **Unchanged:** main app feature/UI layout, auth policy, mailserver, database schema, worker, existing BR03 backup/schedule/R2 engine, original R05 file and original installer.

## P-03 final source-versus-production truth (supersedes CI pending note)

- **Source + disposable CI PASS:** tested `d4cc3ca386d64e9f9a3329b757881a280cb63a0e`; [BR04 #44222091348](https://github.com/JILLU-Games/ReadBox/actions/runs/44222091348). Implemented read-only deep test preflight, admin-gated restore confirmation, 90s actor-bound one-time permit, immutable local V2 age checks, fixed R05 rollback wrapper, encrypted rollback retention, critical failure journal, mutually exclusive updater, legacy GPG rejection.
- **CI limit:** BR04 child-invocation/failure negative tests use mocked subprocess; the original R05 end-to-end PostgreSQL/Maildir/queue/ACL/UID recovery is independently run in disposable CI. No combined production web-to-restored-host acceptance is claimed.
- **NOT LIVE VERIFIED:** actual VPS installer or systemd rollback, real R2 API, host-loss/private age-key custody, live restore, root operator gate activation. Existing auth/UI outside Backup panel, Prisma, R05 engine, BR03 agent/R2/scheduler, mailserver, production data untouched. Stable release **NO-GO**.
## PA-01 CI-Ready source, disposable runner and live distinction

- **Implemented and tested SHA:** `4aab358ec40f67cd37fc581f51266eb2a79d712a`, [PA01 CI #44230645414](https://github.com/JILLU-Games/ReadBox/actions/runs/44230645414) **SUCCESS**. Disposable host installer creates hash-pinned isolated Python runtime, root-only age key, systemd unit and HMAC Unix socket. Rerun is idempotent, restart readiness is bounded/authenticated, global lock refuses unsafe concurrent operation and injected failed update restores previous runtime/service.
- **Security regression:** existing mock R2 list/probe/upload/retry checks, backup scheduler, legacy GPG rejection, BR04 default-deny guard/one-time permit and IPC negatives PASSED. Original R05 fixture restores synthetic PostgreSQL public/mailserver schemas, Maildir, attachments, media, Postfix queue and numeric UID/ACL from encrypted age; independently escrowed key works after synthetic source archive and Docker volumes are deleted; wrong key fails; injected rollback restores prestate.
- **Not implemented/accepted by this phase:** automatic R2 import into Admin restore, real Cloudflare API, real independent key escrow storage, VPS update/reboot/data recovery, live production restore or formal RG-14. Existing production app, web UI/auth, Prisma schema, Postfix/Dovecot and R05 engine unchanged. **Production NO-GO.**

## AU-01 update feature — implemented versus live

- **Implemented in repository and disposable CI PASS:** Docker-aware Admin System Update release check, host SHA display and preflight, existing layout retained, secure admin-to-host HMAC Unix RPC, root systemd host bridge, idempotent installer, official main source/mirror parity and pinned target, persistent status with interruption refusal, global backup/restore maintenance lock, R05 encrypted backup before fast-forward, Compose rebuild health gate. See [AU-01 #44246833530](https://github.com/JILLU-Games/ReadBox/actions/runs/44246833530) at `a466a829b4cabdd7554a81100475037ee5ab393b`.
- **Legacy host-only ZIP updater:** preserved unchanged; not eligible for Docker web execution. New Docker mode uses a verified source-main SHA, NOT a signed archive release; stable GitHub releases are detected informationally.
- **Operational NOT RUN:** production VPS host bridge install, actual browser-initiated upgrade, full live build/restart, real rollback from a failed production migration, real R2 transfer, public SMTP/TLS changes, tag/release. Source changes alone do not authorize production release.
- **Unchanged:** existing authentication/authorization policy, unrelated UI, Prisma schema/migrations, Postfix/Dovecot/mail handling, Backup/R2 Agent code, age key, secrets, production data and Docker volumes. Production release NO-GO.

## AU-01/UI-01 — Current displayed features

- **CI UI regression verified:** the Docker System Update header renders `vibtoolshq/ReadBox` and the Up-to-Date dialog displays the same 12-hex host SHA as the installation card. Existing stable/systemd channel continues to display its configured repository and semantic package version. A missing source SHA is labelled `Unknown`.
- The test is `tests/ui/vcon-system-update-ui01.test.tsx`, covered by the successful R06 consolidated app/UI step [#44258286499](https://github.com/JILLU-Games/ReadBox/actions/runs/44258286499) on candidate `3e8be000174de39d290bfcaec3778e1fc56d085a`. Code/test/docs diff confined to four approved paths.
- **NOT LIVE VERIFIED by UI-01:** rebuilt VPS image, new Admin Panel rendering after future deployment, browser-triggered update, production migration and rollback, any R2 or restore work. AU-01 pre-existing live host preflight was user-observed before this UI-only source correction.

## AU-02 — Feature state and acceptance boundary (2026-11-18)

- **Source marker implemented/CI verified:** documentation-only immutable Git change provides a detectable change for the existing Docker `main`-SHA update discovery. [R06 CI #44261893409](https://github.com/JILLU-Games/ReadBox/actions/runs/44261893409) at `cd9c67a0b22893df600186dd2812083e0bd64ca0` succeeded.
- **Already operational before AU-02:** previous user-observed Admin System Update UI showed `Ready (17/17)`, canonical `vibtoolshq/ReadBox`, current SHA `2ff76300c3e8`, and Up-to-Date modal. That does **not** establish completed browser-triggered upgrade.
- **Not yet run at this ledger update:** new SHA discovery in production, browser confirmation, encrypted live pre-update backup, browser-driven Docker rebuild, and durable end-state acceptance. These require operator-collected evidence in the current conversation; do not mark them PASS based solely on repository CI.
- Nothing was implemented in application/UI/host updater in AU-02. Existing live data, auth, Prisma, Postfix/Dovecot, R2 config, encrypted identities and volumes remain outside source Scope Lock.

## AU-R2-UPDATE-01 — actual working versus source candidate (2026-11-20)

The existing deployed Backup page and R2 integration were **NOT changed or tested live**. The new one-command runner remains on implementation branch, not Primary. A previous hosted R2 record is not a fresh remote proof. Mocked existing agent V2 create, verify, upload, invalid/missing receipts and remote refusal passed in CI recheck; isolated shell test fixture failed, and final fix remains untested. No current new automated VPS update, manual acceptance or production release is claimed. Existing encrypted archives and R2 objects preserved.

## AU-R2-UPDATE-01 — actual feature report after successful focused CI (2026-11-20)

The source code candidate is **CI-VERIFIED** at exact executable SHA `3f377dd6836c9726492eaaade451895c9595b9b4`, [run #44827143074](https://github.com/vibtoolshq/ReadBox/actions/runs/44827143074) SUCCESS (10/10 focused tests). The previously noted missing ROOT fixture failure is resolved. The new root-only script does not modify the existing deployed Backup page; it requires fresh managed V2 age backup and existing R2 remote checksum proof as mandatory future operator update gate. **No new VPS command executed, no real R2 connection tested, no independent offsite restore, no new live backup.** Final 3/3 publication readback remains pending.

## AU-R2-BOOTSTRAP-01 — actual backup/update behavior limit (2026-11-20)

A new canonical fetch + root-only external staging bootstrap is source present on a private implementation branch, not on Primary or any live host. Existing BR-02/03/04 backup/R2 agent SDK, encryption identity, R2 objects, jobs and recovery data were not altered. Required V2 and R2 receipt gates remain in guarded updater. CI #44831164135 passed 13/14 focused tests but failed an old static string assertion; no final green regression. There is no new VPS snapshot, Cloudflare R2 upload, migrated database, post-update health or manually accepted update evidence. Formal source closure withheld.

## AU-R2-BOOTSTRAP-01 — corrected feature evidence, source-only (2026-11-20)

Source-only bootstrap, immutable staging and canonical Primary pinned fetch are **CI-VERIFIED** by [#44832329196](https://github.com/vibtoolshq/ReadBox/actions/runs/44832329196) at `f6fceeafc5933b1fdb8327e2589be825183bd5a9` with 14/14 passing tests. The original R2 agent, remote encrypted object and PrivateStore contract were not edited. The previously reported 13/14 failure was a stale literal fixture and is superseded. **Not live verified**: original VPS checkout clean state, root-only service/agent permissions, real backup/R2 remote checksum, database migration, mail/attachment reception, actual health or manual operator acceptance. Formal R-06 NO-GO unchanged.

## OPS-CMD-FIX-01 — actual backup/R2 evidence boundary (2026-11-20)

Published operator shell example has corrected nested quoting; focused CI [#44836416395](https://github.com/vibtoolshq/ReadBox/actions/runs/44836416395) tests mocked sudo argc=5, inner shell parser and EXIT trap cleanup on both success/failure. This fixes an operator-documentation bug only. Existing managed V2 archive/R2 service, private key, remote objects, scheduler and restoration were not modified or exercised. Actual VPS environment, fresh offsite checksum receipt and operational acceptance are NOT RUN.

## AU-PRISMA-CLI-01 — verified source boundary (2026-11-21 UTC)
The guarded updater's read-only Prisma status now invokes `./readbox-start.sh` with `SKIP_MIGRATIONS=true`, preserving existing protected database, agent, encrypted archive and R2 behavior. CI [#44844643775](https://github.com/vibtoolshq/ReadBox/actions/runs/44844643775) PASS (16/16 tests, syntax, TypeScript, no-deploy marker); no VPS update, production migration, fresh managed V2 backup or remote checksum was run. P1001 incident is source-addressed but still needs separately approved live acceptance; no stable release readiness claim.

## LIVE-VPS-UPDATE-01 — implemented runtime versus post-update verification (2026-11-21 UTC)
- **Existing code deployed, no new source edits in closure**: pinned `54e15ddfce5fd824fab89fdb1e2b3100d0b70dde`, clean main. The authenticated managed V2 create/verify + R2 remote checksum receipt gate ran and passed before immutable non-force update; R05 snapshot then ran and passed. Existing backup agent remains `active`; PostgreSQL/web/worker/postfix/dovecot/dkim-provisioner healthy at operator readback.
- Original post-update migration status did not complete automatically because suspended terminal Docker client processes; no automatic success marker. Operator cleared only stopped CLI process group and verified with non-interactive foreground read-only Prisma status (8 up to date, exit 0) and consolidated app/agent health PASS; accepted five manual UX/mail cases.
- No host restore, archive deletion, R2 object mutation beyond approved upload, recipient/key modification or extra production migration under this closure. Notes-only publication does not deploy a new binary/source SHA to VPS. Formal R-06 remains NO-GO.
