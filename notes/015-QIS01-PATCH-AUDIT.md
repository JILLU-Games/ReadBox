# 015 — QIS-01 Auto Quick Installer & Browser First Admin Patch Audit

**Date:** 2026-11-17 · **Approved source baseline:** `fa774bd436bf19c35f1cc7d4ad8dfb74a288436a`
**Verified code SHA:** `2833f1f1e1be76d501cdd3fa2210d0c1084d9b47`
**Focused successful disposable CI:** https://github.com/JILLU-Games/ReadBox/actions/runs/44139227363
**State:** **QIS-01 implementation CI VERIFIED**. Not an additional R-phase; the original six planned phases remain 6/6 implemented. **PRODUCTION NO-GO.** No live VPS, DNS/TLS/public SMTP, email sending, deployment, git tag or release.

## Exact 16-file Scope Lock — observed source changes

| Path | Scope-limited change |
|---|---|
| `scripts/install/readbox-install.sh` | New idempotent standalone Docker installer, 0600 private secrets, hashed 1h owner activation, safe rerun, private SQL role setup |
| `scripts/install/readbox-update.sh` | New allowed-source Git ff-only updater, mandatory age encrypted DB/Maildir pre-update snapshot, no destructive automatic migration rollback |
| `docker-compose.yml` | Only append hashed first-owner setup code + expiry to **web** environment; no topology/ports/migrations changes |
| `.env.example` | Document generated credentials/hashed setup code and optional public age recipient |
| `src/core/setup/first-admin-activation.ts` | One-time SHA256 verification using timingSafeEqual, production private Postgres & HTTPS origin guards, existing R04 admin transaction reuse |
| `src/app/initial-setup/page.tsx` | Additive secure browser initial setup route; current admin/legacy superuser disables setup |
| `src/app/initial-setup/actions.ts` | Server action validates environment, origin and owner code, responds with a one-use reset token only over HTTPS action |
| `src/components/setup/first-admin-form.tsx` | New compact first-admin form and second-step existing password-reset action; no existing UI changes |
| `tests/setup/first-admin-web.test.ts` | Real isolated PostgreSQL concurrent admin-once, code/expiry/origin negatives and existing password reset replay |
| `tests/setup/quick-install.test.ts` | Installer/update no-destruction and secret-handling contracts |
| `tests/ui/first-admin-onboarding.test.tsx` | Initial owner/admin form, reset step and success UI |
| `tests/integration/quick-install-compose.test.mjs` | Docker environment isolation/hashed configuration and preserved auth policy |
| `.github/workflows/qis01-ci.yml` | Focused source branch CI; read-only token, disposable PostgreSQL and Compose; no release/deploy |
| `README.md` | ReadBox beginner quick-install discoverability and HTTPS requirement |
| `SECURITY.md` | Activation, private token, existing admins and production no-go boundary |
| `docs/QUICK-INSTALL-AND-FIRST-ADMIN.md` | Full quick-install/first admin/update operator guidance |

Separate approved Markdown closeout: `notes/003`, `notes/006` and this `notes/015` document. **Untouched**: `src/core/auth/**`, existing UI components/routes/nav/colors, `scripts/auth/operator.ts`, `prisma/**`, `deployment/mailserver/**`, reference license notices, actual PostgreSQL/Maildir volumes, DNS and VPS.

## Direct code proof and no-bypass controls

1. `docker-compose.yml` passes only `READBOX_SETUP_TOKEN_SHA256` and `READBOX_SETUP_TOKEN_EXPIRES_AT` into the web environment. PostgreSQL still uses `SERVICE_PASSWORD_DB`; no second DB or extra public port.
2. `scripts/install/readbox-install.sh` generates independent OpenSSL cryptographic secrets, one 256-bit base64url owner code, saves only its SHA-256 digest and 3600-second expiry in a new private 0600 environment. It creates `.env` using atomic no-clobber hardlink; if already present it refuses weak/missing secrets and never rotates values, removes volumes, or injects a default admin password.
3. `src/core/setup/first-admin-activation.ts` requires production+Docker auth, strong app secret, private `postgres:5432`, matching trusted HTTPS request origin/host and constant-time matching digest before calling the **existing** `bootstrapInitialAdminAccount` transaction. That original function refuses an existing `AdminAccount`, legacy superuser or username collision.
4. `src/app/initial-setup/actions.ts` has no public token generator. Only the local owner code can create one initial administrator; the resulting existing `adminResetToken` is returned in an action response (never in a redirect, URL or log), and `FirstAdminForm` calls **existing** `completePasswordResetAction` to set the admin password via the existing password policy and one-time token consumption.
5. After admin creation the initial setup page is inaccessible for new privileged registration while admin exists; an expired/lost code, or failed password-reset step, requires existing local operator recovery.
6. `scripts/install/readbox-update.sh` checks the approved repository origin and a clean Git worktree, requires an independently protected `age1...` recipient, captures a fresh encrypted pre-update snapshot before Git mutation, then fast-forwards with no automatic destructive DB rollback. No live update was executed; backup/rollback safety remains an external acceptance gate.

