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

- **Implemented in repository and disposable CI PASS:** Docker-aware Admin System Update release check, host SHA display and preflight, existing layout retained, secure admin-to-host HMAC Unix RPC, root systemd host bridge, idempotent installer, official main source/mirror parity and pinned target, persistent status with interruption refusal, global backup/restore maintenance lock, R05 encrypted backup before fast-forward, Compose rebuild health gate. See [AU-01 #44246833530](https://github.com/JILLU-Games/ReadBox/actions/runs/44246833530) at \`a466a829b4cabdd7554a81100475037ee5ab393b\`.
- **Legacy host-only ZIP updater:** preserved unchanged; not eligible for Docker web execution. New Docker mode uses a verified source-main SHA, NOT a signed archive release; stable GitHub releases are detected informationally.
- **Operational NOT RUN:** production VPS host bridge install, actual browser-initiated upgrade, full live build/restart, real rollback from a failed production migration, real R2 transfer, public SMTP/TLS changes, tag/release. Source changes alone do not authorize production release.
- **Unchanged:** existing authentication/authorization policy, unrelated UI, Prisma schema/migrations, Postfix/Dovecot/mail handling, Backup/R2 Agent code, age key, secrets, production data and Docker volumes. Production release NO-GO.
