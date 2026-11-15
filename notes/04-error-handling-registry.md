# 04 — Error Handling Registry (Existing vs Required)

> **Document ID:** `DOC-004`  
> **Baseline Reference:** `BASELINE-2026-11-15`  
> **Core Security Principle:** Errors must **fail closed**, log structured diagnostics server-side with automatic secret redaction (`src/core/server/logger.ts`), and **never** expose stack traces, SQL queries, filesystem paths, or account existence to untrusted clients.

---

## Part A — Error Handling Currently Implemented in Baseline

| Area | File & Symbol | Current Behavior (Verified) | Mode / Boundary |
|---|---|---|---|
| **Environment Validation** | `src/config/env-schema.ts` (`parseEnvironment`) | Throws `Invalid MailStack environment configuration: <keys>` at startup if `DATABASE_URL` protocol isn't `postgres:`/`postgresql:`, `AUTH_SECRET < 32`, or prod auth missing secret/DB. Clamps `DEV_AUTH_MODE` to `"off"` in production. | Fail-closed boot |
| **Auth Runtime Guard** | `src/core/auth/runtime-policy.ts` (`getAuthRuntimeConfigurationError`), `src/auth.ts` | Throws at module load if `NODE_ENV=production` has `DEV_AUTH_MODE !== "off"`, `AUTH_ENABLED=true` lacks `AUTH_SECRET`, or prod auth lacks `DATABASE_URL`. | Fail-closed boot |
| **Auth Secret Guard** | `src/core/auth/auth-secret.ts` (`getAuthSecret`) | Throws in production if `AUTH_ENABLED=true` & `AUTH_SECRET` missing; generates ephemeral runtime secret in dev only. | Server-only |
| **Credentials Verification** | `src/core/auth/credentials.ts` (`authorizeCredentials`) | Uses `pg_advisory_xact_lock`, runs timing-safe dummy `verifyPassword(null, password)` on lockout/unknown user, catches DB exceptions -> logs `auth_credentials_verification_failed`, returns `null` (generic denial). | DB / Auth |
| **Sign-In Client Errors** | `src/core/auth/sign-in-result.ts`, `src/components/auth/sign-in-form.tsx` | Rejects silent HTTP 200 Auth.js errors (`!result.ok || result.error || !result.url`). Distinguishes `MissingCSRF` & blocked iframe cookie (verifies `/api/auth/session` after signIn) -> renders `"Open sign-in in a new tab"` recovery link; handles `Configuration` & network `catch`. | Client UI |
| **Session Lifecycle Errors** | `src/auth.ts`, `src/app/sign-in/actions.ts` | `jwt()` catches registration/validation errors -> logs `auth_session_registration_failed` / `auth_session_validation_failed`, invalidates token (`return null`). `signOutAction` catches DB revocation errors -> logs `auth_session_revocation_failed`, throws `"Secure sign-out is temporarily unavailable"`. | Server Action / Auth |
| **Password Reset Errors** | `src/core/auth/password-reset.ts`, `src/app/reset-password/actions.ts` | Validates opaque token format, expiry (`expiresAt > now`), password length & match, atomic single-use `deleteMany` claim (`count !== 1`). Server action catches errors -> logs `password_reset_completion_failed`, returns generic `{ status: "invalid" }` (no token/user enumeration). | Server Action |
| **Operator Bootstrap Guard** | `src/core/auth/operator-environment.ts`, `operator-bootstrap.ts` | Rejects non-interactive or unsafe contexts & `mailstack_dev`; wraps bootstrap in `pg_advisory_xact_lock`; aborts if users already exist (`return null`). | CLI |
| **Route Access Protection** | `src/core/auth/route-guards.ts`, `route-access-policy.ts` | Unauthenticated -> `redirect("/sign-in")`. Non-admin requesting `/vcon` -> `notFound()` (non-enumerating 404). DB lookup error in `getCurrentUser()` -> logs `auth_current_user_lookup_failed`, returns `null` (fail closed). | RSC Guard |
| **Server Logger Redaction** | `src/core/server/logger.ts` | Recursively replaces any key containing `password`, `secret`, `token`, `cookie`, `session`, `authorization`, `credential`, `private_key`, `message_body`, `attachment_content`, `contact_message` with `"[REDACTED]"`. | Logging |
| **Setup Pure Planners** | `src/core/setup/{authorization,lifecycle,trusted-operations}.ts` | Typed discriminated errors (`rejected`, `conflict`, `failure`, `unsupported`); executor exceptions caught and sanitized to `"operation_failed"`; unknown/denied grants fail closed. | Pure / Server |
| **Health Readiness** | `src/core/health/snapshot.ts`, `src/app/health/ready/route.ts` | Catches `SELECT 1` errors -> sets `database.connection = "unavailable"`, returns HTTP `503` with `Cache-Control: no-store` without leaking DB URL or stack trace. | HTTP API |
| **Postfix Read Interface** | `src/core/postfix/read-adapter.ts` | Defines typed `ReadAdapterErrorCode`: `invalid_input`, `unavailable`, `timeout`, `query_failed`, `cancelled` without echoing query input. | Interface |
| **Admin Overview & Audit UI** | `src/core/admin/overview.ts`, `src/core/audit/queries.ts` | Handles unset `DATABASE_URL` and DB connection exceptions cleanly via typed flags (`databaseConfigured`, `databaseConnected`), logs safe event names without SQL/URL leakage, and catches storage RWX failures cleanly. | Server / UI |
| **Admin User CRUD Guards** | `src/core/accounts/users.ts`, `src/app/(workspace)/vcon/users/actions.ts` | Enforces Zod field errors, case-insensitive username conflicts & Prisma `P2002`, refuses `AdministratorProfile` edits/deletes (`admin_protected`), blocks `self_delete` and `last_admin`, and returns typed `ManagedUserResult` without crashes. | Server Action |
| **Workspace Error & 404 Boundaries** | `src/app/(workspace)/error.tsx`, `src/app/(workspace)/vcon/not-found.tsx` | Catches unexpected client/RSC render errors with a retry button (zero stack trace leakage) and serves consistent non-enumerating 404 UI under `/vcon`. | App Router UI |

