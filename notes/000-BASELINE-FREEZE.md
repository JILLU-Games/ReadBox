# 000 — ReadBox Baseline Freeze & Forensic Alignment

**Freeze Status:** `FROZEN (Pre-Update Baseline)` | **Current Status:** `ALL 6 PHASES IMPLEMENTED & VERIFIED (FA-001 to FA-011 RESOLVED)`  
**Application:** `readbox` (`package.json` `"version": "0.1.0"`)  
**Runtime Stack:** Next.js `16.4.2` (App Router, Standalone), React `19.3.0`, Node.js `>=22.12.0`, Prisma `7.10.1` (`@prisma/adapter-pg`), PostgreSQL `16.14-alpine`, Tailwind CSS v4, NextAuth `5.0.0-beta.32`, Zod `4.6.7`.  
**Git Status Note:** Workspace check (`git rev-parse --short HEAD`) returned `fatal: not a git repository`; therefore this baseline is anchored by file inventory, `package.json`, `prisma/schema.prisma`, `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql`, and `notes/FORENSIC-AUDIT-REPORT.md`.

---

## 1. Frozen Core Inventory (Verified Current State)

### 1.1 Route & API Entry Points (`src/app`)
- **Public Routes:** `/`, `/contact`, `/privacy`, `/sign-in`, `/sign-up`, `/reset-password`, `/vcon/login`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`
- **Public / Utility APIs:**
  - `/api/auth/[...nextauth]`
  - `/api/contact`, `/api/contact/csrf`, `/api/contact/health`
  - `/api/site-settings`, `/api/media/[...path]`
  - `/health/live`, `/health/ready`, `/health/site-settings`
- **User Workspace Routes (`/users/*`):**
  - `/users` (Overview), `/users/mailboxes` (Manage Mailboxes), `/users/inbox/[mailboxUuid]` (Inbox & Sandboxed Reader view), `/users/settings` (Profile, Password, Sessions & Security)
  - APIs: `/api/messages/live`, `/api/messages/html/[messageUuid]`, `/api/messages/attachment/[attachmentUuid]`
- **Admin Control Routes (`/vcon/*`):**
  - `/vcon` (Overview), `/vcon/domains`, `/vcon/domains/new`, `/vcon/mailboxes`, `/vcon/mailboxes/new`, `/vcon/users`, `/vcon/users/new`, `/vcon/users/control`, `/vcon/operations`, `/vcon/audit`, `/vcon/settings`, `/vcon/system-update`
  - APIs: `/api/vcon/domains/dns-preview`, `/api/vcon/domains/[uuid]/dns-status`, `/api/vcon/update/{check,preflight,start,status}`
- **Global Error Boundaries:** `src/app/global-error.tsx`, `src/app/not-found.tsx`, `src/app/(workspace)/error.tsx`, `src/app/(workspace)/vcon/not-found.tsx`

### 1.2 Database & Storage Contract
- **ORM & Single DB Policy:** Single PostgreSQL database via `prisma/schema.prisma` (`public` + `mailserver` schema, role `postfix_lookup` defined in `prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql`).
- **Docker / Coolify Files:** `Dockerfile`, `docker-compose.yml`, `compose.yaml`, `entrypoint.sh`, `.dockerignore`, `.env.example`.

---

## 2. Baseline ↔ Forensic Audit Alignment (`FORENSIC-AUDIT-REPORT.md`)

Every defect recorded in `notes/FORENSIC-AUDIT-REPORT.md` (`FA-001` through `FA-011`) is matched 1:1 against the frozen baseline below:

| Forensic ID | Severity | Baseline Status | Target Update Phase |
| :--- | :--- | :--- | :--- |
| **`FA-001`** | CRITICAL | `/reset-password` exposes plaintext token + `"Use token"` button in UI | **Phase 1** |
| **`FA-002`** | HIGH | `AdminAccount` reset tokens & `/contact` CSRF/rate-limit stored in process memory; `ephemeralProductionSecret` fallback | **Phase 1** |
| **`FA-003`** | HIGH | `MessageReaderView` bypasses `<iframe sandbox>` & `SAFE_HTML_CSP_POLICY` via `dangerouslySetInnerHTML` | **Phase 2** |
| **`FA-004`** | HIGH | `docker-compose.yml` & `Dockerfile` lack Maildir ingestion worker, retention cron, Postfix/Dovecot, and `ingest.ts` runtime | **Phase 6** |
| **`FA-005`** | HIGH | `runUpdatePreflight`, `env-schema.ts`, `restore.sh`, `update_worker.py` hardcoded to `systemd` + legacy `vibmail`/`mailstack.local` + `vmail` UID | **Phase 6** |
| **`FA-006`** | HIGH | `UserAccessPolicy` defaults override global `UserControlSettings`; `runRetentionPurge` has zero callers | **Phase 2** (policy) & **Phase 3** (purge engine) |
| **`FA-007`** | MEDIUM | `getPrismaClient()` & `/sign-up` & `users-control-policy` silently fall back to mock/demo data in `production` | **Phase 4** |
| **`FA-008`** | MEDIUM | `/contact` inquiries saved in `audit_logs`, `listContactSubmissions()` built but has no `/vcon` admin UI | **Phase 5** |
| **`FA-009`** | MEDIUM | `admin_accounts` audit `targetType` mismatch (`admin_account` / `user` / `admin`) + missing `authSource` in message/attachment routes + profile phone UI for admins | **Phase 1** (audit/authSource) & **Phase 5** (admin profile phone parity) |
| **`FA-010`** | MEDIUM | `tryProvisionStarterMailbox()` fallback creates broken `mailbox` row without trailing `/`, `mailserver` sync, or Maildir on disk | **Phase 3** |
| **`FA-011`** | MEDIUM | Partial/unwired items: `PublicSiteFooter` `sourceCodeUrl`, cold `manifest.ts`, `/health/ready` ignoring `mailServices.connected`, `verifyRoutingDns` `127.0.0.1` skip, raw `USE_X_ACCEL_REDIRECT`, `trusted-operations.ts` empty stubs | **Phase 3**, **Phase 4**, **Phase 6** |

---

## 3. Baseline Test & Verification Commands (`package.json`)
- Static Checks: `npm run typecheck`, `npm run lint`, `npm run db:validate`
- Unit & Contract Suites: `npm run test:unit`, `npm run test:ui`
- Production Build: `npm run build`
- Infra Check: `docker compose config`
