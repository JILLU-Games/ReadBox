# 003 — Update Phase Progress Log & Scope Lock Audit Trail

**Last Updated:** `2026-11-16` (Phase 6 Completed — All `6 / 6` Phases Done)  
**Completion Summary:** **`6 / 6` Phases Completed** | **`0` Phases Remaining**

---

## 1. Phase Status Board

| Phase | Title | Forensic IDs | Status | Completed Date | Verification Gate |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Phase 1** | Critical Auth, Password Reset Security & Audit Consistency | `FA-001`, `FA-002`, `FA-009` | `[x] COMPLETED` | `2026-11-16` | PASS (Typecheck, Lint, Unit, UI, Build) |
| **Phase 2** | Sandboxed Email Reader Isolation & Policy Inheritance | `FA-003`, `FA-006` (policy) | `[x] COMPLETED` | `2026-11-16` | PASS (DB Validate, Typecheck, Lint, Unit, UI, Build) |
| **Phase 3** | Retention Purge Engine, Starter Mailbox Contract, DNS & Branding | `FA-006` (purge), `FA-010`, `FA-011` | `[x] COMPLETED` | `2026-11-16` | PASS (DB Validate, Typecheck, Lint, Unit, UI, Build, Browser) |
| **Phase 4** | Production Fail-Closed Database & Error Handling Hardening | `FA-007`, `FA-011` (env), Error Boundaries | `[x] COMPLETED` | `2026-11-16` | PASS (DB Validate, Typecheck, Lint, Unit, UI, Build, Browser) |
| **Phase 5** | Admin Contact Inquiries UI & Admin Profile Parity | `FA-008`, `FA-009` (UI) | `[x] COMPLETED` | `2026-11-16` | PASS (DB Validate, Typecheck, Lint, Unit, UI, Build, Browser) |
| **Phase 6** | Docker/Coolify Worker, Updater Modernization & Health Gate | `FA-004`, `FA-005`, `FA-011` (health), `EH-06` | `[x] COMPLETED` | `2026-11-16` | PASS (DB Validate, Typecheck, Lint, Unit, UI, Build, Browser) |

---

## 2. Completed Phases Log

### Phase 1 — Critical Auth, Password Reset Security & Audit Consistency
- **Phase 1 Status:** `COMPLETED` (`2026-11-16`)
- **Resolved Findings:** `FA-001` (Critical), `FA-002` (High), `FA-009` (Medium — audit `targetType` & `authSource` forwarding), `EH-07` (`CONTACT_SECRET_KEY` schema validation)
- **Features / Fixes Implemented:**
  - `src/app/reset-password/actions.ts`, `src/app/reset-password/page.tsx`, `src/components/auth/password-reset-form.tsx`: Removed unauthenticated plaintext reset token generation and display from production `/reset-password` UI and Server Action (`requestPasswordResetAction` rejects non-demo calls without issuing or returning tokens; `"Generate reset token"` panel only renders in `development` + `DEV_AUTH_MODE=demo`).
  - `prisma/schema.prisma`, `prisma/migrations/20261116000000_phase1_admin_reset_and_security/migration.sql`: Added `AdminResetToken` (`admin_reset_tokens`) table with `admin_id` FK (`ON DELETE CASCADE`) so administrator password reset tokens persist in PostgreSQL across container/worker restarts.
  - `src/core/auth/password-reset.ts`, `scripts/auth/operator.ts`: Added atomic single-use `prisma.adminResetToken` issuance (`issueAdminPasswordResetToken`) and completion flow, added `admin_accounts` lookup support in `scripts/auth/operator.ts` CLI, and standardized admin reset audit `targetType` to `"admin_account"`.
  - `src/config/env-schema.ts`: Added validated optional `CONTACT_SECRET_KEY` (`contactSecretKey`).
  - `src/core/contact/service.ts`, `src/app/api/contact/route.ts`: Implemented PostgreSQL-backed durable CSRF replay verification (`consumeContactCsrfTokenDurable`) and DB-backed contact submission rate limiting (`auditLog.findMany`) across restarts/workers.
  - `src/core/accounts/user-profile.ts`: Updated `getUserSecuritySnapshot` query to match `targetType: { in: ["admin", "admin_account"] }`.
  - `src/app/(workspace)/layout.tsx`, `src/app/(workspace)/users/**`, `src/app/api/messages/{html,attachment}/**`: Forwarded `authSource: user.authSource` consistently in every workspace actor context.
  - Added/updated tests in `tests/schema/postgres-schema.test.mjs`, `tests/auth/phase1-separate-auth-and-control.test.ts`, `tests/admin/public-contact-service.test.ts`, and `tests/ui/password-reset-form.test.tsx`.
