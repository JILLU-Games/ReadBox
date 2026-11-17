# 012 — R-04 Final Operator Bootstrap and Fail-Closed Readiness Patch Audit

**Date:** 2026-11-17 (Asia/Dhaka)
**Baseline from previous completed phase:** `3ca8ba59c3726390961715db2f1643b76b1c67b0`
**CI-verified R-04 code commit:** `88e57e2e81dc07a8f91b07f448df85e51d58e429`
**Focused GitHub Actions CI SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511
**Phase:** R-04 CI VERIFIED CLOSED · **4/6 completed, 2 remaining** (R-05 and R-06).
**Original forensic findings:** 21/32 CI-verified, 11 OPEN.
**Production release verdict:** **NO-GO** — no real VPS, Internet SMTP, trusted TLS, DNS or backup/restore executed.

## 1. Exact Scope Lock: changed files

| Exact source/test path | Applied patch | Scope |
|---|---|---|
| `scripts/auth/operator.ts` | Explicit `--bootstrap-production` interactive branch, original local-only guard retained otherwise, routed first-admin action to dedicated admin table | R-04 operator-only |
| `src/core/auth/operator-bootstrap.ts` | New one-time transactionally locked `bootstrapInitialAdminAccount` + safe production runtime guard, legacy function untouched | R-04 bootstrap defect only |
| `src/core/setup/trusted-operations.ts` | Inspector checks active superuser `admin_accounts` records, sanitizes raw DB/schema error detail | R-04 verified setup |
| `src/core/health/snapshot.ts` | Require live healthy ingestion in production, deny future timestamps, reject unsafe/unreadable storage, return explicitly app-scoped health and unverified transport field | R-04 readiness |
| `src/workers/ingestion.ts` | First ingestion failure marks a degraded worker heartbeat best effort before rethrowing | R-04 worker error path |
| `docker-compose.yml` | Only worker **healthcheck** changed to require process + `/health/ready`; web healthcheck still independent `/health/live` | R-04 healthchecks only |
| `tests/setup/r04-bootstrap-postgres.test.ts` | Clean disposable PostgreSQL first-admin once/duplicate reject/inspector parity + negative operator environment | R-04 setup tests |
| `tests/setup/r04-worker-status.test.ts` | Worker error heartbeat and Docker healthcheck/static safety contract | R-04 setup tests |
| `tests/admin/r04-readiness-health.test.ts` | Missing/stale/degraded/future heartbeat, DB/storage failure, symlink, recovery and explicit transport boundary negatives | R-04 health tests |
| `tests/admin/r02-readiness-parity.test.ts` | Adjust existing R-02 successful-health fixture to provide a correctly historical fresh worker timestamp | R-04 health test compatibility |

**Exactly 10 executable/config/test paths published**, plus `notes/**` status documentation; the one-time `.github/workflows/one-time-r04-ci.yml` existed on the isolated verification branch only and was excluded from main. **11 changed branch paths** passed exact Scope Lock audit. No user data touched.

**Unchanged:** `src/app/**` UI/routes, `src/components/**`, login layout/colors/screens, credential verification and authorization rules, existing Prisma migrations/schema, mailserver Postfix/Dovecot configs, external DNS, package/lock, third-party sources and user mail data.

## 2. Production first-admin bootstrap — exact code proof

`src/core/auth/operator-bootstrap.ts` creates a **dedicated** `admin_accounts` identity, not the user/administrator-profile identity that the admin login never reads:

```ts
return prisma.$transaction(async (tx) => {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended('readbox-initial-admin-account', 0))
  `;
  if ((await tx.adminAccount.count()) !== 0) return null;
  if ((await tx.administratorProfile.count({
    where: { isSuperuser: true },
  })) !== 0) return null;
  // Conflicting existing user names are also rejected.
  const admin = await tx.adminAccount.create({
    data: {
      username,
      passwordHash,
      passwordResetRequired: true,
      isActive: true,
      isSuperuser: true,
      // firstName, lastName, email omitted from this excerpt
    },
    select: { id: true },
  });
  await tx.adminResetToken.create({
    data: { adminId: admin.id, tokenHash, expiresAt },
  });
  return { adminId: admin.id.toString(), resetToken };
});
```

The password hash is generated from a random unshared secret; the real operator must use the one-time reset token to choose a password through the **existing** admin reset route. No default account/password is inserted at app boot, no authentication bypass, and no email token is automatically sent. The token value is never stored in the database in plaintext.

`src/core/setup/trusted-operations.ts` now recognizes the **same** active, superuser `adminAccount` table; legacy profiles cannot accidentally pass the authoritative admin login verification.

### Operator-only production command (documented, NOT run on a VPS)

After separate deployment authorization, with the existing Postgres running:

```bash
docker compose -f docker-compose.yml run --rm -it --no-deps web node --conditions=react-server --import tsx scripts/auth/operator.ts --bootstrap-production
```

This is a manual explicit action, not default Compose startup. It requires a local interactive TTY, production Docker runtime, enabled auth with ≥32-character secret and the trusted private Compose `postgres:5432` destination. It prints the one-time reset token only to that operator terminal. The command's complete interactive VPS path was **not executed** in this CI; the bootstrap function and guard were tested against disposable PostgreSQL instead.

## 3. Worker heartbeat and readiness — exact code proof

`src/core/health/snapshot.ts`:

```ts
const requiresWorker =
  runtimeEnv.nodeEnv === "production" || runtimeEnv.requireIngestionReady;
