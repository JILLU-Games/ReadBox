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
- Proposed Manual Mode Phase-01: 0/1 implemented, 1/1 pending; one focused verification, exact scope audit, notes log and Git sync after separate explicit approval.
- Full product release status still NO-GO until separately owned remaining independent recovery, legal and release gates pass.