- **Scope Lock Verification:**
  - Modified files ONLY within authorized Phase 1 Scope Lock? `YES`
  - Unrelated UI/features/routes unchanged? `YES`
- **Build & Test Gate Results:**
  - `npm run db:validate`: `PASS`
  - `npm run typecheck`: `PASS`
  - `npm run lint`: `PASS`
  - `npm run test:unit`: `PASS`
  - `npm run test:ui`: `PASS` (`16 files, 65 tests`)
  - `npm run build`: `PASS`
- **Remaining Phases After This Update:** `5 / 6` remaining -> Next: `Phase 2`

---

### Phase 2 — Sandboxed Email Reader Isolation & Policy Inheritance
- **Phase 2 Status:** `COMPLETED` (`2026-11-16`)
- **Resolved Findings:** `FA-003` (High), `FA-006` (High — `UserAccessPolicy` global inheritance part), `EH-05` (Iframe HTML Reader Load Error, Timeout & Sandbox Fallback)
- **Features / Fixes Implemented:**
  - `src/components/users/message-reader-view.tsx`: Removed `dangerouslySetInnerHTML`, client-side CSS selector scoping (`scopeCssSelectors`/`scopeCssText`), and inline `fetch`-and-inject; replaced with isolated `<iframe sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" src="/api/messages/html/[messageUuid]?theme=...">` (no `allow-scripts`, no `allow-forms`), `ResizeObserver` dynamic auto-height, extracted plain-text copy support, and `EH-05` error/timeout/missing-marker detection with `AlertBanner` warning + **Retry** button + linkified text fallback.
  - `src/core/messages/service.ts`: Updated `SAFE_HTML_CSP_POLICY` to `"img-src data: 'self'"` (allows same-origin `cid:` attachment images while blocking remote images), stopped embedding raw/sanitized `htmlBody` in `getMessageDetailForUser` RSC payload (`hasHtmlBody` only), moved link hardening (`target="_blank" rel="noopener noreferrer"`, `<button type="button">`) and `<meta name='readbox-html-body' content='1'>` marker into `buildSanitizedHtmlDocument`.
  - `src/app/api/messages/html/[messageUuid]/route.ts`: Added `X-Frame-Options: SAMEORIGIN` response header alongside `Content-Security-Policy: SAFE_HTML_CSP_POLICY`.
  - `prisma/schema.prisma` & `prisma/migrations/20261116010000_phase2_user_access_policy_inheritance/migration.sql`: Made `canCreateMailboxes`, `maxMailboxes`, `autoDeleteEnabled`, and `autoDeleteDays` nullable on `UserAccessPolicy` with no schema defaults, and reset untouched default rows to `NULL` so non-overridden users dynamically inherit global `UserControlSettings`.
  - `src/core/accounts/user-control-policy.ts`: Added `UserAccessPolicyOverrideInput` and updated `normalizeExtendedUserAccessPolicy` / `resolveEffectiveUserPolicy` to inherit global `UserControlSettings` whenever per-user override columns are `null`, while preserving explicit per-user overrides.
  - Updated/added unit & UI tests across `tests/schema/postgres-schema.test.mjs`, `tests/messages/phase5-users-workspace.test.ts`, `tests/ui/users-phase5.test.tsx`, and `tests/auth/phase1-separate-auth-and-control.test.ts`.
- **Scope Lock Verification:**
  - Modified files ONLY within authorized Phase 2 Scope Lock? `YES`
  - Unrelated UI/features/routes unchanged? `YES`
- **Build & Test Gate Results:**
  - `npm run db:validate`: `PASS`
  - `npm run typecheck`: `PASS`
  - `npm run lint`: `PASS`
  - `npm run test:unit`: `PASS`
  - `npm run test:ui`: `PASS` (`16 files, 65 tests`)
  - `npm run build`: `PASS`
