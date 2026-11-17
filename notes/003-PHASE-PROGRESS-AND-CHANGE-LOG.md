# 003 — Phase Progress & Immutable Change Log

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c` · **Log initialized:** 2026-11-17 · **No implementation phase initiated.**

## Scoreboard

| Metric | Actual value |
|---|---|
| Total ordered phases | **6** |
| Completed / verified | **0/6** |
| In progress | **0** |
| Remaining | **6/6** |
| Blocked | **0** (not started is not blocked) |
| Original forensic findings | **32** |
| Findings verified closed | **0** |
| Findings OPEN | **32** |
| Next implementation phase | **R-01 — Deployment foundation + reproducibility** |
| Final release | **NO-GO** |

## Ordered phase ledger — no results invented

| Phase | Findings | Next feature/bugfix scope | State | CI evidence URL | Source SHA | Mirror SHA |
|---|---:|---|---|---|---|---|
| R-01 | 7 | Production/dev Compose selection; standalone/Coolify secrets; URL-safe DB auth; reproducible image/deps and advisory audit; accurate quick-start documentation. | NOT STARTED | — | — | — |
| R-02 | 4 | Single-DB virtual SQL routing with least privilege, migration parity, Maildir owner/UID/GID/ACL consistency. | NOT STARTED | — | — | — |
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
