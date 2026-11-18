# 003 — Fresh progress ledger (historical phases separate from active plan)

## Verified history at source freeze

- BR-01: **source/CI complete** prior to `c08b9cd77ec30afc50fe36952eecb982ba90a982`; no new VPS deployment established in this cleanup.
- BR-02: **source/CI complete** at `c08b9cd77ec30afc50fe36952eecb982ba90a982`; offline disposable GitHub checks, not live host install.
- BR-03: **code candidate exists but NOT CLOSED / NOT merged** — `b8f3fc662d384211d4506e40f13859f9cfcb012a`, CI [#44203727204](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) **PASS** with fake S3 R2 and disposable backup/restore. 14 scoped source paths changed vs BR-02; gaps BR03-DEP-01/REL-02/REL-03/OBS-04/SEC-05/OPS-06/DR-07 remain.
- BR-04: **NOT IMPLEMENTED**.
- Actual production deployment/version: unchanged by planning. Real R2 availability: **NOT TESTED**.

## Fresh update phases (do not mistake planned for complete)

| New phase | Status | Main change | Exact approval | Next |
|---|---|---|---|---|
| DOC-01 | CLOSED — DOCS-ONLY SCOPE AUDIT | Source freeze, old development-notes cleanup with Git recovery, new forensic audit, Scope Lock and tracker | This user instruction (notes-only) | P-01 |
| P-01 / BR-03 hardening | CLOSED — SOURCE/CI PASS | Retry/backoff, durable auto-upload, paging, probe-cleanup fault handling, scoped tests | Existing 16 BR-03 source paths only | P-02 |
| P-02 / BR-03 packaging | BLOCKED — SCOPE EXCEPTION | Hash-locked host runtime dependencies; clarify scheduler/timer install; no secret overwrite | New explicit installer/unit permission needed | P-03 |
| P-03 / BR-04 restore | NOT APPROVED | Disposable restore, maintenance lock, rollback and guarded capability, no live restore | Original 19 BR-04 paths, new approval | Production acceptance separately |

**Count after P-01 source closure:** DOC-01 and P-01 completed; P-02 (host packaging exception) and P-03 / BR-04 remain. **No live VPS, R2, production restore or release approval.** Production application code remains on the reviewed BR-02 source tree; a notes-only Git commit advances `main` commit SHA without modifying any code blob. Exact mirror parity of that documentation commit must be checked independently.

## Required per-phase log template

`Phase / approval date / baseline source+mirror SHA+tree / exact files touched / source proof line refs / defect IDs fixed vs open / focused CI run and result / patch audit diff paths / any other UI-feature changes / deployed? / tag/release? / commit and mirror exact parity / next phase / approval command`.

**Current DOC-01 proof:** only `notes/**` paths may be added/updated/deleted. History remains available in prior `c08b9cd77ec30afc50fe36952eecb982ba90a982`. No new implementation, VPS operation, external API, production restore, tag or release occurs in this documentation reset.

## DOC-01 post-publication CI anomaly (source main notes-only commit)

- [BR-02 workflow 44207319955](https://github.com/JILLU-Games/ReadBox/actions/runs/44207319955): **FAIL at fixed BR-02 diff/SCOPE step**, before any BR-02 application test. Its `.github/workflows/readbox-backup-ci.yml:42–71` still expects original 18 implementation paths in cumulative diff from old baseline; this notes-only cleanup cannot satisfy that fixed predicate. **Do not call this proof of a new backup-agent failure**, and do not call all current-main CI green.
- **P-01 fix queued only:** `.github/workflows/readbox-backup-ci.yml` is in existing BR-03 Scope Lock. Adjust workflow for per-phase/notes-only scope without weakening original BR-02 source audit, then run focused CI under separate phase approval. No workflow edit authorized in DOC-01.

## P-01 / BR-03 Hardening — VERIFIED closure, 2026-11-18

- **User authorization:** P-01 / BR-03 hardening, exactly original 16 backup allowlisted paths. **Frozen source+mirror main:** `92c3ced5724a7b7a48cca24856249ee88fed558c`; branch candidate `b8f3fc662d384211d4506e40f13859f9cfcb012a` (original BR-03 14 changed paths, 16 approved). **Hardened tested code SHA:** `e3a3128fd77ec7a9afa88bcf8bad2371c0cf8b93` / Git tree `18dc81fce86f35db2b2a607cfa6333fad1d9f2b0`; **final source code-only merge commit:** `fbffce74040d63f5ea2a70f8e1f04dfcb725ab08` (same **785 non-notes Git blob path:SHA pairs**, new docs remain from latest main). Final docs closure commit is the `main` commit containing this note. Full source/mirror sync proof is the two heads' exact SHA/tree equality.
- **Test:** [GitHub Actions run 44210926362](https://github.com/JILLU-Games/ReadBox/actions/runs/44210926362), conclusion **SUCCESS** on exact hardened SHA, with all 6 substantive scope/dependency/build/safety/R2+BR02/R05 integration steps PASS; no production resources.
- **Changes / problems solved:** `BR03-REL-02` bounded transient R2 retries and fail-closed permanent responses; `BR03-REL-03` persistent autoUpload job intent, atomic resume/claim after interrupted backup, 3 durable attempts with 30s/120s backoff and duplicate suppression; `BR03-OBS-04` S3 continuation pagination, deterministic bounded 30-row UI, fail-closed page-limit/bad token; `BR03-SEC-05` exact health-key deletion attempted even if PUT acknowledgement is lost; `DOC-01-CI-08` historical fixed BR02-diff workflow mismatch replaced with explicit notes-only vs BR03 source branch mode. See `001` original code evidence and `007` test proof.
- **Changed application/config/test paths vs original BR-02 source baseline:** 14 (8 existing modified, 6 new), **all 14 within original 16**; `deployment/backup-agent/executor.py` and `verification.py` allowed but untouched. P-01 targeted hardening from BR-03 candidate edits only `agent.py`, `storage.py`, `r2.py`, `readbox-backup-ci.yml`, `r2-integration.test.mjs`, `scheduler.test.mjs`. Phase closure docs: `notes/backup-restore/003–007` only. No unapproved source paths.
- **Unchanged:** existing login/auth, UI theme, Maildir, PostgreSQL schema/migrations, worker, Postfix/Dovecot, Dockerfile/Compose, R05 recovery, host installer/unit, old encrypted backups, VPS data. No tag, GitHub release, R2 production API, production restore or deployment. A CI-only source success is **not** approval to turn on schedule, prune real archives or claim a disaster recovery drill.
- **Next P-02:** separately approve 2-file exception `scripts/install/readbox-backup-agent-install.sh` and `deployment/backup-agent/systemd/readbox-backup-agent.service` for exact hashed SDK runtime/venv and timer-vs-loop integration, without overwriting secrets or data. **Not implemented; P-02 cannot be silently included in P-01.** P-03/BR-04 restore remains a further separate phase.
