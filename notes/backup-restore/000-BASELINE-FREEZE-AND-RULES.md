# ReadBox Backup & Restore — BR-00 Planning Baseline Freeze

**Freeze date:** 2026-11-18 (Asia/Dhaka). **Work type:** forensic review and documentation **only**. **Implementation:** NOT STARTED.
**Immutable audited source commit:** `0e8a19e583719e56c054406581bedcf5599f1ace`; tree `d772ba0d2b111be6bb23104f6804a3ef8818fdf3`.
**At audit start:** `JILLU-Games/ReadBox` and `vibtoolshq/ReadBox` both had this SHA and tree on `main`. `v0.1.0-rc.1` remains an immutable prerelease tag at this SHA. Later documentation commits do **not** imply a new deployed version, tag or production GO.
**Audit basis:** actual GitHub Git tree (779 blobs, 1,029 tree entries); opened source files and compared code at the SHA, rather than relying on legacy Markdown alone. Previously supplied VPS command output and screenshots are *operator observations*, not a new live VPS probe.

## Goal and exact boundary

Add a compact professional `System & Settings → Backup` page and host-managed local encrypted snapshots, verification, manual/automatic schedules, Cloudflare R2 connection/configuration, upload/history, job logs/copy, isolated test restore and protected production restore. **No unrelated feature, visual design, authentication behavior, mail transport, mail database contents, current app deployment, TLS, DNS, repo release or existing backup is to be changed during this documentation phase.**

## Strict documentation-only change allowlist

Only **new Markdown paths** in `notes/backup-restore/000–007`. Do not edit or replace `notes/000–016`, old audits, application source, Compose, migrations, workflow, GitHub release, tag or VPS state. Existing historical documentation is immutable audit evidence; this new series is the prospective feature source of truth.

## Non-negotiable future implementation rules

1. Four scope-locked phases `BR-01` through `BR-04` in `002`; explicitly named paths only. No silent edits outside each phase's allowlist. New needs require documented scope exception **before** coding.
2. After each phase: one focused verification suite, regression and patch audit, then update `003`, `004` when errors change, `005` and `007`; commit and source/mirror parity check. No repeated test loops; test failures are recorded, never relabeled PASS.
3. Existing Web container runs non-root UID:GID `1001:1001`; never give Web the Docker socket or root capability. Privileged operations run in a separate constrained host agent with allowlisted actions and durable status.
4. Existing `deployment/operations/compose_recovery.py` is a **read-only reusable source reference** in this plan; no rewriting it by default. Production restores require explicit superuser approval, rollback artifact, correct format, preflight, host-side execution, maintenance and postconditions. No restore of production during CI.
5. Default `Automatic backup = OFF` and `R2 = NOT CONFIGURED` until actual install, credential setup and successful verification. Uninstalled agent must not break existing ReadBox pages or user inbox.
6. Preserve original database schema/migration files, auth/session behavior, SMTP/LMTP, Maildir UID/GID ownership, subscriptions, UI colors/layout and existing runtime values unless an explicitly scoped safe additive integration is listed.
7. Backup **data** and backup **host config / secret recovery** are different contracts. Never claim full disaster recovery without both and an isolated restore. Never put credentials, plaintext secrets, PII-rich logs, keys or archive contents in GitHub.
8. No stable release or deployment from planning. Existing seven historical R-06 blockers and 17 acceptance gates are not silently closed by new backup docs.
9. All release/test and copy evidence must reference exact SHAs; never assume a documentation-only HEAD has already reached a VPS.
10. Source and mirror `main` should be kept exact-SHA synchronized for this docs commit if permission mechanisms allow; no force push.

## Planning-document index

- `001-FORENSIC-AUDIT-AND-PRODUCTION-GAPS.md` — source proof, real mismatches and classifications.
- `002-PHASE-ROADMAP-AND-SCOPE-LOCK.md` — every phase's exact paths and code anchors.
- `003-PHASE-PROGRESS-AND-CHANGE-LOG.md` — progress, implementation claims and phase closure ledger.
- `004-ERROR-HANDLING-INVENTORY.md` — observed handlers and proposed fail-closed errors.
- `005-ACTUAL-WORKING-FEATURE-TRACKER.md` — confirmed existing, operator-observed and unimplemented.
- `006-RESTORE-R2-SECURITY-AND-DATA-CONTRACT.md` — privileged agent, snapshot and R2/restore contracts.
- `007-VERIFICATION-AND-PRODUCTION-GATES.md` — test cases, pass criteria and release gates.

**Source link:** https://github.com/JILLU-Games/ReadBox/tree/0e8a19e583719e56c054406581bedcf5599f1ace
