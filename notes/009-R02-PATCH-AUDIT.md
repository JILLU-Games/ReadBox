# 009 — R-02 Forensic Patch Audit, SQL Proof and Scope Gate

**Date:** 2026-11-17 (Asia/Dhaka)
**Frozen baseline:** `e28886e5e0f7a155cd64e23bc8ee8f6668d6699c`
**Parent R-01 SHA:** `f4ef1016facf778b8a02d46f8925aaf0584d7a89`
**Verified R-02 executable-code SHA:** `e1efdbd0b0380a94152947f7be47eb17c5c8d70c`
**Focused CI (SUCCESS):** https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332
**Formal phase outcome:** **R-02 implementation and CI contract checks PASS; phase CLOSURE BLOCKED by RB-P2-04.**
**Production mailserver outcome:** **NO-GO.** No live VPS, DNS, Postfix, Dovecot, SMTP or LMTP traffic.

## 1 — Exact Scope Lock audit: what changed

| Exact published code path | Patch | Baseline feature/UI impact |
|---|---|---|
| `prisma/migrations/20261117010000_postfix_login_identity/migration.sql` | New append-only SQL migration creates a dedicated LOGIN role inheriting least-privilege lookup grants. No fixed credential | Existing migrations untouched |
| `src/core/mailserver/pg-adapter.ts` | Pure expected-migration manifest parity checker | Existing lookup API and behavior unchanged |
| `src/core/mailboxes/provisioning.ts` | Fail-closed UID/GID owner check before chmod/provisioning, no automatic chown | Existing Maildir layout and 0700 modes retained |
| `deployment/templates/postfix/pgsql-virtual-{domains,mailboxes,aliases}.cf.tpl` | Configurable DB host/port and fixed restricted `readbox_postfix` login | Postfix not installed by this patch |
| `deployment/templates/dovecot/99-vibmail.conf.tpl` | Numeric UID/GID placeholders instead of assumed `vmail` username | LMTP template only; no running Dovecot |
| `docker-compose.yml` | Web/worker numeric `1001:1001`, Maildir UID/GID policy and a one-shot, profile-only DB credential job | Existing app, worker and postgres services remain; no DB port exposed |
| `tests/postfix/r02-identity-parity.test.ts` | New positive/negative identity and parity tests | New tests only |
| `tests/schema/r02-mailserver-contract.test.mjs` | Schema, template and Compose contract regressions | New tests only |
| `tests/schema/postgres-schema.test.mjs` | Updated expected last migration name | Existing schema test contract only |

**11 published code/test paths touched.** CI branch included a separate temporary workflow, which was **not** published to main. No changes to `src/app/**`, UI/CSS, app auth, other user features, `reference/**`, old migrations, real mail data or host operations. The CI final patch-scope audit passed.

## 2 — Code-level proof

### Least-privilege Postfix login (new migration)

```sql
CREATE ROLE "readbox_postfix" LOGIN INHERIT
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
GRANT "postfix_lookup" TO "readbox_postfix";
REVOKE ALL ON SCHEMA "public" FROM "readbox_postfix";
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "readbox_postfix";
```

The migration stores **no real password**. `docker-compose.yml` contains an opt-in `postfix-db-credential` profile that requires a private secret and uses `psql \getenv` and SCRAM-SHA-256 to set the login credential. Default Compose does not launch this task. Disposable CI provisioned the role credential via PostgreSQL and checked read/deny results, but the Compose one-shot against a deployed web stack has not been separately tested.

### Postfix lookup maps require an explicit reachable DB endpoint

```ini
user = readbox_postfix
password = {{POSTFIX_DB_PASSWORD}}
hosts = {{POSTFIX_DB_HOST}}:{{POSTFIX_DB_PORT}}
dbname = {{PG_DB_NAME}}
```

The former hardcoded `hosts = 127.0.0.1` has been removed from all three templates. R-03 must render a reachable host on the same trusted network and install/connect Postfix. No public DB port was opened.

