# ReadBox Production Documentation & Planning Index

> **Frozen Baseline:** `v0.1.0-baseline` (Snapshot Date: `2026-11-16`)  
> **Working Mode:** All `6/6` Production Phases Completed & Verified under strict **Scope Lock**.

---

## Document Map (`notes/`)

| File | Purpose | Status |
|---|---|---|
| [`000-BASELINE-FREEZE.md`](./000-BASELINE-FREEZE.md) | Current frozen baseline snapshot (routes, Prisma models, core engines, UI primitives, test scripts, non-negotiable architectural boundaries). | Frozen (`2026-11-16`) |
| [`001-PRODUCTION-FORENSIC-AUDIT.md`](./001-PRODUCTION-FORENSIC-AUDIT.md) | Source-code-verified Forensic Audit Report with exact file paths, line numbers, verbatim code proofs, and per-phase Scope Locks. | Verified |
| [`002-PHASE-ROADMAP.md`](./002-PHASE-ROADMAP.md) | Step-by-step A–Z Phase Roadmap (`Phase-01` to `Phase-06`) with strict IN-SCOPE / OUT-OF-SCOPE boundaries and 1-pass verification gates. | Completed (`6/6`) |
| [`003-PHASE-EXECUTION-LOG.md`](./003-PHASE-EXECUTION-LOG.md) | Live phase completion tracker: completed phases, exact changes applied, remaining phases, and next phase queue. | Completed (`6/6` done) |
| [`004-ERROR-HANDLING.md`](./004-ERROR-HANDLING.md) | Complete inventory of existing error handling across UI, API, Auth, DB, and Ingestion + prioritized gaps to add. | Hardened (`ERR-01`–`ERR-08` done) |
| [`005-ACTUAL-IMPLEMENTS.md`](./005-ACTUAL-IMPLEMENTS.md) | Ground-truth register of features actually working now, features to be upgraded per phase, and remaining gaps. | Updated (`Phase-06` done) |

---

## Mandatory Execution Rules (All Phases)

1. **Scope Lock First:** Only files explicitly listed inside a phase's `IN-SCOPE` section may be modified during that phase. Unrelated features, pages, schemas, and working flows remain untouched.
2. **One-Pass Verification Gate:** Each approved phase is implemented completely, verified **once** (`typecheck` / `lint` / targeted test or `build`), logged immediately in `003-PHASE-EXECUTION-LOG.md` + `005-ACTUAL-IMPLEMENTS.md`, and closed directly.
3. **Component-Only UI Discipline:** Global CSS tokens live only in `src/app/globals.css`; reusable UI primitives live only in `src/components/ui/`. Zero page-local hardcoded CSS/design duplication.
4. **Database & Security Policy:** Single PostgreSQL database via Prisma (`AGENTS.md`). Never expose secrets, weaken auth guards, or strip HTML XSS sanitization.
