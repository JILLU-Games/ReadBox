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

