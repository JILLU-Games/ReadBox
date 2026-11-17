# 002 — ReadBox Production Bugfix Roadmap (Exactly 6 Scope-Locked Phases)

**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`.
**Finding source:** [001-PRODUCTION-RELEASE-BLOCKERS.md](001-PRODUCTION-RELEASE-BLOCKERS.md) and the earlier forensic report.
**Status:** Planning only; `0/6` implemented. **Production verdict: NO-GO.**

## Implementation sequencing and shared controls

Implement **R-01 → R-02 → R-03 → R-04 → R-05 → R-06** in sequence only after the user separately requests each phase. Dependencies matter; no parallel edits to `docker-compose.yml` or shared runtime modules. The phase list is exactly SIX—no indefinite micro-phases or endless test loops. A new finding cannot silently trigger extra work. Existing features/UI, mailbox data, auth behavior and one-PostgreSQL architecture remain preserved except for precisely documented bugs. Each phase allows one focused CI verification, patch audit, commit, authorized push and mirror-SHA equality check.

## Phase summary

| Phase | Scope focus | Owner findings | Status |
|---|---|---:|---|
| R-01 | Deployment foundation + reproducibility | 7 | NEXT; NOT STARTED |
| R-02 | PostgreSQL/Postfix SQL and Maildir identity | 4 | NOT STARTED |
| R-03 | Inbound SMTP/LMTP mailserver and DNS/TLS | 6 | NOT STARTED |
| R-04 | Operator bootstrap and fail-closed runtime health | 6 | NOT STARTED |
| R-05 | Backup/restore, upgrade and operations safety | 6 | NOT STARTED |
| R-06 | Full production acceptance and release governance | 3 | NOT STARTED |

**Total:** 32 finding assignments / 32 unique original IDs; all 32 covered once.

## R-01 — Deployment foundation + reproducibility

**Position:** 1/6 · **Prerequisite:** 000 frozen baseline · **Current state:** NOT STARTED.

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

**Position:** 2/6 · **Prerequisite:** R-01 VERIFIED CLOSED · **Current state:** NOT STARTED.

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

**Position:** 3/6 · **Prerequisite:** R-02 VERIFIED CLOSED · **Current state:** NOT STARTED.

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

**Position:** 4/6 · **Prerequisite:** R-03 VERIFIED CLOSED · **Current state:** NOT STARTED.

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
