# 003 — Phase Progress & Immutable Change Log

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c` · **Log initialized:** 2026-11-17 · **R-01 through R-06 IMPLEMENTATION VERIFIED (CI); 6/6 implementation scopes done, final live acceptance BLOCKED.**

## Scoreboard

| Metric | Actual value |
|---|---|
| Total ordered phases | **6** |
| Completed / verified | **6/6 (CI implementation only)** |
| In progress | **0 implementation phases; live acceptance not authorized** |
| Remaining | **0/6 implementation phases; external acceptance gates OPEN** |
| Blocked | **R-06 live staging/release acceptance NOT RUN; production NO-GO** |
| Original forensic findings | **32** |
| Findings verified closed | **25 (CI contract; not live VPS)** |
| Findings OPEN | **7** |
| Next implementation phase | **None (exactly 6/6 implemented); separate staging approval and scope exceptions needed** |
| Final release | **NO-GO** |

## Ordered phase ledger — no results invented

| Phase | Findings | Next feature/bugfix scope | State | CI evidence URL | Source SHA | Mirror SHA |
|---|---:|---|---|---|---|---|
| R-01 | 7 | Production/dev Compose selection; standalone/Coolify secrets; URL-safe DB auth; reproducible image/deps and advisory audit; accurate quick-start documentation. | VERIFIED CLOSED (CI) | https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 | `113663cdabacf1460af5b06a334d99ab3db833c2` | mirror verification pending |
| R-02 | 4 | Single-DB virtual SQL routing with least privilege, migration parity, Maildir owner/UID/GID/ACL consistency. | VERIFIED CLOSED (CI; RB-P2-04 exception) | https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 | `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892` | final ref equality to be verified on mirror |
| R-03 | 6 | Supported Postfix/Dovecot installation/integration, port and socket contract, documented DNS/TLS/DKIM boundaries; inbound-only vs other capabilities explicit. | CI IMPLEMENTATION VERIFIED CLOSED; public TLS/port gates OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810 | `d0f3272ea298de012da83c6f01b588fa0513d1da` | final mirror SHA to confirm |
| R-04 | 6 | First admin setup, consistent user/admin source, worker heartbeat and readiness gates, actionable errors for outages and recovery. | CI VERIFIED CLOSED | https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511 | `88e57e2e81dc07a8f91b07f448df85e51d58e429` | final mirror SHA verification pending |
| R-05 | 6 | Container-aware and host-aware backup/restore, secret protection, downtime consistency, UID/ACL restore, updater repo correctness and rollback. | CI IMPLEMENTATION VERIFIED CLOSED; 2 owned findings OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316 | `a55ec82bb2f58804e910427c66ff6352cd5c14c6` | final mirror SHA pending |
| R-06 | 3 | Final GitHub CI and separately approved staging VPS evidence: real inbound mail, DNS/TLS, runtime integration, negative tests, backup/restore, licensing and formal GO/NO-GO. | CI IMPLEMENTATION VERIFIED; live acceptance BLOCKED, 3 owned findings OPEN | https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624 | `807ca9f38adb02db2a8b73dc0901fce23ee5e63a` | final mirror SHA pending |

## Scope Lock enforcement on every phase

- Record original baseline/current HEAD and compare **all changed paths** with `002` allowlist; deny unrelated changes even if convenient.
- Keep **existing UI/UX, layout, pages, auth rules, business feature behavior, mail data, user accounts and previous migrations** unchanged outside approved findings.
- For shared files, list changed line/range and reason; avoid wide refactors.
- One focused CI run per phase on its actual candidate SHA; do not reuse a prior run or claim future validations passed.
- On an approved phase close: update this log, error handling inventory `004`, actual working features `005` and release gates `006`. Record exact tested/pushed SHA and matching mirror SHA.
- A blocked or failed phase stays OPEN, with blockers; do not automatically start the next.

## Append-only phase completion template

Copy this after a **separately authorized** R-XX implementation; never fill it before testing:

```markdown
### R-XX — [Title] — [YYYY-MM-DD HH:mm Asia/Dhaka]
- State: NOT STARTED / IN PROGRESS / BLOCKED / VERIFIED CLOSED
- Start baseline and current parent SHA:
- Finding IDs closed/remaining:
- Exact allowed paths and changed file list:
- Changed behavior (verified; not anticipated):
- Existing UI/UX/auth/features preserved (test/proof):
- Negative/error handling checks (004 IDs):
- Actual working feature delta (005 IDs):
- One focused CI run URL/job/tested SHA and pass/fail:
- Production/live evidence vs only CI:
- Data/migration compatibility and rollback evidence:
- Source commit/push SHA:
- Target fast-forward and identical tree SHA:
- Completed: N/6; remaining: 6-N; next phase:
- Release verdict and open blockers:
```

## Date-stamped record

**2026-11-17 — Planning/docs only:** the source/target baseline was reconciled, all 32 existing forensic issues assigned to exactly six phases, and this initial progress ledger created. **No bugfix, app behavior change, runtime test, live installation, commit for an implementation phase, or release GO has occurred.**

### R-01 — Deployment foundation — 2026-11-17

- **State:** VERIFIED CLOSED (CI); **completed:** 1/6; **remaining:** 5; **next:** R-02.
- **Code SHA:** `113663cdabacf1460af5b06a334d99ab3db833c2`. **Findings:** RB-P0-01, RB-P1-01, RB-P1-02, RB-P1-14, RB-P1-15, RB-P2-03, RB-P2-09.
- **Implemented:** production Compose made default by renaming dev file; safe DB password URL encoding including `%`, `@`, `#`; auth/database secret length guards; single lockfile Docker runtime and immutable Node base digest; Next.js 16.4.5, fast-uri 3.1.9; correct README and user-requested AGENTS.md workflow policy.
- **Proof:** https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 (focused corrected Docker/runtime, current production npm audit) and https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120 (full original app regression pass). Last correction altered only Dockerfile encoding, its targeted contract test, temporary CI workflow.
- **Preserved:** all `src/`, application UI/UX/layout, user/business logic, existing migrations, Postfix/Dovecot files and data. **Live VPS and SMTP:** NOT RUN; production NO-GO.
- **Mirror:** final SHA equality verified separately after the documentation commit; no release/tag deployed.

