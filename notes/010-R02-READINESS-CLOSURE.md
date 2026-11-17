# 010 — R-02 Final Authorized Migration-Readiness Closure

**Date:** 2026-11-17, Asia/Dhaka
**Original parent baseline:** `76d1c97f1f07788b28a3205294ebe905110a2125`
**Tested code commit (no temporary workflow):** `b6ab76119a31f9bf4e81b3990a5fcc6d802a6892`
**Focused CI run (SUCCESS):** https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169
**Original R-02 disposable PostgreSQL integration (SUCCESS):** https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332
**Finding:** `RB-P2-04` — expected migration-history readiness
**Verdict:** R-02 **CI VERIFIED CLOSED** (4/4 owner findings), total **2/6 phases closed**. Overall production mailserver remains **NO-GO**.

## 1. Exact approval and Scope Lock

The user explicitly approved a narrowly bounded exception to the originally allowed R-02 paths:

| Actual changed source/test path | Authorized change |
|---|---|
| `src/core/health/snapshot.ts` | Reuse the existing R-02 SQL parity helper in `getReadinessSnapshot`; require complete expected Prisma migration history, fail closed |
| `tests/admin/phase6-settings-update-health.test.ts` | Update only readiness test database mocks to represent successful complete migration history and an existing pending migration |
| `tests/admin/r02-readiness-parity.test.ts` | New focused positive/negative regression for migration manifest and readiness failure cases |

No modifications to `src/app/**`, other routes, `src/components/**`, authentication, unrelated business code, `prisma/schema.prisma`, historical migrations, Postfix/Dovecot config, Compose, Dockerfile, user data or UI/UX. The temporary CI workflow existed only on the test branch; published main has **no** one-time workflow.

## 2. Specific code-level proof

`src/core/health/snapshot.ts` includes a pinned baseline of all seven applied/checked-in Prisma migrations and dynamically discovers additional valid directories under `prisma/migrations/`. It rejects missing/unsafe migration SQL, invalid names or an absent migration root, rather than treating an empty migration list as a healthy database.

```ts
const expectedMigrations = getExpectedPrismaMigrationNames();
const parity = await verifyMailserverMigrationParity(
  createPrismaSqlExecutor(client as PrismaRawQueryable),
  expectedMigrations,
);
migrationsOk = pendingCount === 0 && parity.ok;
```

The helper is **not duplicated or reimplemented**: `verifyMailserverMigrationParity` from `src/core/mailserver/pg-adapter.ts` is reused unchanged. The pre-existing count of unfinished/failed migration rows is preserved as an additional fail-closed condition.

```ts
const ready =
  configuration.ok &&
  databaseOk &&
  migrationsOk &&
  mailStorage.ok &&
  attachmentStorage.ok &&
  ingestionGateOk;
```

The already existing route `src/app/health/ready/route.ts` still returns HTTP 503 for `status: "not_ready"` and HTTP 200 only if *all* checks succeed. No route alteration was needed.

**Runtime artifact:** `Dockerfile` already includes `COPY --from=builder /app/prisma ./prisma`; the checked-in migrations are available at the application root in the existing production image. No Dockerfile edit was authorized or performed.

## 3. Positive/negative focused test evidence

| Scenario | Expected/observed result |
|---|---|
| All expected checked-in migrations complete; other readiness checks healthy | `ready` |
| One expected migration missing, no failed rows | `not_ready` |
| One migration unfinished | `not_ready` |
| A failed/incomplete migration row exists despite the expected completed names | `not_ready` |
| Migration SQL query throws / lookup unavailable | `not_ready` |
| Prisma raw query method unavailable | `not_ready` |
| Migration directory missing, required migration files missing, root symlink or incomplete bundle | Fail closed, not silently healthy |
| Future valid checked-in migration directory | Included automatically in expected list |
| Storage/heartbeat/configuration readiness conditions | Same existing logic (unchanged) |

**Focused CI https://github.com/JILLU-Games/ReadBox/actions/runs/44102834169 SUCCESS:** npm clean install, Prisma schema validation, TypeScript typecheck, **10/10 health/negative tests, 3/3 R-02 parity tests**, Next.js production build, exact four-file test-branch Scope Lock audit including the temporary CI file. **Published code** includes only three listed code/test paths.

R-02's earlier live-*disposable* PostgreSQL migrations, read-only LOGIN role, virtual SQL lookup and Maildir identity tests passed in https://github.com/JILLU-Games/ReadBox/actions/runs/44099280332. These are CI tests, **not** VPS integration.

## 4. State and handoff

- **R-01:** VERIFIED CLOSED (CI), 7 original findings.
- **R-02:** VERIFIED CLOSED (CI), 4 original findings including `RB-P2-04` resolved under an explicitly approved exception. Total CI-verified findings **11/32**, remaining **21 OPEN**.
- **R-03:** NOT STARTED. Next approved phase in `notes/002`: inbound Postfix SMTP, Dovecot LMTP and DNS/TLS integration with real mail routing, bounded to the existing R-03 allowlist.
- **R-04–R-06:** NOT STARTED. No new micro-phase added.

**Unverified:** actual VPS/Coolify install, host Postfix/Dovecot and shared volume delivery, external SMTP and DNS/TLS, end-to-end inbound mailbox receipt, backup/restore or final production GO. These remain future release gates; this code fix alone does **not** make the product production-ready.

**Git synchronization:** the final documentation commit is mirrored by fast-forward (no squash/force) so both GitHub main refs and tree SHAs are equal. Actual identical SHA must be confirmed **after** the sync, not inferred from CI.
