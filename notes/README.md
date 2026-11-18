# ReadBox — authoritative production-readiness notes index (2026-11-19)

**PRIMARY:** https://github.com/vibtoolshq/ReadBox  
**Inspected immutable main SHA:** `3dfac11f46165c262c3dc5ddb7e82563a56f9a7f`  
**Source tree:** `7a07c6d03588096f88d4aad1b1317f0aa3302bcf`  
**Production GO/NO-GO:** **NO-GO**; original R-01–R-06 implementation **6/6 CI-verified**, seven original release findings **OPEN**, remaining **NEXT-01..NEXT-04 = 0/4 accepted**.  
**Primary backup status:** `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` exact-SHA backup branches missing; neither is the authoritative release source.

## Start here for any new production update

| Order | Document | Purpose / required usage |
|---|---|---|
| 000 | [Baseline freeze & non-negotiable invariants](000-BASELINE-FREEZE.md) | Which current Primary commit/tree is frozen; historic previous freeze retained |
| 001 | [Original 32 findings + current forensic report](001-PRODUCTION-RELEASE-BLOCKERS.md) | Exact code proof, 25 CI-verified and seven OPEN, supplemental current RN issues |
| 002 | [Six completed R phases + four remaining NEXT work packages](002-PRODUCTION-PHASE-ROADMAP.md) | Exact Scope Lock, prerequisites, owner, one-test exit, forbidden actions |
| 003 | [Change log and completed/remaining phase scoreboard](003-PHASE-PROGRESS-AND-CHANGE-LOG.md) | Phase audit SHA, changed files, CI URL, actual next step and status |
| 004 | [Error-handling inventory](004-ERROR-HANDLING-INVENTORY.md) | Existing handling vs additional negative requirements and owner |
| 005 | [Actual working vs CI vs live feature tracker](005-ACTUAL-IMPLEMENTATION-TRACKER.md) | Present capabilities; disposable proof, partial operator evidence and NOT VERIFIED |
| 006 | [Exactly 17 formal release gates](006-VERIFICATION-AND-RELEASE-GATES.md) | PASS/FAIL/NOT RUN, negative/staging proof, rollback and formal NO-GO |
| 007 | [VPS and mailserver contracts](007-VPS-MAILSERVER-CONTRACTS.md) | PostgreSQL/Postfix/LMTP/Maildir paths and identities |

### Subsystem evidence: read without overriding 000–006

- [Backup/restore-specific historical plans](backup-restore/002-PHASE-ROADMAP-AND-SCOPE-LOCK.md) and [backup phase log](backup-restore/003-PHASE-PROGRESS-AND-CHANGE-LOG.md). These concern BR/P/AU subsystem history and may describe prior, **not current Primary** source snapshots; never treat a stale early status row as proof the later patch was not implemented.
- [Operator-provided Nov 18 live VPS acceptance observations](016-LIVE-INBOUND-DEPLOYMENT-ACCEPTANCE.md): one outside-in Gmail inbox, STARTTLS and encrypted local GPG backup **partially observed**, not all 17 gates.
- [Cloudflare DNS/DKIM source and operator contract](../docs/DOMAIN-AUTOMATION.md): source-only CI PASSED, provider/registrar and R2 not independently accepted.
- [Production 17-gate acceptance runbook](../docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md) and [legal provenance](../docs/THIRD-PARTY-PROVENANCE.md): qualified approval still required.
- [AGENTS.md](../AGENTS.md): exact Scope Lock, one focused verification, separate approvals and no silent scope expansion.

### How to read old headings and old CI evidence

Historical records in 000–006 are deliberately kept append-only. The **dated 2026-11-19 CURRENT section at the end** of each top-level file supersedes a stale statement about repository ownership, no past VPS interaction or old completion counts. Do not change the original 32 RB headings or original 17 RG definitions: release-gate parsers depend on exact identifiers. A CI result for JILLU at a different SHA is never automatically Primary main CI.

**Nothing in this documentation update authorizes** application/source changes, DNS or R2 API calls, live mail, VPS operations, production restore, tag, release, or force-push. Approval for the first remaining work package **NEXT-01** must be requested separately.

---

## Archived backup/restore-only index (retained verbatim as historical context)

# ReadBox active development notes — fresh planning index

**Pre-cleanup code baseline (both repos' `main` at audit start):** `c08b9cd77ec30afc50fe36952eecb982ba90a982` (tree `e7cb8fb8db14046cabaae9b3768267cec0efd095`). **Separate BR-03 CI candidate:** `b8f3fc662d384211d4506e40f13859f9cfcb012a` (tree `413155ee2672f4347c676b23c847997038688ed2`). These are different code states.

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

**DOC-01 status:** documentation reset prepared and verified in a notes-only commit; no app source files touched. **Next implementation approval:** a separately submitted P-01 / BR-03 hardening prompt is still required. BR-03 code exists **only on candidate branch**, is CI-tested against mocks/disposable resources, and has unclosed integration blockers; BR-04 is not implemented. Production readiness remains **NO-GO**.

