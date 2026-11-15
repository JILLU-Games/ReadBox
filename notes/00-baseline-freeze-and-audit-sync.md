# 00 — Baseline Freeze & Forensic Audit Synchronization

> **Freeze Date:** 2026-11-15  
> **Project:** ReadBox (`mailstack@0.1.0`)  
> **Purpose:** Freeze the exact current codebase state as **Baseline v0 (`BASELINE-2026-11-15`)**, record verified test/build health, and synchronize it with the `reference/MailStack` v1.3.5.5 forensic audit (`notes/vcon-admin-forensic-audit.md`) before any update or bug-fix implementation begins.

---

## 1. Frozen Stack & Runtime Configuration

- **Framework:** Next.js `16.4.2` (App Router + Turbopack CSS rule), React `19.3.0`, TypeScript `5.x` (`Node >= 22.12.0`).
- **ORM & Database:** Prisma `7.10.1` + `@prisma/adapter-pg` + `pg` (`PostgreSQL` only per `AGENTS.md`).
- **Auth & Security:** `next-auth@5.0.0-beta.32` (JWT strategy + DB-backed `AppSession` or dev in-memory demo session), `@node-rs/argon2`, `zod@4.6.7`.
- **UI & Styling:** Tailwind CSS v4 (`@import "tailwindcss";`, `@custom-variant dark`), `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `lucide-react`, `next-themes`, `sonner`.
- **Testing & QA Tooling:** `node --test` (`tsx`), `vitest@5.0.5` + `@testing-library/react` + `jsdom`, `eslint@9`, `tsc --noEmit`, `prisma validate`.

---

## 2. Frozen File Inventory (`BASELINE-2026-11-15`)

- **Root & Config:** `.env.example`, `.env.development`, `AGENTS.md`, `README.md`, `components.json`, `compose.yaml`, `eslint.config.mjs`, `next.config.ts`, `package.json`, `prisma.config.ts`, `tsconfig.json`, `vitest.config.mts`.
- **Database (`prisma/`):**
  - `schema.prisma` (14 models: `User`, `AdministratorProfile`, `LoginAttempt`, `UserAccessPolicy`, `AppSession`, `PasswordResetToken`, `Domain`, `Mailbox`, `MailboxMembership`, `Message`, `Attachment`, `AuditLog`, `ServiceHeartbeat`, `SiteSettings`)
  - 3 PostgreSQL migrations (`20261017000000_initial_application_schema`, `20261017190000_local_auth_reset`, `20261018120000_administrator_profiles`)
- **App Routes (`src/app/`):**
  - Public/System: `/`, `/sign-in` (`page.tsx`, `actions.ts`), `/reset-password` (`page.tsx`, `actions.ts`), `/api/auth/[...nextauth]/route.ts`, `/health/live/route.ts`, `/health/ready/route.ts`, `/manifest.ts`
  - Protected `(workspace)/layout.tsx`: `/users` (`page.tsx`), `/vcon` (`page.tsx`)
- **Feature Panels & Shared UI (`src/`):**
  - `src/users/overview-panel.tsx` (static Foundation placeholder)
  - `src/vcon/overview-panel.tsx` (static Foundation placeholder)
  - `src/components/layout/{app-shell.tsx,theme-toggle.tsx}`
  - `src/components/auth/{sign-in-form.tsx,password-reset-form.tsx}`
  - `src/components/providers/{theme-provider.tsx,service-worker-registration.tsx}`
  - `src/components/ui/{badge,button,dialog,form-field,icon,icon-button,input,label,notifications,table,textarea}.tsx`
- **Core Backend (`src/config/`, `src/core/`):**
  - `src/config/{env.ts,env-schema.ts}`
  - `src/core/auth/*` (`auth-secret.ts`, `credentials.ts`, `current-user.ts`, `dev-demo-auth.ts`, `opaque-token.ts`, `operator-bootstrap.ts`, `operator-environment.ts`, `password-policy.ts`, `password-reset.ts`, `password.ts`, `proxy-request.ts`, `route-access-policy.ts`, `route-guards.ts`, `runtime-policy.ts`, `session-registry.ts`, `sign-in-result.ts`)
  - `src/core/database/client.ts`
  - `src/core/health/snapshot.ts`
  - `src/core/postfix/{read-adapter.ts,mock-read-adapter.ts}`
  - `src/core/server/logger.ts`
  - `src/core/setup/{authorization.ts,lifecycle.ts,progress.ts,trusted-operations.ts}`
- **Scripts & Public PWA:** `scripts/auth/operator.ts`, `scripts/testing/{postgres-integration.ts,postgres-target.ts,verify-safe.mjs}`, `public/{offline.html,sw.js,icons/*}`.
- **Tests (`tests/`):** `tests/auth/*` (7 files), `tests/compatibility/*` (2 files), `tests/postfix/read-adapter.test.ts`, `tests/schema/postgres-schema.test.mjs`, `tests/setup/*` (4 files), `tests/ui/*` (7 test files + `setup.ts`).

---

## 3. Baseline Verification Snapshot (Executed 2026-11-15)

Exact check results recorded before any code changes:

| Check / Command | Baseline Result | Notes |
|---|---|---|
| `npm run test:compat` | **PASS (22 / 22)** | Compatibility, service worker, PostgreSQL schema static tests pass. |
| `npm run test:postfix` | **PASS (5 / 5)** | Mock `ReadOnlyMailServerAdapter` unit tests pass. |
| `npm run test:setup` | **PASS (34 / 34)** | Setup progress, authorization, lifecycle, trusted-operations pass. |
| `npm run test:auth` | **PASS (22 / 22)** | `test:auth:core` (17/17) + `test:auth:guards` (5/5) pass. |
| `node --import tsx --test tests/auth/dual-mode-env.test.ts` | **PASS (6 / 6)** | Dev bypass/demo, proxy origin/HTTPS cookie policy tests pass (currently **not** in `test:auth:core`!). |
| `npm run test:auth:target-guard` | **FAIL (5 / 6 pass, 1 fail)** | Test #6 fails on Linux (`tests/auth/postgres-target.test.ts:27` uses hardcoded `\\compose.yaml` Windows separator). |
| `npm run verify:safe` | **FAIL (exit 1)** | Fails at `test:auth:target-guard` step above. |
| `npx tsc --noEmit` | **PASS (0 errors)** | Clean TypeScript check across app and tests. |
| `npm run lint` | **PASS (0 errors)** | Clean ESLint check. |
| `npm run db:validate` | **PASS** | `prisma validate` confirms `prisma/schema.prisma` is valid. |
| `npm run test:ui` (`vitest`) | **PASS (7 files, 21 / 21)** | UI component & contrast/a11y/PWA manifest/SW registration tests pass. |
| Live PostgreSQL Integration (`test:postgres`) | **NOT RUN (Blocked)** | Requires `.env.test.local` + running `postgres-test` Docker Compose profile. |

---

## 4. Development Auth Baseline Mode (Preserved During Updates)

ReadBox baseline includes dual-mode development ergonomics while remaining fail-closed in production:
- `.env.development` sets `DEV_AUTH_MODE=bypass` and `DEV_AUTH_ROLE=admin` for fast local UI inspection of `/users` and `/vcon`.
- `DEV_AUTH_MODE=demo` enables `/sign-in` against in-memory `DEV_DEMO_ACCOUNTS` (`demo.admin` / `demo.user`) with AI Studio iframe-compatible cookie settings (`SameSite=None; Secure; Partitioned` over HTTPS dev proxy).
- `parseEnvironment()` (`src/config/env-schema.ts`) **forcibly clamps `devAuthMode` to `"off"` when `NODE_ENV=production`**, and `getAuthRuntimeConfigurationError()` rejects non-`off` dev modes in production.
- **Freeze Rule:** All future update phases MUST keep `DEV_AUTH_MODE=bypass|demo|off` functional for local/AI Studio preview while implementing production PostgreSQL behavior for `NODE_ENV=production` (or `DEV_AUTH_MODE=off`).

---

## 5. Synchronization Between Baseline & Forensic Audit (`notes/vcon-admin-forensic-audit.md`)

Comparing current ReadBox baseline against `reference/MailStack` v1.3.5.5 confirms:
1. **Schema Parity Ready, Mailserver Schema Missing:** All 14 application models already match MailStack's data domain inside PostgreSQL (`prisma/schema.prisma`), plus `AdministratorProfile` and `AppSession`. Only the isolated `mailserver` schema + `postfix_lookup` role for Postfix views remains uncreated.
2. **Auth Foundation Ahead in Security, Behind in Lockout/Audit:** ReadBox already has Argon2id, `AppSession` DB revocation, and `AdministratorProfile` (`notFound()` guard on `/vcon`), which improves upon Django `is_staff` leaks. However, `credentials.ts` currently hardcodes `ipAddress: null` on `LoginAttempt` (no per-IP throttling), lacks old-attempt pruning, does not update `User.lastLogin`, and has no `AuditLog` writer.
3. **UI Shells Are Static Stubs:** Both `/users` and `/vcon` currently show `"Foundation"` badges and `"Services not connected"` placeholders; `AppShell` exposes `/vcon` link in the sidebar to everyone instead of filtering by `isAdministrator`.
4. **Pure Setup Contracts Exist Without Persistence/Workers:** `src/core/setup/*` defines strict authorization & revisioned lifecycle contracts, and `src/core/postfix/read-adapter.ts` defines lookup ports, waiting for real PostgreSQL adapters and workers.
5. **Decision Locked:** No feature implementation starts until Phases `0..7` in `notes/02-phase-roadmap-and-scope-locks.md` are reviewed and approved step-by-step under strict scope locks.
