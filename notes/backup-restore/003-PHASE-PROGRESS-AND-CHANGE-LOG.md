# BR-003 — Backup/Restore Implementation Phase Ledger

**Baseline:** `0e8a19e583719e56c054406581bedcf5599f1ace`. **Status as of 2026-11-18:** DOCUMENTATION/FREEZE ONLY. **Implemented phases:** **0/4**. **Remaining:** **4/4**. The existing live inbound mailserver remains outside this work.

| Order | Phase | Current status | Feature delta | Focused evidence | Commit / publish |
|---|---|---|---|---|---|
| 1 | BR-01 | NOT STARTED | Sidebar `Backup`, admin read-only UI skeleton | NOT RUN | none |
| 2 | BR-02 | NOT STARTED | Host agent, local encrypted backup/verify, durable job/log API | NOT RUN | none |
| 3 | BR-03 | NOT STARTED | R2 config/check/list/upload, scheduling, retention | NOT RUN | none |
| 4 | BR-04 | NOT STARTED | Isolated restore, guarded production restore, rollback | NOT RUN | none |

## Baseline register (before first feature phase)

- Software: `package.json` version `0.1.0`; GitHub prerelease `v0.1.0-rc.1` pinned to `0e8a19e583719e56c054406581bedcf5599f1ace`. Separate release certification remains NO-GO.
- Repository source/mirror parity observed at baseline freeze, not proof of VPS update. `notes/backup-restore/` documents newly planned feature only.
- Currently in Git source: R-05 CLI age encrypted backup+restore/rollback in disposable integration; host legacy scripts; admin operations/audit patterns.
- Operator-provided live VPS observation: Gmail inbound received, services healthy, GPG encrypted local backup created/decrypt-list verified. **No actual isolated restore of this GPG bundle**; these operator observations are not feature-phase PASS.
- Backup page, host agent, R2 integration, scheduled jobs, backup UI logs, automatic retention and safe browser-driven restore: **NOT IMPLEMENTED**.
- Production data: do not mutate; original host backup (including plaintext local backup) stays untouched.

## Phase closure record template — append complete entry after each approved phase

### [BR-0N] — [UTC date] — [exact source SHA]
- Scope Lock: original approved paths; any exception approval ID.
- Implementation: precise changed files, user-visible features and deliberate nonchanges.
- Before/after code anchors: exact source line ranges and critical patch excerpts.
- Focused verification: CI run URL, target SHA, test counts, exit codes, negative cases, patch check. Explicit PASS/FAIL/BLOCKED.
- Data safety: backup/DB/volumes/SMTP/secret changes **yes/no**; known downtime **yes/no**.
- Source and mirror: HEAD SHA/tree and parity; scope diff; commit link.
- Error inventory changes: `004` entries updated, if any.
- Actual-working tracker: `005` updated *only* for tested features.
- New bugs/risks: IDs, severity, mitigation; unresolved carry-forward.
- Next phase and remaining count; next Scope Lock reminder.
- Closure: APPROVED/NOT APPROVED with evidence and reviewer; no silent status promotion.

## Milestone counter

`Planned = 4; Complete = 0; In progress = 0; Remaining = 4`.

The next permitted phase is **BR-01**. Do not start BR-02, R2 or restore implementation before BR-01 closes and its UI checks pass. Do not mark a phase completed based on creating a Markdown file or assuming code works.