### R-02 — Single PostgreSQL / Maildir identity — 2026-11-17

- **Status:** Implemented and focused CI PASS; formal phase closure BLOCKED by `RB-P2-04` because `src/core/health/snapshot.ts` is not R-02 allowlisted. Completed/closed phases remain **1/6**; **5 remain** including R-02.
- **Code commit:** `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`. **Verified CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332. Seven migrations applied twice (second no-op), virtual domain/mailbox/alias responses, invalid/disabled negatives, insufficient privilege negatives, unit/schema and Maildir POSIX checks.
- **Fixed/verified contract:** `RB-P0-03`, `RB-P0-04` and `RB-P1-08` at isolated CI level. Migration parity helper also verified, but the production readiness endpoint still does NOT enforce missing expected migrations (`RB-P2-04 OPEN`).
- **Unchanged:** existing `src/app/`, `src/components/`, auth, UI/UX, original Prisma migrations, mailbox data and unrelated app code. No VPS or external Postfix/Dovecot test.
- **Next decision:** authorize precise health-readiness scope exception or explicitly reassign `RB-P2-04` to R-04 before satisfying R-03 prerequisite. **Overall production NO-GO.**

### R-02 final closure — explicit readiness exception — 2026-11-17

- **Final status:** VERIFIED CLOSED (CI); **completed 2/6, remaining 4**; next phase **R-03** only after separate authorization.
- **Last code SHA:** `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`. **Focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169. Existing R-02 SQL/database CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332.
- **New actual fix:** `src/core/health/snapshot.ts` now validates complete expected Prisma migration history using the existing R-02 helper; pinned seven existing migrations and auto-discovers later checked-in migrations. Missing, unfinished or query-error history returns `not_ready`.
- **Changes permitted by explicit user exception:** only health snapshot plus `tests/admin/phase6-settings-update-health.test.ts` and new `tests/admin/r02-readiness-parity.test.ts`; no UI, auth, app routes, other backend behavior or migration edits. Focused branch audit PASS.
- **Progress:** R-01 7 and R-02 4 findings CI verified = **11/32**; **21** other audit findings OPEN. Live VPS, SMTP/LMTP, DNS/TLS, backup/restore and release not tested. **Production NO-GO**.
- **Final exact mirror:** verify source and target `main` ref/tree SHAs after committing this note; CI run alone is not mirror proof.

### R-03 — Inbound Postfix SMTP → Dovecot LMTP → Maildir — 2026-11-17

