# ReadBox — Baseline Freeze (`v0.1.0-baseline`)

> **Freeze Timestamp:** `2026-11-16`  
> **Application Identity:** `ReadBox` (`package.json` `"name": "readbox"`, `"version": "0.1.0"`)  
> **Authoritative Policy:** Single PostgreSQL database via Prisma (`AGENTS.md`), Next.js App Router (`16.4.2`), React `19.3.0`, Tailwind CSS v4 (`src/app/globals.css`).

---

## 1. Purpose of This Baseline Freeze

এই ফাইলটি প্রজেক্টের বর্তমান Production-Ready Update শুরুর আগের **Frozen Reference Baseline**।
পরবর্তী যেকোনো BugFix বা UI/UX Phase এই baseline-এর সাথে তুলনা করে **Scope Lock** মেনে implement হবে — যাতে কোনো চলমান feature ভেঙে না যায় এবং অপ্রয়োজনীয় refactor না হয়।

---

## 2. Frozen Runtime & Stack Inventory

| Layer | Technology / Version (from `package.json`) | Source Entry |
|---|---|---|
| Framework | Next.js `16.4.2` (App Router), React `19.3.0`, TypeScript `^5.0.0` | `src/app/`, `next.config.ts` |
| Styling & Theme | Tailwind CSS `^4.0.0`, `next-themes` `^0.4.6`, `lucide-react` `^1.59.0`, `sonner` `^2.0.8` | `src/app/globals.css`, `src/components/ui/` |
| Auth & Crypto | `next-auth` `^5.0.0-beta.32`, `@node-rs/argon2` `^2.2.2`, `zod` `^4.6.7` | `src/auth.ts`, `src/core/auth/` |
| Database & ORM | PostgreSQL + Prisma `^7.10.1` (`@prisma/adapter-pg`) | `prisma/schema.prisma`, `src/core/database/` |
| Mail & HTML Pipeline | `postal-mime` `^4.2.1`, `sanitize-html` `^2.18.2`, `css-tree` `^3.2.1` | `src/core/ingestion/`, `src/core/messages/` |
| Testing Tooling | Node `node:test` (`tsx`), Vitest `^5.0.5` + Testing Library | `tests/`, `vitest.config.mts` |

---

## 3. Frozen Route Surface (App Router `src/app/`)

### 3.1 Public & Auth Routes
- `/` — Landing Page (`src/app/page.tsx`)
- `/contact` — Public Support & Onboarding Contact Form (`src/app/contact/page.tsx`)
- `/privacy` — Privacy Policy Page (`src/app/privacy/page.tsx`)
- `/sign-in` — Dedicated Regular User Sign-In (`src/app/sign-in/page.tsx`)
- `/sign-up` — Dynamic User Self-Registration (`src/app/sign-up/page.tsx`)
- `/reset-password` — Token-Based Password Reset (`src/app/reset-password/page.tsx`)
- `/vcon/login` — Separate Admin Sign-In (`src/app/vcon/login/page.tsx`)
- `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`

### 3.2 User Workspace Routes (`/users/*`)
- `/users` — User Workspace Overview (`src/app/(workspace)/users/page.tsx`)
- `/users/mailboxes` — User Mailbox Directory, Create, Status Toggle & Purge (`src/app/(workspace)/users/mailboxes/page.tsx`)
- `/users/inbox/[mailboxUuid]` — Split-View Inbox & Message Reader (`src/app/(workspace)/users/inbox/[mailboxUuid]/page.tsx`)
- `/users/inbox/[mailboxUuid]/[messageUuid]` — Direct / Deep-Linked Opened Message View (`src/app/(workspace)/users/inbox/[mailboxUuid]/[messageUuid]/page.tsx`)