const ingestionGateOk = requiresWorker
  ? mailServicesConnected
  : !ingestionDegradedOrStale;
```

Freshness now requires finite, nonnegative age not exceeding the configured timeout. `unknown`, `running`, `stale`, `degraded`, `unavailable` or future-dated heartbeat all fail production readiness; even `REQUIRE_INGESTION_READY=false` cannot bypass this. `mailStorageRoot` and attachment root must be real, readable/writable directories; symlink roots fail closed.

`docker-compose.yml` worker healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pgrep -f 'scripts/mail/ingest.ts' >/dev/null && node -e \"fetch('http://web:3000/health/ready', {signal: AbortSignal.timeout(3000)}).then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))\""]
```

The web container **still uses** `/health/live` as a process startup check. Using `/health/ready` for the web's Docker startup health would create a circular dependency because the worker depends on web startup; we explicitly avoided that deadlock. Therefore **green web container health alone is not production mail readiness**.

The readiness JSON now explicitly says `scope: "application"` and `checks.mailTransport: { verified: false, status: "not_checked" }`. HTTP 200 from `/health/ready` means its app + DB + worker checks pass—not that Postfix SMTP or Dovecot LMTP accept mail. R-06 must verify full transport on a separately authorized VPS.

## 4. Focused CI proof and negative cases

**Successful final CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44112634511.

| Check | Result |
|---|---|
| PostgreSQL 16 service and actual Prisma migrations | PASS |
| npm clean install, Prisma validate, TypeScript | PASS |
| Existing backend unit/contract suites and new R-04 health/setup tests | PASS |
| Existing UI regression | **70/70 PASS** |
| Next.js production build | PASS |
| Actual empty database first-admin: one privileged `admin_accounts`, no ordinary users | PASS |
| Forced password reset, hashed one-time token and duplicate bootstrap rejection | PASS |
| Setup inspector checks that same active superuser source | PASS |
| No heartbeat, stale/degraded/running/future timestamp or failing heartbeat read | Returns `not_ready` |
| PostgreSQL unavailable / unreadable or symlinked Maildir | Returns `not_ready` |
| Healthy heartbeat and real storage/DB recovery | Returns `ready` at **application** scope |
| Worker initial-failure heartbeat / process-plus-app readiness contract | PASS |
| Docker Compose default service configuration and 11-branch-path diff audit | PASS |

The first attempt failed because database-connected CI environment differed from pre-existing UI mock assumptions. A CI-only environment adjustment fixed this. The next run identified a one-millisecond future timestamp in the old R-02 positive heartbeat fixture; we replaced it with an explicitly prior timestamp while maintaining production's future-timestamp rejection. The final run passed all gates; no UI, auth policy or unrelated source changes were needed.

**Exact completed CI markers:** `R04_APP_AUTH_HEALTH_AND_UI_REGRESSION_PASS`, `R04_POSTGRES_INITIAL_ADMIN_ONCE_INSPECTOR_PASS`, `R04_SCOPE_11_PATHS_AND_PRESERVED_UI_AUTH_PASS`.

## 5. Six original R-04 findings (CI contracts)

- `RB-P1-03`: explicit manual production first-admin path creates correct privileged record; interactive VPS operation remains UNVERIFIED.
- `RB-P1-04`: inspector and real admin login identity both use `admin_accounts`; CI VERIFIED.
- `RB-P1-05`: separate web liveness vs worker full readiness; CI VERIFIED.
- `RB-P1-06`: absent/stale/future/degraded ingestion heartbeat cannot report production ready; CI VERIFIED.
- `RB-P1-07`: worker Docker health now depends on actual application readiness and process presence; CI VERIFIED, long-duration recovery NOT RUN.
- `RB-P2-10`: app readiness is explicitly not SMTP/LMTP mailserver readiness; CI VERIFIED boundary, external transport still UNVERIFIED.

**Cumulative:** 21 of 32 findings CI verified; 11 other findings OPEN. Completed phases 4/6; next R-05/06, separately approved. **Production release remains NO-GO**, including unresolved public TLS/DNS/port-25 acceptance, backup/restore, real operator/TLS lifecycle and real outage/recovery evidence.

## 6. Exact next phase

**R-05 — Backup/restore, upgrade and operations safety.** Only the R-05 documented allowed files/contracts may be edited. Verify filesystem/maildir and PostgreSQL data consistency, secret confidentiality, repeatable isolated restore, updater safe rollback and downtime, while preserving current UI/UX/auth and existing mailserver topology. One focused CI gate, forensic diff audit, Markdown update and exact source/mirror SHA equality only after separate user approval.

R-04 does not authorize an EXE/release tag, DNS mutation, public SMTP binding, real VPS operation, production user admin creation or live email sending.