- **State:** CI implementation VERIFIED CLOSED. **Completed phases:** 3/6; **remaining:** 3; **next:** R-04 only after separate approval. **Production release:** NO-GO.
- **Tested code commit:** `d0f3272ea298de012da83c6f01b588fa0513d1da`; **one completed focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810. Previous run failed only new static test regex escaping and was corrected without app feature changes.
- **Proven in disposable CI:** fresh PostgreSQL+web/worker runtime, restricted SQL role provision, opt-in Postfix/Dovecot build/start, Postfix/Dovecot lint, SMTP STARTTLS, nonlocal relay reject, invalid local recipient reject, correct delivery to a Maildir file on UID/GID 1001, missing TLS material startup rejection, persisted Postfix queue and exact 13-branch-path audit.
- **R-03 findings:** `RB-P0-02`, `RB-P0-05`, `RB-P2-05`, `RB-P2-06` CI verified; `RB-P1-09`, `RB-P1-10` still OPEN for trusted public TLS, DNS/MX/PTR/port 25/provider/firewall/IPv6 real VPS validation in R-06. **Overall 15/32 CI verified; 17 OPEN.**
- **No out-of-scope changes:** no `src/**`, UI/UX/routes, auth/business logic, database schema/migration, mail data or public DNS mutations. No live VPS or production release. Temporary CI workflow excluded from published source main.
- **Mirror:** final exact source/target SHA and tree equality recorded by git ref verification after docs commit.

### R-04 — First admin/operator parity and fail-closed app/worker readiness — 2026-11-17

- **Status:** CI VERIFIED CLOSED. **Completed:** 4/6; **remaining:** 2 (R-05, R-06); **next:** R-05 only after user approval. **Production release:** NO-GO.
- **Tested code SHA:** `88e57e2e81dc07a8f91b07f448df85e51d58e429`. **Successful focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511. Previous necessary retries addressed CI-only mock UI environment and a 1-ms future heartbeat fixture; the final CI reran successfully without any UI feature edits.
- **Implemented:** manual production-only one-time `admin_accounts` bootstrap with random unusable password and forced reset-token activation; duplicate/admin identity rejection; setup inspector counts the same active superuser source; initially failed ingestion records a degraded heartbeat before exit; app snapshot requires production heartbeat even when env toggles false; unavailable DB, missing/symlink storage, stale/degraded/unknown/future heartbeat fail closed; worker Docker healthcheck validates full application readiness; web liveness separated to avoid deadlock; mailTransport remains explicitly unverified.
- **Proof:** all schema/type/backend tests, UI **70/70**, Next build and real isolated PostgreSQL bootstrap-once/duplicate/inspection and 11-branch-path audit PASS. No production interactive operator CLI, actual SMTP/LMTP outage recovery, VPS or release executed.
- **Scope unchanged:** no login UI/layout/colors, auth credential policy, app routing, unrelated feature, Prisma migrations/schema, Postfix/Dovecot templates or user mail data modification. Temporary CI workflow excluded from published code.
- **Original findings:** R-04's six CI-closed => 21/32 CI verified; 11 other findings remain OPEN, including R-03 external TLS/DNS/VPS gates. Mirror target fast-forward exact final SHA/tree verification after notes commit.

### R-05 — encrypted Compose PostgreSQL/Maildir snapshot, restore, and automatic rollback — 2026-11-17

- **State:** CI IMPLEMENTATION VERIFIED CLOSED; **5/6 phases completed**, **1 remaining (R-06)**. **Production release:** NO-GO. **Code commit:** `a55ec82bb2f58804e910427c66ff6352cd5c14c6`; **focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44121121316.
- **Tested against disposable Compose containers:** PostgreSQL 16 (both `public` and `mailserver` schemas), web/worker and Postfix/Dovecot stand-ins sharing named Maildir/attachments/media/queue volumes. Age public-key encrypted artifact mode 0600, no plaintext config, snapshot manifest SHA-256, restoration of DB+Maildir+attachment+media+Postfix queued file and numeric UID/GID 1001 plus real POSIX ACL. Post-database-apply failure injection triggered **R05_PROVEN_POST_DATABASE_APPLY_AUTOMATIC_ROLLBACK_PASS** and confirmed DB+Maildir prestate; ciphertext tampering refused before mutation. Previously running services restarted; SMTP downtime during backup explicitly disclosed.
- **Existing regressions:** Prisma validation, TypeScript, backend/unit contracts, UI **70/70**, Next.js build, Bash/Python syntax, static operations tests PASS. Exact 14-path branch Scope Lock audit PASS; 13 published paths within R-05 allowlist, temporary CI workflow excluded.
- **CLI and user-facing UI:** no route, UI, auth, schema, Maildir data or Postfix/Dovecot runtime change; production update repo canonicalized while explicit dev test overrides preserved. Host/systemd rollback/upgrade logic was syntax/static verified only, not run on VPS.
- **Findings:** CI-verified `RB-P1-11`, `RB-P1-12`, `RB-P1-13`, `RB-P2-02`; **OPEN** `RB-P2-01` (legacy Nginx and template filenames outside scope), `RB-P2-07` (real offsite retention/rotation/key custody and live VPS/host restore). Project **25/32 verified, 7 OPEN**; public DNS/TLS/SMTP and real release still NO-GO.

