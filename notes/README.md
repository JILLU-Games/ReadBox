# ReadBox active development notes — fresh planning index

**Current source + mirror `main` frozen:** `c08b9cd77ec30afc50fe36952eecb982ba90a982` (tree `e7cb8fb8db14046cabaae9b3768267cec0efd095`). **Separate BR-03 CI candidate:** `b8f3fc662d384211d4506e40f13859f9cfcb012a` (tree `413155ee2672f4347c676b23c847997038688ed2`). These are different code states.

## Use these ACTIVE notes for the next update

1. [000 — Frozen baseline and scope rules](backup-restore/000-BASELINE-FREEZE-AND-RULES.md)
2. [001 — Source/code forensic audit and real gaps](backup-restore/001-FORENSIC-AUDIT-AND-PRODUCTION-GAPS.md)
3. [002 — Phased roadmap and exact file allowlists](backup-restore/002-PHASE-ROADMAP-AND-SCOPE-LOCK.md)
4. [003 — Phase progress / verified change log](backup-restore/003-PHASE-PROGRESS-AND-CHANGE-LOG.md)
5. [004 — Existing/new error handling truth table](backup-restore/004-ERROR-HANDLING-INVENTORY.md)
6. [005 — Actual working vs candidate vs missing](backup-restore/005-ACTUAL-WORKING-FEATURE-TRACKER.md)
7. [006 — Security, R2, restore and retention data contract](backup-restore/006-RESTORE-R2-SECURITY-AND-DATA-CONTRACT.md)
8. [007 — Source/CI test matrix and go/no-go ledger](backup-restore/007-VERIFICATION-AND-PRODUCTION-GATES.md)

## Safe cleanup and retained governance

The previous 8 backup-restore development notes were **replaced** with this source-matched planning set. Five unreferenced R-phase patch reports (`008`, `009`, `011`, `013`, `014`) were **deleted from the active tree**; the three externally referenced reports (`010`, `012`, `015`) and the old VPS forensic report were **reduced to short immutable-Git archive pointers**, so existing README/AGENTS/release-doc references still resolve. All full original content remains at the [immutable pre-cleanup Git snapshot](https://github.com/JILLU-Games/ReadBox/tree/c08b9cd77ec30afc50fe36952eecb982ba90a982/notes).

**Do not remove** top-level `notes/000–007` (authoritative R-phase release finding/acceptance ledger referenced from `AGENTS.md`, README and release docs), or `notes/016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md` (linked historical operator observations). These are production governance/evidence, **not superseded or rewritten** by Backup-specific planning.

Documentation cleanup changes only `notes/**`: no app code, installer, workflows, auth, PostgreSQL, Docker, mailserver, deployment, existing backups, credentials, Git tag or release. Git cleanup is a normal forward commit (no force/reset/history rewrite).

**Current phase:** documentation reset / audit. **Next authorized implementation:** NONE until a separately submitted next-phase approval prompt. BR-03 code exists **only on candidate branch**, is CI-tested against mocks/disposable resources, and has unclosed integration blockers; BR-04 is not implemented. Production readiness remains **NO-GO**.