---

## Part B — Error Handling Required for Production Updates (`Phases 0–7`)

Every upcoming phase MUST implement the corresponding error contracts below:

### B.1 Authentication, Brute-Force & Rate Limiting (`Phase 0–1`)
1. **IP + Username Lockout Parity (`credentials.ts`):** When client IP + normalized username hits `LOGIN_FAILURE_LIMIT` within `LOGIN_FAILURE_WINDOW_SECONDS`, deny with dummy Argon2 work and generic `"Invalid username or password"` (or generic rate-limit response without revealing whether account exists) + record `login_failure` audit (`reason: "lockout"`).
2. **Untrusted Proxy Header Defense (`proxy-request.ts` / `audit/record.ts`):** Ignore `X-Forwarded-For` unless `TRUST_PROXY_HEADERS=true`; validate IPv4/IPv6 syntax via `node:net` (`isIP()`) before passing to PostgreSQL `INET` column (prevent invalid-inet Prisma crashes).

### B.2 Prisma / PostgreSQL Errors (`Phases 1–6`)
Map Prisma error codes (`PrismaClientKnownRequestError`) cleanly inside service layers—never bubble raw Prisma stack/constraint names to the browser:
- `P2002` (Unique violation, e.g., duplicate `username` / `Domain.name` / `Mailbox.emailAddress`) -> `{ ok: false, code: "CONFLICT", field, message: "Already exists." }`
- `P2003` (Foreign key restrict, e.g., deleting domain with mailboxes) -> `{ ok: false, code: "HAS_DEPENDENCIES", message: "Remove dependent mailboxes first." }`
- `P2025` (Record not found) -> `404` / `"Resource no longer exists."`
- Connection/timeout (`P1001`, `P1008`, `ECONNREFUSED`) -> Log structured error + HTTP `503` / friendly retry banner.

### B.3 Admin `/vcon` Domain & Validation Errors (`Phases 2–3`)
1. **User Management Guards (`/vcon/users`):**
   - Attempting to edit/delete an `AdministratorProfile` user via standard user UI -> HTTP `403` / safe banner `"Administrator accounts cannot be modified in this interface."`
   - Self-delete or last-active-admin delete attempt -> blocked with clear warning; zero partial deletions.
2. **Domain & DNS Errors (`/vcon/domains` — Implemented in Phase 3):**
   - Domain DNS resolution timeout (`DNS_LOOKUP_TIMEOUT_SECONDS`), `ENOTFOUND` / `ESERVFAIL` / `EREFUSED` / malformed TXT record -> per-record `{ status: "missing" | "unavailable" | "error" | "verified" }` (`resolver.ts` `DnsVerificationError`) without throwing 500.
   - Missing OpenDKIM file (`/etc/opendkim/keys/<domain>/mail.txt`) -> `available: false, copyable: false` (`opendkim.ts`) (never crashes preview modal).
   - Verification failure on active domain -> auto-disables domain + `mailserver.mail_domains` atomically (`service.ts`) and explains why activation was revoked.
3. **Mailbox Provisioning & Purge Compensation (`/vcon/mailboxes` — Implemented in Phase 3):**
   - **Lock timeout** (`MAILBOX_PROVISION_LOCK_ROOT` busy) -> friendly conflict error (`ProvisioningError` code `LOCK_BUSY`) `"Provisioning is busy for this address; please try again."`
   - **Confined Path Violation / Symlink Detected:** Immediately throw `PathConfinementError` (`paths.ts`), abort Maildir creation, return safe validation/provisioning failure without leaking host paths.
   - **Filesystem `EACCES` / `ENOSPC` / `EROFS`:** Clean up strictly newly created empty directories (`rollbackCreatedMaildirPaths`) and rollback/compensate `mailserver.mailboxes` row; write `mailbox_provisioning_failure` audit.
   - **DB Transaction Error After FS/Mailserver Write:** Run compensating cleanup (`deleteMailserverMailbox`, remove newly created dirs while preserving pre-existing dirs) and log failure safely.
   - **Purge Confirmation Mismatch:** Reject unless typed confirmation === exact normalized `mailbox.emailAddress`.