- **Remaining Phases After This Update:** `4 / 6` remaining -> Next: `Phase 3`

---

### Phase 3 — Retention Purge Engine, Starter Mailbox Contract, DNS & Branding
- **Phase 3 Status:** `COMPLETED` (`2026-11-16`)
- **Resolved Findings:** `FA-006` (High — Retention Purge Engine, Batching, Admin UI & Worker Loop), `FA-010` (Medium — Starter Mailbox Contract Integrity), `FA-011` (Medium — Footer `sourceCodeUrl`, Dynamic PWA `manifest.ts`, Strict `SERVER_IP` Routing Check, Real Setup Inspection), `EH-06` (Partial — Retention Purge Per-Mailbox Error Isolation & Error Count Surface)
- **Features / Fixes Implemented:**
  - `src/core/messages/service.ts`: Exported `buildExpiredRetentionFilterClause(retentionCutoff)` and upgraded `purgeExpiredMessagesForRetention` to resolve per-mailbox retention from `mailboxMembership` -> `user.accessPolicy` via `resolveEffectiveUserPolicy(globalSettings, ...)` when `options.retentionDays` is omitted (skipping mailboxes where any active member has retention disabled `<= 0`, otherwise honoring max active member retention days), use DB `count()` for dry-run and bounded 500-row chunked `findMany` + `prisma.message.updateMany`, and isolate per-mailbox exceptions via `try/catch` while reporting `errors` in `RetentionPurgeSummary`.
  - `src/core/operations/service.ts`, `src/app/(workspace)/vcon/operations/actions.ts`, `src/app/(workspace)/vcon/operations/page.tsx`, `src/components/vcon/operations-console.tsx`: Added `runRetentionPurge` validation (`1..3650` days) with partial-error status feedback (`EH-06`), added & wired `runRetentionPurgeAction` (revalidating `/vcon/operations`, `/vcon`, `/vcon/mailboxes`, `/vcon/domains`, `/vcon/audit`, `/users`, `/users/mailboxes`), and added Panel **`7. Run email retention purge`** with optional `ops-retention-days` override, confirmation checkbox (`ops-retention-confirm`), dry-run and live purge controls.
  - `src/workers/ingestion.ts`: Exported `DEFAULT_RETENTION_PURGE_INTERVAL_MS` (`3600000`) and `runWorkerRetentionPurgePass`, and wired hourly periodic retention execution in `runIngestionWorkerLoop` (`--watch` mode) without interrupting ingestion on purge failure.
  - `src/core/auth/sign-up.ts`: Tightened `tryProvisionStarterMailbox` (`FA-010`) so demo fallback only runs when `params.devDemoActive === true` and removed the broken partial `prisma.mailbox.create` fallback; now provisions exclusively through `provisionMailbox()` or logs `starter_mailbox_autoprovision_skipped` and returns `null`.
  - `src/components/public/public-site-footer.tsx`, `src/app/page.tsx`, `src/app/privacy/page.tsx`, `src/app/contact/page.tsx`: Sanitized `sourceCodeUrl` via `normalizeSafeHref()` (allowing safe `/...` paths or `http:`/`https:` URLs, blocking `javascript:` XSS), rendered `<a data-source-code-url target="_blank" rel="noopener noreferrer">Source code</a>`, and forwarded `sourceCodeUrl={settings.sourceCodeUrl}` from all 3 public pages.
  - `src/app/manifest.ts`: Converted `manifest()` to `async` reading live `await getSiteSettings()` (with `getCachedSiteSettingsSnapshot()` fallback) and prepending custom `settings.faviconUrl` with `inferManifestIconType()`.
  - `src/core/dns/resolver.ts`: Hardened `verifyRoutingDns` so `expectedServerIp` rejects empty or loopback/wildcard defaults (`127.0.0.1`, `::1`, `0.0.0.0`) and strictly validates `targetAddresses.includes(targetIp)`.
  - `src/core/setup/trusted-operations.ts`: Replaced stubbed setup handlers with real `verifySchemaAndMigrations` checks against PostgreSQL `information_schema.tables` (9 `public` tables + 2 `mailserver` tables), `_prisma_migrations` applied count > 0, and fail-closed `adminCreated = false` when `adminAccount.count` is unavailable.
  - Updated/added unit & UI coverage across `tests/messages/phase5-users-workspace.test.ts`, `tests/ui/vcon-phase4.test.tsx`, `tests/ui/public-website.test.tsx`, `tests/ui/installability-manifest.test.tsx`, `tests/admin/phase3-domains-mailboxes.test.ts`, `tests/setup/trusted-operations.test.ts`, and `tests/auth/phase1-separate-auth-and-control.test.ts`.
