# 003 — Phase Progress & Immutable Change Log

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c` · **Log initialized:** 2026-11-17 · **R-01 and R-02 VERIFIED CLOSED (CI); 2/6 complete, 4 remain.**

## Scoreboard

| Metric | Actual value |
|---|---|
| Total ordered phases | **6** |
| Completed / verified | **2/6 (CI)** |
| In progress | **0** |
| Remaining | **4/6** |
| Blocked | **0** (R-02 migration readiness gate resolved in CI; production GO remains NO-GO) |
| Original forensic findings | **32** |
| Findings verified closed | **11 (CI contract; not live VPS)** |
| Findings OPEN | **21** |
| Next implementation phase | **R-03 — Inbound SMTP/LMTP mailserver and DNS/TLS** |
| Final release | **NO-GO** |

## Ordered phase ledger — no results invented

| Phase | Findings | Next feature/bugfix scope | State | CI evidence URL | Source SHA | Mirror SHA |
|---|---:|---|---|---|---|---|
| R-01 | 7 | Production/dev Compose selection; standalone/Coolify secrets; URL-safe DB auth; reproducible image/deps and advisory audit; accurate quick-start documentation. | VERIFIED CLOSED (CI) | https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 | `113663cdabacf1460af5b06a334d99ab3db833c2` | mirror verification pending |
| R-02 | 4 | Single-DB virtual SQL routing with least privilege, migration parity, Maildir owner/UID/GID/ACL consistency. | VERIFIED CLOSED (CI; RB-P2-04 exception) | https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 | `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892` | final ref equality to be verified on mirror |
| R-03 | 6 | Supported Postfix/Dovecot installation/integration, port and socket contract, documented DNS/TLS/DKIM boundaries; inbound-only vs other capabilities explicit. | NOT STARTED | — | — | — |
| R-04 | 6 | First admin setup, consistent user/admin source, worker heartbeat and readiness gates, actionable errors for outages and recovery. | NOT STARTED | — | — | — |
| R-05 | 6 | Container-aware and host-aware backup/restore, secret protection, downtime consistency, UID/ACL restore, updater repo correctness and rollback. | NOT STARTED | — | — | — |
| R-06 | 3 | Final GitHub CI and separately approved staging VPS evidence: real inbound mail, DNS/TLS, runtime integration, negative tests, backup/restore, licensing and formal GO/NO-GO. | NOT STARTED | — | — | — |

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
