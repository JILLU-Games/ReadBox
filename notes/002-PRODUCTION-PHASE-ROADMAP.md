# 002 — ReadBox Production Bugfix Roadmap (Exactly 6 Scope-Locked Phases)

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`.
**Finding source:** [001-PRODUCTION-RELEASE-BLOCKERS.md](001-PRODUCTION-RELEASE-BLOCKERS.md) and the earlier forensic report.
**Status:** R-01 through R-04 VERIFIED CLOSED (CI); `4/6` completed, 2 remaining. External SMTP/TLS/DNS and disaster recovery still await R-06/R-05 acceptance. Next R-05 requires separate approval. **Production: NO-GO.**

## Implementation sequencing and shared controls

Implement **R-01 → R-02 → R-03 → R-04 → R-05 → R-06** in sequence only after the user separately requests each phase. Dependencies matter; no parallel edits to `docker-compose.yml` or shared runtime modules. The phase list is exactly SIX—no indefinite micro-phases or endless test loops. A new finding cannot silently trigger extra work. Existing features/UI, mailbox data, auth behavior and one-PostgreSQL architecture remain preserved except for precisely documented bugs. Each phase allows one focused CI verification, patch audit, commit, authorized push and mirror-SHA equality check.

## Phase summary

| Phase | Scope focus | Owner findings | Status |
|---|---|---:|---|
| R-01 | Deployment foundation + reproducibility | 7 | VERIFIED CLOSED (CI) |
| R-02 | PostgreSQL/Postfix SQL and Maildir identity | 4 | VERIFIED CLOSED (CI; authorized readiness exception) |
| R-03 | Inbound SMTP/LMTP mailserver and DNS/TLS | 6 | CI IMPLEMENTATION VERIFIED CLOSED; 2 external acceptance findings OPEN for R-06 |
| R-04 | Operator bootstrap and fail-closed runtime health | 6 | CI VERIFIED CLOSED |
| R-05 | Backup/restore, upgrade and operations safety | 6 | NOT STARTED |
| R-06 | Full production acceptance and release governance | 3 | NOT STARTED |

**Total:** 32 finding assignments / 32 unique original IDs; all 32 covered once.

## R-01 — Deployment foundation + reproducibility

**Position:** 1/6 · **Prerequisite:** 000 frozen baseline · **Current state:** VERIFIED CLOSED (CI).

**Owned findings (single owner):** `RB-P0-01`, `RB-P1-01`, `RB-P1-02`, `RB-P1-14`, `RB-P1-15`, `RB-P2-03`, `RB-P2-09`.

**Target behavior:** Production/dev Compose selection; standalone/Coolify secrets; URL-safe DB auth; reproducible image/deps and advisory audit; accurate quick-start documentation.

### Exact Scope Lock — ALLOW

- `compose.yaml (development isolation only)`
- `docker-compose.yml (service selection, env and DB URL interpolation only)`
- `Dockerfile`
- `.dockerignore`
- `.env.example`
- `README.md`
- `package.json`
- `package-lock.json`
- `tests/deployment/** (new focused tests only)`
- `notes/**`

### Exact Scope Lock — DENY

- src/app/** and src/components/** UI/routes
- src/core/auth/** authentication policy
- prisma/migrations/** and schema rewrite
- Postfix/Dovecot SMTP behavior
- unrelated refactoring

### Exit gate (one focused verification)

One GitHub CI focused run with explicit Compose config validation, missing-secret negative test, npm ci, security/advisory evidence and production Docker image build; preserve 237 baseline tests as appropriate.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-02 — PostgreSQL/Postfix SQL and Maildir identity

**Position:** 2/6 · **Prerequisite:** R-01 VERIFIED CLOSED · **Current state:** VERIFIED CLOSED (CI; specifically approved RB-P2-04 readiness exception).

**Owned findings (single owner):** `RB-P0-03`, `RB-P0-04`, `RB-P1-08`, `RB-P2-04`.

**Target behavior:** Single-DB virtual SQL routing with least privilege, migration parity, Maildir owner/UID/GID/ACL consistency.

### Exact Scope Lock — ALLOW

- `prisma/schema.prisma (only documented compatible additions)`
- `prisma/migrations/<new_timestamp>_*.sql (append-only; old files immutable)`
- `src/core/mailserver/pg-adapter.ts`
- `src/core/mailboxes/paths.ts`
- `src/core/mailboxes/provisioning.ts`
- `src/core/mailboxes/service.ts`
- `deployment/templates/postfix/*.cf.tpl`
- `deployment/templates/dovecot/99-vibmail.conf.tpl`
- `docker-compose.yml (PostgreSQL and volume identity sections only)`
- `tests/postfix/**`
- `tests/schema/**`
- `tests/admin/** (only mailbox contract tests)`
- `notes/**`

### Exact Scope Lock — DENY

- new database engine/second database
- old migration edits/rebase
- UI/UX changes and unrelated mailbox features
- live mailbox deletion
- external DNS/public SMTP changes

### Exit gate (one focused verification)

One focused CI integration run on disposable PostgreSQL: migration twice and parity, virtual map valid/invalid queries, Postfix LOGIN role least privilege, representative Maildir UID/GID permissions; no production data.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-03 — Inbound SMTP/LMTP mailserver and DNS/TLS

**Position:** 3/6 · **Prerequisite:** R-02 VERIFIED CLOSED · **Current state:** CI IMPLEMENTATION VERIFIED CLOSED (external trusted TLS/DNS/public port evidence deferred to R-06's explicitly required live staging gates).

**Owned findings (single owner):** `RB-P0-02`, `RB-P0-05`, `RB-P1-09`, `RB-P1-10`, `RB-P2-05`, `RB-P2-06`.

**Target behavior:** Supported Postfix/Dovecot installation/integration, port and socket contract, documented DNS/TLS/DKIM boundaries; inbound-only vs other capabilities explicit.

### Exact Scope Lock — ALLOW

- `docker-compose.yml (mailservice/ingress section only)`
- `deployment/templates/postfix/**`
- `deployment/templates/dovecot/**`
- `deployment/templates/nginx/app.conf.tpl`
- `deployment/mailserver/** (new)`
- `deployment/templates/opendkim/** (new, if signing within approved scope)`
- `src/core/dns/opendkim.ts`
- `src/core/dns/records.ts`
- `src/core/dns/resolver.ts`
- `src/core/domains/service.ts`
- `tests/mailserver/** (new)`
- `tests/dns/** (new)`
- `notes/**`

### Exact Scope Lock — DENY

- new outbound SMTP/IMAP service without explicit approval
- DNS provider API mutations or real DNS credentials
- general UI redesign/auth rewrite
- second DB/schema fragmentation
- live VPS changes without separate authorization

### Exit gate (one focused verification)

One disposable SMTP→LMTP→Maildir integration test including invalid recipient rejection, Postfix/Dovecot config lint, TLS setup and advisory DNS checks. Live public port/MX/PTR remains final staging evidence.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-04 — Operator bootstrap and fail-closed runtime health

**Position:** 4/6 · **Prerequisite:** R-03 VERIFIED CLOSED · **Current state:** CI VERIFIED CLOSED (one clean PostgreSQL, admin/health negatives, existing UI regression).

**Owned findings (single owner):** `RB-P1-03`, `RB-P1-04`, `RB-P1-05`, `RB-P1-06`, `RB-P1-07`, `RB-P2-10`.

**Target behavior:** First admin setup, consistent user/admin source, worker heartbeat and readiness gates, actionable errors for outages and recovery.

### Exact Scope Lock — ALLOW

- `scripts/auth/operator.ts`
- `src/core/auth/operator-bootstrap.ts (bootstrap defect only)`
- `src/core/setup/trusted-operations.ts`
- `src/core/setup/lifecycle.ts (verified setup contract only)`
- `src/core/health/snapshot.ts`
- `src/app/health/**`
- `src/workers/ingestion.ts`
- `src/core/ingestion/service.ts (only heartbeat/error paths)`
- `entrypoint.sh (startup/first-admin handoff only)`
- `docker-compose.yml (healthcheck section only)`
- `tests/setup/**`
- `tests/auth/** (operator case only)`
- `tests/admin/** (health case only)`
- `notes/**`

### Exact Scope Lock — DENY

- change to login UI/layout/colors
- auth bypass/access weakening
- unrelated core auth refactor
- mailserver network redesign
- real user data mutation

### Exit gate (one focused verification)

One focused CI run with clean PostgreSQL and temporary Maildir: bootstrap once, reject duplicate, verify same admin table, broken DB/worker/mail storage fail closed, recovery works; preserve current auth/UI tests.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-05 — Backup/restore, upgrade and operations safety

**Position:** 5/6 · **Prerequisite:** R-04 VERIFIED CLOSED · **Current state:** NOT STARTED.

**Owned findings (single owner):** `RB-P1-11`, `RB-P1-12`, `RB-P1-13`, `RB-P2-01`, `RB-P2-02`, `RB-P2-07`.

**Target behavior:** Container-aware and host-aware backup/restore, secret protection, downtime consistency, UID/ACL restore, updater repo correctness and rollback.

### Exact Scope Lock — ALLOW

- `scripts/ops/backup.sh`
- `scripts/ops/restore.sh`
- `scripts/updater/**`
- `src/core/updates/service.ts`
- `deployment/templates/systemd/**`
- `deployment/operations/** (new)`
- `docker-compose.yml (persistent volumes, health and backup only)`
- `tests/operations/** (new)`
- `notes/**`

### Exact Scope Lock — DENY

- production destructive restore or deleting mail
- modifying source app/UI/features
- mailserver user/SQL schema redesign
- automatically publishing releases

### Exit gate (one focused verification)

One isolated backup→restore→rollback rehearsal with checksums, DB/Maildir parity, UID/GID/ACL and confidential config checks; log any SMTP downtime and recovery.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.

## R-06 — Full production acceptance and release governance

**Position:** 6/6 · **Prerequisite:** R-05 VERIFIED CLOSED · **Current state:** NOT STARTED.

**Owned findings (single owner):** `RB-P0-06`, `RB-P1-16`, `RB-P2-08`.

**Target behavior:** Final GitHub CI and separately approved staging VPS evidence: real inbound mail, DNS/TLS, runtime integration, negative tests, backup/restore, licensing and formal GO/NO-GO.

### Exact Scope Lock — ALLOW

- `.github/workflows/** (new final CI/release gates only)`
- `scripts/testing/**`
- `tests/integration/** (new)`
- `README.md (validated installation instructions only)`
- `SECURITY.md (security disclosure updates only)`
- `docs/** (deployment and provenance evidence only)`
- `notes/**`

### Exact Scope Lock — DENY

- new application features or UI refactor
- new framework major-version migration not required by finding
- unreviewed license deletion or editing third-party reference LICENSE/NOTICE
- live mail send/server changes without separate approval
- releasing/tagging/publishing without explicit final approval

### Exit gate (one focused verification)

One consolidated CI regression/release-gate run plus authorized staging VPS acceptance (external SMTP→LMTP→Maildir→UI, inbound attachments, TLS/DNS/port, auth, worker outages, reboot, backup restore, negative tests); only evidence-backed GO.

**Closure:** One focused test run on phase candidate SHA → patch/diff path audit → preserve baseline UI/routes/auth/data/regression → inspect outcome/negative cases → log CI URL and SHA in `003` → update `004`, `005`, `006` → approved source commit and target fast-forward equal SHA. Any failed gate = OPEN/BLOCKED, never silently continue.

**New issues:** Record forensic proof in `001` as candidate but do not expand the active phase or add an extra phase without explicit scope approval.


## Final release condition

`R-06` must not claim production GO until all `006` gates and outstanding findings have recorded evidence at the actual release SHA plus live staging VPS checks. Existing CI's 237 tests are an initial regression baseline only, not an SMTP deployment proof. Do not run live services, edit source, create tags or publish releases on the authority of this planning document.

### R-01 implementation verification

- The seven R-01 owned findings are CI closed. Source code commit: `113663cdabacf1460af5b06a334d99ab3db833c2`.
- Scoped checks: https://github.com/JILLU-Games/ReadBox/actions/runs/44093204590 (Docker, secrets, npm audit), https://github.com/JILLU-Games/ReadBox/actions/runs/44092311120 (167 unit/70 UI, app build).
- No `src/`, UI/UX, business logic, Prisma migration or mailserver template changes. Next scope: **R-02** after explicit approval.

## R-02 historical scope conflict (resolved by subsequent explicit approval)

- Code SHA: `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`. CI https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332 PASS: repeatable single PostgreSQL migrations; Postfix role positive/negative queries; file ownership and Compose contract checks.
- Exact change allowlist respected. `src/core/health/snapshot.ts` was NOT edited; health migration history check therefore remains incomplete (`RB-P2-04` OPEN).
- Prerequisite to call R-02 VERIFIED CLOSED: explicit approval for a bounded migration-readiness correction in the existing R-04-owned health source, or an approved change to the roadmap assigning that residual finding to R-04. Without that decision R-03 is planned but its R-02 prerequisite is not fulfilled.

## R-02 final closure after bounded exception — supersedes historical BLOCKED state

- User explicitly approved only `RB-P2-04` migration parity enforcement inside `src/core/health/snapshot.ts` and targeted health tests; all other R-02 finding contracts remained unchanged.
- Verified code SHA: `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`. Focused CI: https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 (Prisma validation, TypeScript, 10 health tests, 3 R-02 parity tests, Next production build, file Scope Lock audit). Earlier PostgreSQL integration: https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332.
- All four R-02 findings CI VERIFIED CLOSED; total completed phases **2/6**. Next approved sequence remains **R-03 → R-04 → R-05 → R-06**, requiring separate approval per phase.
- No UI/auth/other feature or old migration changes. Real mailserver/staging GO still **NO-GO**.

## R-03 phase closure and bounded production acceptance deferral (2026-11-17)

- Implemented exactly approved R-03 paths: opt-in Compose mailserver profile; Postfix config/image/renderer and TLS fail-close; Dovecot private LMTP image/config; disposable SMTP→LMTP→Maildir acceptance script; DNS advisory tests and installation contract. **No application UI/auth/source feature or existing database migration changed.**
- CI https://github.com/JILLU-Games/ReadBox/actions/runs/44107205810 SUCCESS, tested patch SHA `d0f3272ea298de012da83c6f01b588fa0513d1da` (published code SHA without temporary CI workflow). Valid sender and real mailbox delivered; unknown recipient/nonlocal relay rejected; STARTTLS and absent certificate negative passed.
- R-03 implementation can close based on its documented exit gate, which explicitly defers **real public TCP/25, MX/PTR and trusted TLS** to R-06 staging. Accordingly `RB-P1-09`, `RB-P1-10` remain OPEN external release gates, not falsely claimed as solved. `RB-P0-02`, `RB-P0-05`, `RB-P2-05`, `RB-P2-06` CI CLOSED.
- **Phases complete 3/6, remaining 3 (R-04→R-05→R-06)**; production GO/NO-GO stays **NO-GO** until external verification. No new micro-phase added.

## R-04 verified closure (2026-11-17)

- Exactly documented R-04 allowlist: CLI bootstrap `scripts/auth/operator.ts`, additive bootstrap helper in `src/core/auth/operator-bootstrap.ts`, setup inspector `src/core/setup/trusted-operations.ts`, snapshot health `src/core/health/snapshot.ts`, ingestion worker initial failure heartbeat, `docker-compose.yml` worker **healthcheck section only**, and narrow setup/admin test files. **No app UI/layout/route, credential authorization policy or unrelated feature edited.**
- Focused CI https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511 SUCCESS; committed code SHA `88e57e2e81dc07a8f91b07f448df85e51d58e429`. Prisma migrations, types, existing unit/backend/UI 70/70, build; real disposable PostgreSQL bootstrap once+duplicate refusal+inspector identity; worker/storage outage negatives and recovery; strict diff audit.
- Production operator bootstrap remains an **explicit interactive one-shot** and never auto-creates insecure default credentials; see `notes/012-R04-PATCH-AUDIT.md` for command and approval boundary. Any live VPS installation and password activation require separate authorization.
- App readiness does **not** measure public Postfix/LMTP acceptability, DNS, TLS or mail delivery; R-06 remains an independent public acceptance gate. **Phases 4/6 completed, 2 remaining (R-05 → R-06).**