- **Scope Lock Verification:**
  - Modified files ONLY within authorized Phase 3 Scope Lock? `YES`
  - Unrelated UI/features/routes unchanged? `YES`
- **Build, Test & Browser Gate Results:**
  - `npm run db:validate`: `PASS`
  - `npm run typecheck`: `PASS`
  - `npm run lint`: `PASS`
  - `npm run test:unit`: `PASS`
  - `npm run test:ui`: `PASS` (`16 files, 66 tests`)
  - `npm run build`: `PASS`
  - Browser (`playwright-cli` Chromium 1440×900 on `/`, `/manifest.webmanifest`, `/vcon/operations`): `PASS` (`0` console errors/warnings)
- **Remaining Phases After This Update:** `3 / 6` remaining -> Next: `Phase 4`

---

### Phase 4 — Production Fail-Closed Database & Error Handling Hardening
- **Phase 4 Status:** `COMPLETED` (`2026-11-16`)
- **Resolved Findings:** `FA-007` (Medium — Production Fail-Closed DB & No Silent Demo Fallback), `FA-011` (Medium — `USE_X_ACCEL_REDIRECT` env validation), `EH-01`, `EH-02`, `EH-03`, `EH-04`, `EH-07`
- **Features / Fixes Implemented:**
  - `src/core/database/client.ts`, `src/core/health/snapshot.ts`: Added `DatabaseConfigurationError`, `DatabaseUnavailableError`, and `resolvePrismaClient()` so `NODE_ENV === "production"` fails closed and never returns `createMockPrismaClient()`, while `getReadinessSnapshot` safely catches client init errors to return structured `503 not_ready`.
  - `src/config/env-schema.ts`, `src/app/api/messages/attachment/[attachmentUuid]/route.ts`: Added validated `USE_X_ACCEL_REDIRECT` (`useXAccelRedirect` boolean, default `false`) to `environmentSchema` and wired the attachment route to `env.useXAccelRedirect`.
  - `src/app/sign-up/actions.ts`, `src/app/sign-up/page.tsx`, `src/app/sign-in/page.tsx`, `src/app/reset-password/page.tsx`: Restricted `devDemoActive` to `env.nodeEnv === "development" && env.devAuthMode === "demo"`, returned explicit `code: "unavailable"` when PostgreSQL is unconfigured/unreachable on sign-up, and rendered an `"Account registration unavailable"` `AlertBanner` on `/sign-up`.
  - `src/core/accounts/user-control-policy.ts`, `src/app/(workspace)/vcon/users/control/{page.tsx,actions.ts}`, `src/components/vcon/users-control-console.tsx`: Added `isDemoGovernanceFallbackAllowed`, stopped `listUsersControlSnapshot` from falling back to `DEMO_VERIFIED_DOMAINS`/`DEV_DEMO_ACCOUNTS` when PostgreSQL fails or in non-demo/production modes, blocked in-memory policy writes in production without DB, and added explicit DB unavailable `AlertBanner`s in `UsersControlConsole`.
  - `src/core/settings/service.ts`, `src/components/vcon/settings-console.tsx`: Upgraded `getSiteSettings` to log DB failures at `error`/`warn` level (`EH-03`), blocked in-memory `updateSiteSettings` fallback in production, and added `"Database connection unavailable"` `AlertBanner` in `SettingsConsole`.
  - `src/core/messages/service.ts`, `src/app/(workspace)/users/{layout,page,mailboxes/page,settings/page}.tsx`, `src/users/overview-panel.tsx`, `src/components/users/{user-mailboxes-view,user-settings-view,users-workspace-shell}.tsx`: Propagated `databaseError` and rendered explicit error `AlertBanner`s (and disabled live polling) when PostgreSQL queries fail.
  - `src/components/layout/route-error-panel.tsx`, `src/app/{sign-in,sign-up,reset-password,vcon/login}/error.tsx`, `src/app/(workspace)/users/{error.tsx,inbox/error.tsx}`: Added dedicated accessible recovery `error.tsx` boundaries (`EH-04`).
  - Added unit & UI tests in `tests/auth/dual-mode-env.test.ts`, `tests/admin/phase6-settings-update-health.test.ts`, `tests/ui/vcon-phase6.test.tsx`, and `tests/ui/users-phase5.test.tsx`.