### Explicit delivery identity, without unsafe chown

```yaml
web:
  user: "1001:1001"
worker:
  user: "1001:1001"
```

Both service environments configure `MAILDIR_UID: "1001"` and `MAILDIR_GID: "1001"`. The provisioning helper checks the current process UID/GID and ownership of existing paths **before** changing mode. Any mismatch stops creation rather than recursively changing ownership or broadening access. Dovecot template's numeric `VMAIL_UID/GID` placeholders must be mapped to 1001 for shared delivery access in R-03.

### Migration parity function is present; existing readiness remains incomplete

```ts
export async function verifyMailserverMigrationParity(
  executor: SqlQueryExecutor,
  expectedMigrationNames: readonly string[],
): Promise<MailserverMigrationParity>
```

The verifier compares actual `public."_prisma_migrations"` rows against expected migration names and returns missing/unfinished details. CI proves it detects synthetic omissions and that seven real migrations apply and repeat safely. **However**, `src/core/health/snapshot.ts:99–110` still checks only unfinished rows. This file is NOT within R-02's `notes/002` allowlist, so `RB-P2-04` is **OPEN** and formal R-02 closure **BLOCKED**. Do not claim the readiness endpoint checks expected history yet.

## 3 — Focused verification evidence (real PostgreSQL, not external mailserver)

| Check | Result |
|---|---|
| npm clean install, Prisma schema validation, TS typecheck | PASS |
| Existing backend unit/contract suites + new R-02 contract tests | PASS |
| Production Compose config, regular service selection and optional credential profile | PASS |
| PostgreSQL 16 disposable database — all seven migrations, repeat migration no-op | PASS |
| Read-only LOGIN role with password, Postfix domain/mailbox/alias view results | PASS |
| Unknown mailbox and disabled domain hidden | PASS |
| Postfix role denied password-hash column, public app users and INSERT | PASS |
| Maildir 0700 directories, owner identity and mismatch rejection | PASS |
| Exact changed-path Scope Lock audit | PASS |
| Mounted/live Dovecot, public Postfix network, SMTP/LMTP | NOT RUN |
| Production `/health/ready` expected migration-history enforcement | NOT IMPLEMENTED / OPEN |
| VPS/Coolify install, backups, TLS and final release | NOT RUN |

**CI URL:** https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332

Earlier attempts stopped on a test-fixture TypeScript environment type mismatch; the correction was constrained to the new Maildir identity helper. The final focused CI run passed; earlier failed runs are not silently represented as successes.

## 4 — Finding status and release blockers

| Finding | Actual R-02 state |
|---|---|
| `RB-P0-03` | CI-config/SQL contract verified; external Postfix-to-PostgreSQL network still UNVERIFIED |
| `RB-P0-04` | App/worker Dovecot identity contract and filesystem safety tests verified; live LMTP mount UNVERIFIED |
| `RB-P1-08` | Dedicated login and least-privilege PostgreSQL test verified; deployed service provisioning UNVERIFIED |
| `RB-P2-04` | **OPEN**; migration parity helper verified but `/health/ready` gate unchanged due Scope Lock |

**Total audited findings:** 32; previously R-01 verified 7. R-02 verified 3 more contracts; **22 remain OPEN**. **Formal completed phases: 1/6**, with R-02 implementation CI-validated but closure BLOCKED.

## 5 — Next step according to the locked roadmap

R-03 is planned to wire real Postfix SMTP/Dovecot LMTP and DNS/TLS; that would not require unrelated application UI changes. However `notes/002` requires R-02 to be verified closed before R-03.

For honest R-02 closure, the user must **explicitly approve** either:

1. A bounded exception for a migration parity-only change in `src/core/health/snapshot.ts` with focused negative readiness verification; **no other UI/auth/code change**; or
2. Reassign `RB-P2-04` to the already documented R-04 health-readiness phase and explicitly accept that it remains OPEN until then.

Without one of these approvals, do not silently edit health code, mark R-02 fully complete, or pretend production mailserver is ready.
