# ReadBox — Manual Mode, single-feature planning index

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Authority, boundaries and evidence priority

1. Start at [000 frozen baseline](000-BASELINE-FREEZE-AND-CHAT-RECONCILIATION.md) and [001 exact forensic proof](001-FORENSIC-AUDIT-AND-CODE-PROOF.md).
2. [002 one-phase roadmap and exact Scope Lock](002-PHASE-ROADMAP-AND-SCOPE-LOCK.md) is the controlling implementation plan for **Manual Mode Phase-01 only**.
3. [003 progress log](003-PHASE-PROGRESS-AND-CHANGE-LOG.md), [004 error handling](004-ERROR-HANDLING-INVENTORY.md), [005 actual working feature tracker](005-ACTUAL-WORKING-FEATURE-TRACKER.md), [006 focused acceptance gates](006-VERIFICATION-AND-ACCEPTANCE-GATES.md), [007 code patch map](007-EXACT-PATCH-REFERENCE-AND-REGRESSION-MATRIX.md).

This manual-mode project-local **Phase-01** is distinct from historical global R-01–R-06 and NEXT-03/NEXT-04 live-production acceptance work. It does not declare those release gates PASS or restart completed domain setup. Historical top-level notes/000–006 and 017–018 remain preserved; this dated, narrowly scoped index supersedes their earlier statement that the *next Manual Mode implementation* would be NEXT-03 live-domain testing.

## Current frozen status

- Completed and preserved: three **operator/chat-recorded** automatic domain setups and incoming Gmail tests for mailiq.shop, softlo.com and mailvib.com. This is not a fresh independent VPS/R2/SMTP audit.
- Manual DNS path and Cloudflare zone exporter code: PRESENT; dedicated Manual Mode checkbox: MISSING.
- Foreign-owner A/AAAA record in single-zone export: CONFIRMED STATIC RISK. Only modify output for current zone; do not change the underlying shared mail-host resolution.
- Manual Mode Phase-01: 1/1 source implemented, 0/1 source pending; source CI SUCCESS, exact two-backup SHA sync BLOCKED (0/2); no live environment change.
- Full product release status still NO-GO until separately owned remaining independent recovery, legal and release gates pass.

---

## Current verified implementation status

### MM-01 actual implementation and CI evidence — 2026-11-19

- **Source implementation:** [`55ea7dbc97ff78e8c537bfecf3975923639a854b`](https://github.com/vibtoolshq/ReadBox/commit/55ea7dbc97ff78e8c537bfecf3975923639a854b); exact Git tree `e0789807d0b6128e3a60593acc25e03a4b5e1de8`, from previous Primary head `4303b66bfb85f8062bc6cca025f3bbe5d6abfab5`. Exactly **five approved executable/test files** changed: `src/components/vcon/domain-form.tsx`, `src/core/dns/records.ts`, `tests/dns/r03-advisory-contract.test.ts`, `tests/ui/domain-zone-selection.test.tsx`, `tests/ui/vcon-phase3.test.tsx`. No other source, backend, secrets, schema, mailserver, R2 objects or DNS provider operations.
- **Existing read-only CI:** [R06 SUCCESS, run 44576640402](https://github.com/vibtoolshq/ReadBox/actions/runs/44576640402), verification PR [#3](https://github.com/vibtoolshq/ReadBox/pull/3), head `ff48998e8dc0d46c35c433d55ed50f689dcab278` with the **identical complete source tree** `e0789807d0b6128e3a60593acc25e03a4b5e1de8`. Verified npm CI source/lint, TypeScript typecheck, UI unit/Vitest regressions, build, dependency audit, disposable PostgreSQL/SMTP/LMTP/restore, immutable R06 gates; 0 CI failures. PR commit only adds an **empty-tree-delta** CI trigger, not application file modifications. No CI workflow file changed.
- **Focused functionality check:** 53 readback assertions PASS against minimally transpiled, *actual committed* `records.ts` export functions and UI source guards; foreign-zone mail-host A/AAAA owner absent, external MX retained for all three recorded domains on IPv4/IPv6, in-zone owner retained, SPF/DMARC/DKIM TXT and DKIM 255-octet segments preserved. This standalone check is **not** an independent live DNS test or the Node r03 test runner. The newly added `tests/dns/r03-advisory-contract.test.ts` cases were committed and typechecked but were **not separately executed** by the R06 workflow; do not mislabel them as a CLI Node test PASS.
- **Diff/security audit:** compare previous head..source commit gave exactly 5/5 allowlisted paths. Independent source blob readback shows `src/core/dns/domain-automation.ts`, `src/app/(workspace)/vcon/domains/actions.ts`, DKIM API route, DNS download panel and R2 agent-client **unchanged**. Private DKIM keys remain escrow-gated. No Prisma migration or new provider API.
- **Mirror closure BLOCKED:** dedicated `backup/dns-final-primary-20261119` refs in `JILLU-Games/ReadBox` and `MdNurnobi-Dev/ReadBox` were read at `6f3bc1e3aeb441956e1fd0f4d81558a6aba2945f`, **not** `55ea7dbc97ff78e8c537bfecf3975923639a854b`. Primary connector can write only Primary; alternate account can write JILLU-Games but **neither connected account has push permission to MdNurnobi-Dev**. These independent repositories also lack the newer Primary commit objects. Therefore **zero of two backup refs have verified exact latest SHA parity**. No attempt to force-push, rewrite backup history, claim parity, or create misleading unequal-SHA mirror commits. Finish exact **non-force fast-forward git object transfer** with authorized backup credentials and reread both refs; until then status is **SOURCE VERIFIED / EXACT MIRROR SYNC BLOCKED**, not fully closed.
- **Live environment:** no VPS, no real-domain DNS write, no live R2 operation, no deployment, no tag/release. The three preexisting domain successes are still **operator/chat-recorded**, not re-run or independently revalidated by this Phase-01. Original production 7 OPEN findings / 17 independent gates are unchanged; release remains **NO-GO**.