- **Scope Lock Verification:**
  - Modified files ONLY within authorized Phase 4 Scope Lock? `YES`
  - Unrelated UI/features/routes unchanged? `YES`
- **Build, Test & Browser Gate Results:**
  - `npm run db:validate`: `PASS`
  - `npm run typecheck`: `PASS`
  - `npm run lint`: `PASS`
  - `npm run test:unit`: `PASS`
  - `npm run test:ui`: `PASS` (`16 files, 68 tests`)
  - `npm run build`: `PASS`
  - Browser (`playwright-cli` Chromium 1440×900 on `/sign-up`, `/vcon/login`, `/vcon/settings`, `/vcon/users/control`, `/users`): `PASS` (`0` console errors/warnings)
- **Remaining Phases After This Update:** `2 / 6` remaining -> Next: `Phase 5`

---

### Phase 5 — Admin Contact Inquiries UI & Admin Profile Parity
- **Phase 5 Status:** `COMPLETED` (`2026-11-16`)
- **Resolved Findings:** `FA-008` (Medium — Admin Contact Inquiries Console `/vcon/inquiries`), `FA-009` (Medium — `admin_table` Phone Field Parity in `/users/settings` & `updateUserProfile`)
- **Features / Fixes Implemented:**
  - `src/components/vcon/inquiries-console.tsx`, `src/app/(workspace)/vcon/inquiries/page.tsx`: Created `/vcon/inquiries` admin console calling `requireAdminUser()` and `listContactSubmissions({ prisma, limit: 150 })` with topic KPI `StatGrid` (`Total inquiries`, `Personal / Account`, `Team & Business`, `Support & Other`), topic filter `Select` (`INQUIRY_SERVICE_LABELS`), full-text search `Input` (`q` across sender, email, company, phone, requestId, message), `CopyButton` for work email/request ID, and a `"View details"` modal (`Dialog`) displaying full inquiry metadata and message text.
  - `src/components/layout/app-shell.tsx`: Added `"Contact inquiries"` (`/vcon/inquiries`) link under the `Users & Security` management navigation group.
  - `src/components/users/user-settings-view.tsx`, `src/core/accounts/user-profile.ts`, `src/app/(workspace)/users/settings/page.tsx`: Updated `UserSettingsView` so when `savedProfile.authSource === "admin_table"`, the `Phone` field renders disabled/read-only with hint `"Not applicable for operator accounts"` and submits `phone: ""`, and updated `updateUserProfile` (`user-profile.ts`) to reject non-empty phone numbers on `admin_table` operator accounts with an explicit validation error instead of silently ignoring them.
  - Added unit & UI tests in `tests/ui/app-shell.test.tsx`, `tests/ui/vcon-phase2.test.tsx`, `tests/ui/users-settings.test.tsx`, and `tests/messages/user-profile-settings.test.ts`.
- **Scope Lock Verification:**
  - Modified files ONLY within authorized Phase 5 Scope Lock? `YES`
  - Unrelated UI/features/routes unchanged? `YES`
- **Build, Test & Browser Gate Results:**
  - `npm run db:validate`: `PASS`
  - `npm run typecheck`: `PASS`
  - `npm run lint`: `PASS`
  - `npm run test:unit`: `PASS`
  - `npm run test:ui`: `PASS` (`16 files, 70 tests`)
  - `npm run build`: `PASS`
  - Browser (`playwright-cli` Chromium 1440×900 on `/vcon/inquiries` + detail dialog + `/users/settings`): `PASS` (`0` console errors/warnings)
- **Remaining Phases After This Update:** `1 / 6` remaining -> Next: `Phase 6`

---