### 3.3 Admin Console Routes (`/vcon/*`)
- `/vcon` — Admin System Overview (`src/app/(workspace)/vcon/page.tsx`)
- `/vcon/operations` — Mail Ingestion, Body Repair & Operations (`src/app/(workspace)/vcon/operations/page.tsx`)
- `/vcon/domains` & `/vcon/domains/new` — Domain Management & DNS Verification (`src/app/(workspace)/vcon/domains/`)
- `/vcon/mailboxes` & `/vcon/mailboxes/new` — Admin Mailbox Directory & Provisioning (`src/app/(workspace)/vcon/mailboxes/`)
- `/vcon/users`, `/vcon/users/new`, `/vcon/users/[id]/edit` — User Management (`src/app/(workspace)/vcon/users/`)
- `/vcon/users/control` — Global Sign-Up, Approval, Quota, Domain & Retention Policy Engine (`src/app/(workspace)/vcon/users/control/page.tsx`)
- `/vcon/audit` — Audit Log & Lockout Telemetry (`src/app/(workspace)/vcon/audit/page.tsx`)
- `/vcon/settings` — Site Branding, Logo/Favicon & Contact Settings (`src/app/(workspace)/vcon/settings/page.tsx`)
- `/vcon/system-update` — Release Check, Preflight & Update Queue (`src/app/(workspace)/vcon/system-update/page.tsx`)

### 3.4 API & Health Routes
- `/api/auth/[...nextauth]`
- `/api/contact`, `/api/contact/csrf`, `/api/contact/health`
- `/api/media/[...path]`
- `/api/messages/live`, `/api/messages/html/[messageUuid]`, `/api/messages/attachment/[attachmentUuid]`
- `/api/site-settings`
- `/api/vcon/domains/dns-preview`, `/api/vcon/domains/[uuid]/dns-status`
- `/api/vcon/update/check`, `/api/vcon/update/preflight`, `/api/vcon/update/start`, `/api/vcon/update/status`
- `/health/live`, `/health/ready`, `/health/site-settings`

---

## 4. Frozen Global UI Component Library (`src/components/ui/`)

Currently exported by `src/components/ui/index.ts`:
- `AlertBanner` (`alert-banner.tsx`)
- `Badge` (`badge.tsx`)
- `Button` (`button.tsx`)
- `Checkbox` (`checkbox.tsx`)
- `CopyButton` (`copy-button.tsx`)
- `Dialog`, `DialogClose`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogTitle`, `DialogTrigger` (`dialog.tsx`)
- `FormField` (`form-field.tsx`)
- `Icon` (`icon.tsx`)
- `IconButton` (`icon-button.tsx`)
- `Input` (`input.tsx`)
- `Label` (`label.tsx`)
- `NotificationToaster`, `notify` (`notifications.tsx`)
- `Panel`, `PanelBody`, `PanelHeader` (`panel.tsx`)
- `Select` (`select.tsx`)
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` (`table.tsx`)
- `MonoText`, `MutedText`, `PageTitle`, `SectionTitle` (`text.tsx`)
- `Textarea` (`textarea.tsx`)

---

## 5. Frozen Database Schema Models (`prisma/schema.prisma`)

1. Identity & Auth: `User`, `AdminAccount`, `AdminSession`, `AdministratorProfile`, `AppSession`, `LoginAttempt`, `PasswordResetToken`
2. Access & Policy Control: `UserAccessPolicy`, `UserControlSettings`
3. Mail Infrastructure & Messages: `Domain`, `Mailbox`, `MailboxMembership`, `Message`, `MessageAttachment`, `IngestionState`
4. Site & Operations: `SiteSettings`, `AuditLog`, `ContactSubmission` (verified in schema/core)

---

## 6. Frozen Verification Baseline Commands

```bash
npm run typecheck      # next typegen && tsc --noEmit
npm run lint           # eslint .
npm run test:unit      # compat, postfix, setup, auth, audit, admin, messages, target-guard
npm run test:ui        # vitest run --config vitest.config.mts
npm run build          # next build
```

---

## 7. Baseline Match Declaration

এই `000-BASELINE-FREEZE.md`-এর সব route, Prisma model, API endpoint, এবং UI export [`001-PRODUCTION-FORENSIC-AUDIT.md`](./001-PRODUCTION-FORENSIC-AUDIT.md)-এর প্রতিটি code proof-এর সাথে **100% matched**। Phase-01 শুরু করার আগে কোনো অঘোষিত কোড পরিবর্তন করা হয়নি।
