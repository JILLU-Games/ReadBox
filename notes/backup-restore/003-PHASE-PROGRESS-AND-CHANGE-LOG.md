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
| P-01 / BR-03 hardening | PENDING APPROVAL | Retry/backoff, durable auto-upload, paging, probe-cleanup fault handling, scoped tests | Existing 16 BR-03 source paths only | P-02 |
| P-02 / BR-03 packaging | BLOCKED — SCOPE EXCEPTION | Hash-locked host runtime dependencies; clarify scheduler/timer install; no secret overwrite | New explicit installer/unit permission needed | P-03 |
| P-03 / BR-04 restore | NOT APPROVED | Disposable restore, maintenance lock, rollback and guarded capability, no live restore | Original 19 BR-04 paths, new approval | Production acceptance separately |

**Count after DOC-01 close:** 1 documentation/preparation phase complete; 3 further source phases/packages pending (P-02 requires exception). Production application code remains on the reviewed BR-02 source tree; a notes-only Git commit advances `main` commit SHA without modifying any code blob. Exact mirror parity of that documentation commit must be checked independently.

## Required per-phase log template

`Phase / approval date / baseline source+mirror SHA+tree / exact files touched / source proof line refs / defect IDs fixed vs open / focused CI run and result / patch audit diff paths / any other UI-feature changes / deployed? / tag/release? / commit and mirror exact parity / next phase / approval command`.

**Current DOC-01 proof:** only `notes/**` paths may be added/updated/deleted. History remains available in prior `c08b9cd77ec30afc50fe36952eecb982ba90a982`. No new implementation, VPS operation, external API, production restore, tag or release occurs in this documentation reset.