### Phase 6 — Docker/Coolify Worker, Updater Modernization & Health Gate
- **Phase 6 Status:** `COMPLETED` (`2026-11-16`)
- **Resolved Findings:** `FA-004` (High — Continuous Maildir Ingestion Worker in Docker/Coolify), `FA-005` (High — Updater & Ops Scripts `readbox` Modernization & Container Orchestrator Support), `FA-011` (Medium — `/health/ready` Strict Ingestion Worker Readiness Check & `REQUIRE_INGESTION_READY`), `EH-06` (Worker Degraded `ServiceHeartbeat` Recording & Health Surface)
- **Features / Fixes Implemented:**
  - `Dockerfile`: Included `tsx`, `postal-mime`, `proper-lockfile`, `sanitize-html`, `css-tree`, `zod`, `server-only`, `tsconfig.json`, `src/`, `scripts/`, `/run/readbox`, and `ENV DOCKER_RUNTIME=true` in the production `runner` stage so `scripts/mail/ingest.ts` can execute inside the production container image.
  - `docker-compose.yml` & `entrypoint.sh`: Added dedicated `worker` service (`readbox-worker`) running `node --conditions=react-server --import tsx scripts/mail/ingest.ts --watch --interval ${INGESTION_INTERVAL_SECONDS:-15}` with shared volumes (`readbox_vmail`, `readbox_attachments`, `readbox_media`, `readbox_locks`), `SKIP_MIGRATIONS=true` support in `entrypoint.sh`, and `readbox.local` / `/run/readbox` defaults.
  - `.env.example` & `src/config/env-schema.ts`: Standardized defaults to `readbox.local`, `mail.readbox.local`, `app.readbox.local`, `/run/readbox`, `readbox-updater.service`, `/opt/readbox/app/scripts/updater/upgrade.sh`, and added `REQUIRE_INGESTION_READY` (`requireIngestionReady` boolean, default `false`).
  - `src/workers/ingestion.ts`: Added `recordWorkerDegradedHeartbeat` and wired `runIngestionWorkerLoop` to record `"degraded"` `ServiceHeartbeat` status with error details whenever an ingestion pass or hourly retention purge fails (`EH-06`).
  - `src/core/updates/service.ts`, `scripts/ops/restore.sh`, & `scripts/updater/update_worker.py`: Added `isContainerRuntime` detection (`DOCKER_RUNTIME`, `COOLIFY_*`, `/.dockerenv`, `/run/.containerenv`, or non-systemd runtime), container-aware preflight checklist & message (`"Managed by container orchestrator (Coolify / Docker Compose). Deploy new releases by pulling or rebuilding the container image."`), `readbox` default paths with legacy `vibmail` disk fallback, `readbox-ingestion`/`readbox-web` restore support, and `nextjs`/`vmail` updater user authorization.
  - `src/core/health/snapshot.ts`: Updated `getReadinessSnapshot` so `/health/ready` returns `status: "not_ready"` (`503`) whenever `ingestionStatus` is `"degraded"`, `"stale"`, or `"unavailable"`, or when `runtimeEnv.requireIngestionReady === true` and `mailServicesConnected === false`.
  - Updated/added unit tests in `tests/admin/phase3-domains-mailboxes.test.ts` and `tests/admin/phase6-settings-update-health.test.ts`.
- **Scope Lock Verification:**
  - Modified files ONLY within authorized Phase 6 Scope Lock? `YES`
  - Unrelated UI/features/routes unchanged? `YES`
- **Build, Test & Browser Gate Results:**
  - `npm run db:validate`: `PASS`
  - `npm run typecheck`: `PASS`
  - `npm run lint`: `PASS`
  - `npm run test:unit`: `PASS`
  - `npm run test:ui`: `PASS` (`16 files, 70 tests`)
  - `npm run build`: `PASS`
  - Browser (`playwright-cli` Chromium on `/vcon/system-update`): `PASS` (`0` console errors/warnings)
- **Remaining Phases After This Update:** `0 / 6` remaining — **ALL PHASES COMPLETED**

---

## 3. Next Queue & Scope-Lock Guardrail Protocol

- **Queue Status:** `0` Phases Remaining (`6 / 6` Completed).
- **Guardrail Audit:** প্রতিটি Phase (`Phase 1` থেকে `Phase 6`) অনুমোদিত **Scope Lock** মেনে বাস্তবায়ন, অডিট এবং ভেরিফাই করা হয়েছে। কোনো আনঅথরাইজড পেজ, লেআউট বা ফিচার পরিবর্তন করা হয়নি।