### B.4 Maildir Ingestion, MIME & HTML/CSS Sanitizer Errors (`Phase 4 — Implemented`)
1. **Per-File Isolation Guarantee (`src/core/ingestion/service.ts`, `parser.ts`):** A corrupt, malformed, binary-garbage, or truncated `.eml` file **never crashes the ingestion worker loop**. `parseEmailMessage` catches MIME exceptions -> returns `parseFailed: true` with safe warnings; `ingestUnindexedMaildirFiles` isolates per-file errors, records redacted `ingestion_error` audits, marks heartbeat `degraded`, and continues scanning remaining files.
2. **Oversized Message / Attachment Protection (`service.ts`, `attachments.ts`, `sanitizer.ts`):**
   - Messages exceeding `MAX_MESSAGE_SIZE_MB` compute streaming SHA-256 and record `parseStatus = "oversized"` without reading into memory; attachments exceeding `MAX_ATTACHMENT_SIZE_MB` or `MAX_ATTACHMENTS_PER_MESSAGE` are skipped with `parseStatus = "warning"`.
   - CSS input/output/rule/nesting budget (`128KB`/`256KB`/`512-rule`/`8-depth`) exceeded -> strips `<style>` / inline style safely via `css-tree`.
3. **File Read/Collision & Repair Safety (`service.ts`, `repair.ts`):**
   - `(mailboxId, sourceFileKey)` unique constraint duplicate (`P2002` or pre-check) -> idempotent `"duplicate"` skip (and cleans up any staged attachments on rollback).
   - Disappeared Maildir file mid-scan (`ENOENT`) -> returns `"skipped_missing"` without failing batch.
   - Body repair SHA-256 mismatch (`diskSha256 !== message.sourceSha256`) -> throws `BodyRepairError("source_mismatch")`, **aborting repair for that message** and requiring `confirmRepair: true` for mutating batches.

### B.5 File Uploads (`SiteSettings`) & Protected Downloads (`Phases 5–6`)
1. **SiteSettings Uploads (`/vcon/settings`):**
   - Reject files > `5 MB` (logo) or > `512 KB` (favicon), invalid extension/MIME mismatch, or empty payload with clear field-level validation message.
   - Serve uploaded media through confined route with `X-Content-Type-Options: nosniff` and safe CSP headers.
2. **Attachment Download (`/api/messages/attachment/[attachmentUuid]` — Implemented in Phase 5):**
   - Unassigned user / deleted mailbox / deleted message / missing file on disk / symlink escape / `PathConfinementError` -> uniform HTTP `404` (`X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`) without exposing `ATTACHMENT_STORAGE_ROOT` path (`getAttachmentForUserDownload` in `src/core/messages/service.ts`).

### B.6 System Update & External Network Errors (`Phase 6`)
1. **GitHub Release Check (`GET /api/vcon/update/check`):**
   - Handle `fetch` `AbortSignal.timeout(10_000)`, HTTP `403`/`429` rate limit, invalid JSON, or missing `-source.zip`/`.sha256` assets -> return typed `{ ok: false, code: "UPSTREAM_UNAVAILABLE" | "NO_COMPATIBLE_RELEASE" }`.
2. **Update Start (`POST /api/vcon/update/start`):**
   - Non-official GitHub URL / query/fragment present -> `400 Bad Request`.
   - Already running/queued (`EEXIST` on `link` or lock active) -> `409 Conflict`.
   - Preflight failed -> `503 Service Unavailable`.
3. **Root Updater Worker (`update_worker.py` / `upgrade.sh`):**
   - SHA-256 mismatch, zip traversal (`..` / symlink), wrong owner/mode (`!= vmail` or group/world writable), or unacknowledged schema migration (`--allow-migrations`) -> abort upgrade cleanly, write failed status to `/run/vibmail/update_status.json`, and run rollback if code already swapped.

### B.7 Next.js App Router UI Error Boundaries (`All UI Phases`)
Add and verify Next.js standard resilience files across `/vcon` and `/users`:
- `src/app/(workspace)/error.tsx` (Client Error Boundary with retry button + correlation code, zero raw stack traces in prod).
- `src/app/(workspace)/vcon/not-found.tsx` (Matches root 404 seamlessly so non-admins see indistinguishable not-found page).
- Standardized `ActionResult<T>` contract for every Server Action (`{ ok: true, data, message? } | { ok: false, error, fieldErrors? }`) paired with `sonner` toasts (`src/components/ui/notifications.tsx`) and inline `FormField` error states.