### R-06 — Final consolidated read-only CI / production GO-NO-GO — 2026-11-17

- **State:** All **6/6 implementation scopes** are CI verified; R-06 mandatory **live staging acceptance remains BLOCKED/NOT RUN** pending independent user approval. **Original findings:** 25/32 CI verified, **7 OPEN** including R-06-owned `RB-P0-06`, `RB-P1-16`, `RB-P2-08`; **17/17 live staging release gate checks not accepted**, formal **NO-GO**.
- **Tested source SHA:** `807ca9f38adb02db2a8b73dc0901fce23ee5e63a`; **successful focused CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44127481624. Clean npm install, Prisma validate, full backend/70 UI regression, Next build, production npm audit, guarded ephemeral PostgreSQL 16 auth/migrations, disposable production web/worker/Postfix/Dovecot startup, loopback STARTTLS→LMTP→Maildir and reject tests, age encrypted backup/restored UID/ACL and post-DB-apply forced rollback, strict provenance/17-gate negatives and 11-path Scope Lock audit PASS. One bounded SMTP greet startup readiness wrapper was added in R-06 allowed scripts; R-03 mailserver source unmodified.
- **Lint debt:** exactly two pre-existing R-04 unused `catch (err)` violations at `src/core/setup/trusted-operations.ts:366,386`; source excluded **only** from final R-06 lint invocation and validated by strict baseline, no app source edit. **Full-tree lint is not clean.** A prior CI test attempt failed on newly added JS globals; new R-06 code fixed. Another attempt showed a disposable SMTP greeting startup race; bounded startup probe fixed without modifying R-03.
- **Documentation:** release governance, staged acceptance runbook, MIT-vs-AGPL provenance inventory, README/Security warnings, R-06 release gate/negative scripts. Workflow is **read-only with no deploy/tag/release**, and produced expected `R06_PRODUCTION_NO_GO`, `R06_FINDINGS_OPEN=7`, `R06_LIVE_GATE_PASS_CLAIMS=0/17` markers.
- **Preserved:** src UI/UX/auth, migrations, mailserver/SMTP engine, historic LICENSE/NOTICE, actual Maildir/DB data, public DNS/VPS untouched. **No production GO.** Next action is separate explicit authorization for staging acceptance, not an automatic seventh phase.

## QIS-01 — Auto Quick Installer & Browser-first Admin (2026-11-17)

- **Status:** CI IMPLEMENTATION VERIFIED, **not a seventh R-phase**, no live VPS install or production release. **Tested source SHA:** `2833f1f1e1be76d501cdd3fa2210d0c1084d9b47`; **focused disposable GitHub CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44139227363; **Scope Lock:** exact 16 allowed source/config/tests/docs paths. Repo original 6/6 implementation phases and their 32 findings remain unchanged.
- **Actually tested:** fresh private `.env` mode 0600 with independent strong PostgreSQL, auth and Postfix credentials; 256-bit owner code printed only to a private disposable operator output, verified 43 characters with only SHA-256 hash and one-hour expiry persisted. Repeat installer preserved secrets **byte-for-byte**. Real disposable Compose PostgreSQL 16, web and worker booted, Prisma migrations initialized and private Postfix SQL lookup role configured without starting the public SMTP/mailserver profile.
- **Actual disposable PostgreSQL:** two concurrent browser-helper admin bootstrap requests created **exactly one active privileged `AdminAccount`**, not a legacy `User` identity; wrong/expired code and unsafe origins denied. Existing 15-minute admin reset token hashed in DB, password activation completed once, replay rejected, no second privileged account. New browser form UI test passed, existing auth, UI and Next build remained green.
- **Update behavior:** `scripts/install/readbox-update.sh` adds approved-remote/fast-forward and encrypted-backup preflight plus no-destructive-migration-rollback policy. The update script was **syntax/source-contract tested only**; no live upgrades, external/offsite backups or real migration rollback were executed.
- **Existing source preserved:** `scripts/auth/operator.ts`, `src/core/auth/**`, Prisma schema/migrations, Postfix/Dovecot runtime, existing UI/UX/navigation, customer Maildir/DB data. The only existing Compose change is passing hashed setup token/expiry into the web container; no public SMTP, HTTPS, DNS or reverse-proxy provisioning.
- **Existing release position unchanged:** original **25/32 findings CI-verified, 7 OPEN**, R-04 historical two lint errors still recorded; `R06_PRODUCTION_NO_GO` verified in QIS CI. **No VPS access, Git tag/release or deployment performed.**
