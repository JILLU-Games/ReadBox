# BR-003 — Backup/Restore Implementation Phase Ledger

**Baseline:** `0e8a19e583719e56c054406581bedcf5599f1ace`. **Status as of 2026-11-18:** BR-01 code implemented and CI-verified. **Implemented phases:** **1/4**. **Remaining:** **3/4**. The existing live inbound mailserver remains outside this work.

| Order | Phase | Current status | Feature delta | Focused evidence | Commit / publish |
|---|---|---|---|---|---|
| 1 | BR-01 | CLOSED — CI PASS | Admin Backup link, static read-only UI, route gate and tests | [R-06 full CI PASS](https://github.com/JILLU-Games/ReadBox/actions/runs/44186452845) | [`f742231e`](https://github.com/JILLU-Games/ReadBox/commit/f742231e25c5d4969d76cb5ec441b4f23eeddfc8) |
| 2 | BR-02 | NOT STARTED | Host agent, local encrypted backup/verify, durable job/log API | NOT RUN | none |
| 3 | BR-03 | NOT STARTED | R2 config/check/list/upload, scheduling, retention | NOT RUN | none |
| 4 | BR-04 | NOT STARTED | Isolated restore, guarded production restore, rollback | NOT RUN | none |

## Baseline register (before first feature phase)

- Software: `package.json` version `0.1.0`; GitHub prerelease `v0.1.0-rc.1` pinned to `0e8a19e583719e56c054406581bedcf5599f1ace`. Separate release certification remains NO-GO.
- Repository source/mirror parity observed at baseline freeze, not proof of VPS update. `notes/backup-restore/` documents newly planned feature only.
- Currently in Git source: R-05 CLI age encrypted backup+restore/rollback in disposable integration; host legacy scripts; admin operations/audit patterns.
- Operator-provided live VPS observation: Gmail inbound received, services healthy, GPG encrypted local backup created/decrypt-list verified. **No actual isolated restore of this GPG bundle**; these operator observations are not feature-phase PASS.
- Backup **page** implemented in BR-01; host agent, actual backup/R2 integration, scheduled jobs, persistent logs, automatic retention and browser-driven restore: **NOT IMPLEMENTED**.
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

`Planned = 4; Complete = 1 (BR-01); In progress = 0; Remaining = 3 (BR-02–BR-04)`.

**BR-01 is closed** after scoped CI and source/mirror code parity. The next permitted phase is **BR-02**, requiring a separate explicit approval prompt. BR-03 R2 and BR-04 restore remain forbidden until their own phase approvals. Do not mark a phase completed based on creating a Markdown file or assuming code works.

## BR-01 — Phase closure audit (2026-11-18, documentation close)

- **Approved target:** `notes/backup-restore/002-PHASE-ROADMAP-AND-SCOPE-LOCK.md:14–38`. **Implementation parent:** `29c2663cc24c3bb5788932f177ee3bf7f1c1111e`. **Code commit:** `f742231e25c5d4969d76cb5ec441b4f23eeddfc8` (tree `539fd0ac519ae6d43e500f8dabd13c9fd3e30c7c`).
- **Actual code patch paths (exact 5/5):** `src/components/layout/app-shell.tsx` (+2 only); `tests/ui/app-shell.test.tsx` (+5 only); added `src/app/(workspace)/vcon/backup/page.tsx`, `src/components/vcon/backup-console.tsx`, `tests/ui/vcon-backup.test.tsx`. No other code path changed.
- **Exact source anchors:** `app-shell.tsx:14–34` adds `HardDrive` import; `:110–118` appends one `/vcon/backup` nav item; `backup/page.tsx:1–9` calls existing `requireAdminUser()`; `backup-console.tsx:1–158` renders readonly status, 5 compact sections and 10 intentionally disabled buttons; `vcon-backup.test.tsx:1–69` asserts read-only/no-fetch and mocked guard denial.
- **Scope snippet:**
  ```diff
  +  HardDrive,
  ...
       { href: "/vcon/system-update", label: "System update", icon: ArrowUpCircle },
  +    { href: "/vcon/backup", label: "Backup", icon: HardDrive },
  ```
- **One consolidated verification:** [R-06 Actions run](https://github.com/JILLU-Games/ReadBox/actions/runs/44186452845) on exact code commit; consolidated `npm ci`, `npm run db:validate`, `npm run lint` (existing narrow exception), `npm run typecheck`, `npm run test:unit`, `env -u DATABASE_URL npm run test:ui`, `npm run build`, dependency audit, disposable PostgreSQL/SMTP/R05 integration and immutable historical scope gates **PASS**. No new test failures reported; no exact count claimed without a standalone machine-readable test report.
- **Additional code audit:** one `/vcon/backup` nav link, `requireAdminUser()` before page rendering, 10/10 actions disabled, no fetch/subprocess/effects in new UI, non-admin navigation hidden. Git compare `29c2663..f742231`: exact 5 approved changed paths, no deletions or renames.
- **Source/mirror:** code commit synced to `f742231e25c5d4969d76cb5ec441b4f23eeddfc8` with identical Git tree; after this note update, reverify final documentation-commit exact SHA parity. Temporary mirror transport branch successfully cleaned.
- **Impact:** Existing inbox/auth/mailserver/SMTP/DB volumes/Prisma/Compose/UI themes: **no changes**; VPS operations, live sends, backup/restores, credentials, releases and tags: **none**. GitHub CI uses disposable resources only.
- **Known limitation:** UI is intentionally not connected; there is no real job execution, R2 credential, restore or agent installer. Existing R-05 CLI backup remains separate. No actual browser-on-VPS verification yet; source/CI validation only.
- **Error behavior:** existing `requireAdminUser` routing; disabled future actions and explanatory not-configured banner, no new API/backend errors; see `004`.
- **Closure:** `BR-01 CODE/CHECKS PASS, CLOSED FOR SOURCE IMPLEMENTATION`, not full production GO. **Next BR-02 (remaining 3):** separate privileged backup-agent/IPC, local encrypted snapshot + verify, persistent job/logs; BR-03 R2/schedule and BR-04 restore follow separately with their existing Scope Locks. BR-02 may require a narrow existing `docker-compose.yml` Web-only IPC mount, which is additive but an infrastructure integration and must be isolated/tested before production install.