## Focused disposable CI proof

**CI SUCCESS:** https://github.com/JILLU-Games/ReadBox/actions/runs/44139227363; tested code SHA `2833f1f1e1be76d501cdd3fa2210d0c1084d9b47`. GitHub job has **contents:read** only and runs on the isolated maintenance branch.

| Gate | Observed result |
|---|---|
| npm CI, Prisma validate, source lint with exact historical R-04 two-error baseline, TS typecheck, backend/auth/unit, new QIS static tests, Next production build | PASS |
| Existing UI tests plus new first-admin React component tests | PASS |
| Owner code SHA-256 43-character parity, expiry, private 0600 environment; no plaintext env token | PASS |
| Installer rerun identical .env bytes; no credential rotation | PASS |
| Disposable PostgreSQL 16 migration and first-admin concurrent two-request test | **Exactly 1 privileged admin** |
| Wrong owner token, expired/too-future token, incorrect HTTP/HTTPS origin, wrong private database or missing auth | DENIED |
| Hashed AdminResetToken / existing forced password activation and replay attempt | First PASS, replay DENIED |
| Actual disposable Docker Compose PostgreSQL/web/worker boot, Prisma migrations and Postfix lookup SQL role | PASS |
| Exact branch Scope Lock changed paths | **16/16 allowed** |
| Original R06 production verdict | **NO-GO** |

**CI log proof markers:**

```text
QIS01_APP_AUTH_UI_AND_SOURCE_CONTRACTS_PASS
QIS01_POSTGRES_ADMIN_ONCE_CONCURRENCY_AND_RESET_PASS
QIS01_STRONG_SECRETS_HASH_ONLY_PRIVATE_0600_PASS
QIS01_RERUN_SECRETS_AND_TOKEN_UNCHANGED_PASS
QIS01_DISPOSABLE_REAL_COMPOSE_POSTGRES_WEB_WORKER_PASS
QIS01_EXACT_16_PATH_SCOPE_NO_APP_AUTH_MAILSERVER_MUTATION_PASS
QIS01_RELEASE_REMAINS_NO_GO_PASS
```

The first CI attempt exposed one new `Date.now()` impure-render lint issue in the new initial setup page. That was fixed **only** by removing the impure render check; server-side expiry enforcement remained in `first-admin-activation.ts`. The corrected focused CI passed. The pre-existing two R-04 lint warnings at `src/core/setup/trusted-operations.ts:366,386` remain documented, untouched and excluded only with an exact strict baseline checker.

## Limitations and production NO-GO

- No automatic trusted HTTPS reverse proxy/SSL certificate, DNS, DKIM, public SMTP/port 25 or mailserver profile enablement. Docker web still uses **internal-only** expose 3000. Browser admin activation therefore requires separately configured **trusted HTTPS** or an authorized private HTTPS tunnel; HTTP attempts are refused.
- No zero-downtime automatic update. The update wrapper's static/syntax contract was checked, but no real VPS update, offsite backup or disaster recovery was performed. A local encrypted pre-update backup does not count as independent offsite retention. Database migration rollback may require human review.
- No production user/mailbox data touched. The seven original findings `RB-P0-06`, `RB-P1-09`, `RB-P1-10`, `RB-P1-16`, `RB-P2-01`, `RB-P2-07`, `RB-P2-08` and **all 17 external staging gates** remain OPEN. No independent licensing decision, real delivery test or live server access.
- The existing operator CLI remains a supported first-admin fallback if activation code expired or the first reset did not complete. No unrestricted browser-admin creation is permitted.

**CI implementation complete; separately authorized VPS install still pending. Production release NO-GO.**
