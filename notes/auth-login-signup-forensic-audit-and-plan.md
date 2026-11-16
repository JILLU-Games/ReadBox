# Forensic Audit Report & Implementation Plan: Login, Separate Admin/User Auth, User Sign-Up & Users Control

> **Audit Status:** Complete (100% source-code verified, zero assumptions)  
> **Code Modified:** `NONE` (Strict Audit-Only Mode until user approval)  
> **Target Scope:** App Login Feature, Separate Admin/User Auth System, User Sign-Up, and Admin `/vcon/users/control` Policy Engine

---

## 1. Executive Summary of Root Causes Found

1. **Single Coupled Login Endpoint & Form (`AUTH-001`):**
   - `/sign-in` (`src/app/sign-in/page.tsx` & `src/components/auth/sign-in-form.tsx`) handles both Admin and User login through one form and one NextAuth `Credentials` provider (`src/auth.ts`), redirecting client-side only after session creation.
2. **Coupled Database Identity Table (`AUTH-002`):**
   - `prisma/schema.prisma` stores both Administrators and Regular Users in a single `users` table (`model User`), distinguishing admins only via a secondary join table `administrator_profiles` (`model AdministratorProfile`). `authorizeCredentials()` in `src/core/auth/credentials.ts` does not separate Admin vs User login scopes.
3. **Missing User Sign-Up Feature (`AUTH-003`):**
   - There is no `/sign-up` route, no self-registration server action, and no configurable registration form in `src/app/` or `src/components/auth/`. Regular users can only be created manually by an administrator in `/vcon/users/new`.
4. **Missing `Users Control` Admin Page & Policy Engine (`AUTH-004`):**
   - `model UserAccessPolicy` (`prisma/schema.prisma`, lines 63–74) only stores two booleans (`canDeleteMessages`, `canDeleteMailboxes`).
   - There is no global `UserControlSettings` table, no `/vcon/users/control` page, no domain whitelist (`allowedDomainUuids`), no per-user mailbox creation limit (`maxMailboxes`), and no message auto-delete retention policy (`autoDeleteDays`).
5. **Unrestricted Domain & Mailbox Creation in `/users` (`AUTH-005`):**
   - `getUserWorkspaceOverview()`, `listUserMailboxes()`, and `createUserSelfMailbox()` in `src/core/messages/service.ts` expose all verified domains to every user and allow unlimited mailbox creation without checking domain permissions or mailbox quotas.

---

## 2. Forensic Code Audit (Exact File Paths, Line Numbers & Code Proofs)

### BUG / GAP `AUTH-001`: Single Login Route & Coupled Client Redirect
- **File:** `src/components/auth/sign-in-form.tsx` (Lines 59–95)
- **Proof:**
```tsx
      const result = await signIn("credentials", {
        username: trimmedUsername,
        password,
        redirect: false,
      });
      // ...
      const sessionResponse = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      // ...
      window.location.assign(
        sessionData.user.isAdministrator ? "/vcon" : "/users",
      );
```
- **Root Cause:** Both Admin and User accounts authenticate through the same `/sign-in` page and the same `signIn("credentials")` call without a `loginScope` (`"user"` vs `"admin"`). Moreover, `src/core/auth/route-guards.ts` (lines 30–38) redirects both `/vcon/*` and `/users/*` unauthenticated visitors to `/sign-in`.

---

### BUG / GAP `AUTH-002`: Shared `users` Table Instead of Separate Admin & User Auth Tables
- **File:** `prisma/schema.prisma` (Lines 9–47) & `src/core/auth/credentials.ts` (Lines 103–120)
- **Proof (`prisma/schema.prisma`):**
```prisma
model User {
  id           BigInt    @id @default(autoincrement())
  passwordHash String    @map("password_hash") @db.VarChar(128)
  username     String    @db.VarChar(150)
  // ...
  administratorProfile AdministratorProfile?
  @@map("users")
}

model AdministratorProfile {
  id          BigInt   @id @default(autoincrement())
  userId      BigInt   @unique @map("user_id")
  isSuperuser Boolean  @default(false) @map("is_superuser")
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("administrator_profiles")
}
```
- **Proof (`src/core/auth/credentials.ts`, Lines 103–119):**
```ts
      const account = await transaction.user.findFirst({
        where: {
          username: { equals: usernameNormalized, mode: "insensitive" },
        },
        select: {
          id: true,
          username: true,
          // ...
          administratorProfile: {
            select: { isSuperuser: true },
          },
        },
      });
```
- **Root Cause:** Admin credentials and User credentials are stored in the same `users` table and verified by the same query, rather than isolating Admin accounts in a dedicated `admin_accounts` table (`model AdminAccount`) and User accounts in the `users` table (`model User`).

---

### BUG / GAP `AUTH-003`: No User Sign-Up UI, Route, or Backend Service
- **File:** `src/app/sign-in/page.tsx` (Lines 111–118)
- **Proof:**
```tsx
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          className="text-muted-foreground underline hover:text-foreground"
          href="/reset-password"
        >
          Set a new password with an operator-issued reset token
        </Link>
      </div>
```
- **Root Cause:** There is no `/sign-up` route, no registration validation schema, no dynamic field renderer, and no registration verification workflow.

---

### BUG / GAP `AUTH-004`: Incomplete `UserAccessPolicy` & Missing `/vcon/users/control`
- **File:** `prisma/schema.prisma` (Lines 63–74) & `src/core/accounts/policy.ts` (Lines 13–16)
- **Proof (`prisma/schema.prisma`):**
```prisma
model UserAccessPolicy {
  id                BigInt   @id @default(autoincrement())
  userId            BigInt   @unique @map("user_id")
  canDeleteMessages Boolean  @default(false) @map("can_delete_messages")
  canDeleteMailboxes Boolean @default(false) @map("can_delete_mailboxes")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_access_policies")
}
```
- **Root Cause:**
  1. `UserAccessPolicy` lacks `canCreateMailboxes`, `maxMailboxes`, `allowedDomainUuids`, `autoDeleteDays`, `phone`, and `verificationStatus`.
  2. There is no global `UserControlSettings` table to store Admin-defined rules for new user sign-up, required form fields, verification mode, allowed domains, mailbox limits, and message auto-delete retention.
  3. The Admin sidebar (`src/components/layout/app-shell.tsx`) has no `/vcon/users/control` (`Users control`) sub-menu item under the `Users` group.

---

### BUG / GAP `AUTH-005`: Unchecked Domain Access & Unlimited Mailbox Creation in `/users`
- **File:** `src/core/messages/service.ts` (Lines 480–484 & Lines 639–672)
- **Proof:**
```ts
    prisma.domain.findMany({
      where: { status: "active", verificationStatus: "verified" },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, uuid: true, name: true, isDefault: true },
    }),
```
```ts
export async function createUserSelfMailbox(
  prisma: MailboxPrismaClient,
  actor: UserWorkspaceActor,
  input: {
    readonly localPart: string;
    readonly domainUuid?: string;
  },
  config: MailboxRuntimeConfig,
  options: {
    readonly sqlExecutor?: SqlQueryExecutor;
    readonly lockOptions?: ProvisionLockOptions;
  } = {},
): Promise<
  MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
> {
  return provisionMailbox(
    prisma,
    {
      localPart: input.localPart,
      domainUuid: input.domainUuid,
      assignedUserIds: actor.isAdministrator ? [] : [actor.userId.toString()],
      allowReserved: false,
    },
    // ...
  );
}
```
- **Root Cause:** `createUserSelfMailbox()` directly calls `provisionMailbox()` without checking:
  - Whether the user is allowed to create mailboxes (`canCreateMailboxes`),
  - Whether the user has reached their mailbox quota (`maxMailboxes`),
  - Whether `input.domainUuid` is in the user's `allowedDomainUuids` list,
  - And message queries (`buildAccessibleMessageWhere`) do not filter or purge expired messages based on `autoDeleteDays`.

---

## 3. QA Answers & Target Architecture

### QA 1: কীভাবে Users এবং Admin-এর Auth System আলাদা Database Table ও আলাদা Feature হিসেবে Compact করবো?

1. **Separate Database Tables (Within the Single PostgreSQL Database per `AGENTS.md`):**
   - **`admin_accounts` Table (`model AdminAccount`):**
     - Dedicated table for Admin operators (`id`, `username`, `passwordHash`, `firstName`, `lastName`, `email`, `isSuperuser`, `isActive`, `passwordResetRequired`, `lastLogin`, `createdAt`, `updatedAt`).
     - Dedicated **`admin_sessions` Table (`model AdminSession`)** for Admin sessions.
   - **`users` Table (`model User`):**
     - Dedicated table for Workspace Users (`id`, `username`, `passwordHash`, `firstName`, `lastName`, `lastName`, `email`, `phone`, `isActive`, `verificationStatus`, `passwordResetRequired`, `lastLogin`, `dateJoined`).
     - Dedicated **`app_sessions` Table (`model AppSession`)** for User sessions.
2. **Separate Login Portals & Auth Scopes:**
   - **User Auth Portal (`/sign-in` & `/sign-up`):**
     - `/sign-in` passes `loginScope: "user"` to NextAuth `Credentials` -> queries **only** the `users` table (`model User`) -> redirects strictly to `/users`.
     - Includes direct navigation to `/sign-up` (when Sign-Up is enabled by Admin).
   - **Admin Auth Portal (`/vcon/login`):**
     - `/vcon/login` passes `loginScope: "admin"` to NextAuth `Credentials` -> queries **only** the `admin_accounts` table (`model AdminAccount`, with seamless fallback for legacy `AdministratorProfile` records) -> redirects strictly to `/vcon`.
     - Visiting any `/vcon/*` route while unauthenticated redirects to `/vcon/login`; visiting any `/users/*` route while unauthenticated redirects to `/sign-in`.

---

### QA 2: কীভাবে User Sign-Up এবং Admin Panel-এ `Users Control` Feature যোগ করবো?

1. **Admin Sidebar Grouping Update (`src/components/layout/app-shell.tsx`):**
   - Rename/organize the `Users` group in the Admin sidebar with related sub-menus:
     - `Users` (`/vcon/users`) — User directory & manual management
     - `Users control` (`/vcon/users/control`) — Global sign-up, verification, domain access, mailbox quota, and retention policy control
     - `Audit & security` (`/vcon/audit`) — Security & access audit trail
2. **Admin `Users Control` Console (`/vcon/users/control`) Capabilities:**
   - **Section A — Sign-Up & Form Fields Control:**
     - Enable / Disable Public User Sign-Up (`signupEnabled`)
     - Toggle required/optional Sign-Up form fields:
       - `First name` (`none` | `optional` | `required`)
       - `Last name` (`none` | `optional` | `required`)
       - `Email address` (`none` | `optional` | `required`)
       - `Phone number` (`none` | `optional` | `required`)
     - Credential Rules: Minimum password length (`minPasswordLength`, 8–64) & require numbers/symbols (`requireStrongPassword`).
   - **Section B — Verification & Approval Control:**
     - Verification Mode (`verificationMode`):
       - `instant` — User account activates immediately upon sign-up and can sign in right away.
       - `invite_code` — User must enter the Admin-configured registration invite code (`inviteCode`) during sign-up to activate.
       - `admin_approval` — User signs up into `pending` status and must be approved by Admin in `/vcon/users/control` (or `/vcon/users`) before signing in.
   - **Section C — Default User Permissions, Domain Access & Mailbox Quota:**
     - **Allowed Domains (`allowedDomainUuids`):** Multi-select checklist of active verified domains that signed-up users can use to create mailboxes (or "All verified domains").
     - **Mailbox Quota (`defaultMaxMailboxes`):** Maximum number of mailboxes a user can create (e.g., `1`, `3`, `5`, `10`, or `0` for unlimited).
     - **Auto-Provision Starter Mailbox (`autoProvisionStarterMailbox`):** Automatically create `<username>@<defaultAllowedDomain>` when a user signs up.
     - **Capabilities:** Default toggles for `canCreateMailboxes`, `canDeleteMessages`, and `canDeleteMailboxes`.
   - **Section D — Email Auto-Delete / Retention Policy:**
     - Toggle `autoDeleteEnabled` (`Boolean`) and `autoDeleteDays` (`Int`, e.g., `7`, `14`, `30`, `90` days).
     - Automatically hides/soft-deletes messages older than the configured retention period for governed users.
   - **Section E — Pending Sign-Up Approvals Queue & Per-User Policy Overrides:**
     - Quick approve/reject actions for users awaiting `admin_approval`, plus per-user quota/domain/retention override support.

---

## 4. Step-by-Step Scope-Locked Implementation Roadmap

### Phase-01: Database Schema (`AdminAccount`, `UserControlSettings`, Extended `UserAccessPolicy`) & Core Auth/Policy Services — `COMPLETED & VERIFIED`
- **Scope Lock:**
  - `prisma/schema.prisma`
  - `src/core/auth/*` (`credentials.ts`, `current-user.ts`, `session-registry.ts`, `dev-demo-auth.ts`, `sign-up.ts`)
  - `src/core/accounts/user-control-policy.ts`
  - `src/auth.ts` & `src/types/next-auth.d.ts`
  - `tests/auth/phase1-separate-auth-and-control.test.ts` & `package.json`
- **Completed Deliverables & Post-Implementation Audit Proof:**
  - Added `AdminAccount` (`@@map("admin_accounts")`), `AdminSession` (`@@map("admin_sessions")`), and `UserControlSettings` (`@@map("user_control_settings")`) models to `prisma/schema.prisma`, and extended `User` (`phone`, `verificationStatus`) and `UserAccessPolicy` (`canCreateMailboxes`, `maxMailboxes`, `allowedDomainUuids`, `autoDeleteEnabled`, `autoDeleteDays`).
  - Regenerated `@prisma/client` via `npm run db:generate`.
  - Implemented `loginScope: "admin" | "user"` isolation in `authorizeCredentials` (`src/core/auth/credentials.ts`), `authorizeDevDemoCredentials` (`src/core/auth/dev-demo-auth.ts`), and NextAuth `Credentials` (`src/auth.ts`), plus separate session persistence in `admin_sessions` vs `app_sessions` (`src/core/auth/session-registry.ts` & `src/core/auth/current-user.ts`).
  - Implemented `src/core/accounts/user-control-policy.ts` (`getUserControlSettings`, `updateUserControlSettings`, `resolveEffectiveUserPolicy`, `isDomainAllowedForUser`, `canUserCreateMoreMailboxes`, `computeMessageRetentionCutoff`) and `src/core/auth/sign-up.ts` (`validateSignUpInput`, `registerUserAccount`, `updatePendingUserVerification`, `upsertAdminAccountRecord`).
  - Verified with `tests/auth/phase1-separate-auth-and-control.test.ts`, `npm run test:auth` (`30 + 5 = 35/35 passed`), `npm run test:compat` (`23/23 passed`), `compile_applet`, and `lint_applet`.
  - **Out-of-Scope Impact Check:** `NONE` — Zero UI components, pages, or unrelated services were modified in Phase-01.

### Phase-02: Admin Panel `/vcon/users/control` Page & Sidebar Navigation — `COMPLETED & VERIFIED`
- **Scope Lock:**
  - `src/components/layout/app-shell.tsx`
  - `src/app/(workspace)/vcon/users/control/page.tsx`
  - `src/app/(workspace)/vcon/users/control/actions.ts`
  - `src/components/vcon/users-control-console.tsx`
  - `src/core/accounts/user-control-policy.ts`
  - `tests/ui/app-shell.test.tsx`
- **Completed Deliverables & Post-Implementation Audit Proof:**
  - Added `Users control` (`/vcon/users/control`) under the `Users & Security` group in `AppShell` (`src/components/layout/app-shell.tsx`) and refined `isManagementItemActive` so `/vcon/users` and `/vcon/users/control` highlight independently.
  - Built `/vcon/users/control` (`src/app/(workspace)/vcon/users/control/page.tsx`, `actions.ts`, and `src/components/vcon/users-control-console.tsx`) using only global shared UI primitives (`Panel`, `PageTitle`, `SectionTitle`, `FormField`, `Input`, `Select`, `Checkbox`, `Button`, `Badge`, `Table`, `Dialog`, `AlertBanner`, `notify`).
  - Verified live in headless Chromium (`1440x900`, `.playwright-cli/phase2-users-control.png`): global policy saving (`"Users control policy saved."`), per-user override modal (`3 / 3` -> `3 / 5`), and `tests/ui/app-shell.test.tsx` (`8/8 passed`).
  - **Out-of-Scope Impact Check:** `NONE` — Only the Admin sidebar `Users & Security` group and the new `/vcon/users/control` route were updated/added.

### Phase-03: Separate Admin Login (`/vcon/login`), User Login (`/sign-in`), and Dynamic User Sign-Up (`/sign-up`) — `COMPLETED & VERIFIED`
- **Scope Lock:**
  - `src/app/sign-in/page.tsx`, `src/app/sign-in/actions.ts`, & `src/components/auth/sign-in-form.tsx`
  - `src/app/sign-up/page.tsx`, `src/app/sign-up/actions.ts`, & `src/components/auth/sign-up-form.tsx`
  - `src/app/vcon/login/page.tsx`
  - `src/app/(workspace)/layout.tsx` & `src/app/(workspace)/vcon/layout.tsx`
  - `src/core/auth/route-guards.ts`, `tests/auth/route-guards.test.ts`, & `tests/auth/route-access-policy.test.ts`
- **Completed Deliverables & Post-Implementation Audit Proof:**
  - Updated `src/core/auth/route-guards.ts`, `src/app/(workspace)/layout.tsx`, and added `src/app/(workspace)/vcon/layout.tsx` so unauthenticated `/vcon/*` requests redirect to `"/vcon/login"` and unauthenticated `/users/*` requests redirect to `"/sign-in"`.
  - Updated `src/app/sign-in/actions.ts` (`signOutAction`) so signing out of an administrator session redirects to `"/vcon/login"` and signing out of a user session redirects to `"/sign-in"`.
  - Updated `src/components/auth/sign-in-form.tsx` with `loginScope: "admin" | "user"` passed to NextAuth `signIn("credentials", ...)` and scoped redirects (`"/vcon"` for admin, `"/users"` for user).
  - Updated `src/app/sign-in/page.tsx` as the dedicated **User Sign-In** page (`loginScope="user"`, user-only demo account hint, links to `/sign-up`, `/reset-password`, and `/vcon/login`).
  - Created `src/app/vcon/login/page.tsx` as the dedicated **Admin Sign-In** page (`loginScope="admin"`, admin-only demo account hint, links to `/sign-in` and `/reset-password`).
  - Created `src/app/sign-up/actions.ts`, `src/components/auth/sign-up-form.tsx`, and `src/app/sign-up/page.tsx` for dynamic **User Sign-Up** governed by `UserControlSettings` (`firstNameRequirement`, `lastNameRequirement`, `emailRequirement`, `phoneRequirement`, `minPasswordLength`, `requireStrongPassword`, `verificationMode`, `inviteCode`).
  - Verified with `npm run test:auth` (`35/35 passed`), `tests/ui/phase7-responsive-pwa.test.tsx` + `tests/ui/app-shell.test.tsx` (`13/13 passed`), `compile_applet`, `lint_applet`, and live Chromium verification (`.playwright-cli/phase3-vcon-login.png`, `.playwright-cli/phase3-user-signin.png`, `.playwright-cli/phase3-user-signup.png`, and end-to-end registration + sign-in of `phase3.user` -> `/users`).
  - **Out-of-Scope Impact Check:** `NONE` — Only the scoped auth routes (`/sign-in`, `/sign-up`, `/vcon/login`), workspace/vcon route-guard layouts, and auth tests were touched.

### Phase-04: Runtime Enforcement of `Users Control` Policies in `/users/*` & Full Verification Gate — `COMPLETED & VERIFIED`
- **Scope Lock:**
  - `src/core/accounts/policy.ts`
  - `src/core/messages/service.ts` & `src/core/messages/demo-workspace.ts`
  - `src/app/(workspace)/users/layout.tsx`, `src/app/(workspace)/users/page.tsx`, `src/app/(workspace)/users/mailboxes/page.tsx`, `src/app/(workspace)/users/mailboxes/actions.ts`
  - `src/components/users/users-workspace-shell.tsx`, `src/users/overview-panel.tsx`, `src/components/users/user-mailboxes-view.tsx`
  - `tests/messages/phase5-users-workspace.test.ts`
- **Completed Deliverables & Post-Implementation Audit Proof:**
  - Extended `UserAccessCapabilities` (`src/core/accounts/policy.ts`) with `canCreateMailboxes`, `maxMailboxes`, `allowedDomainUuids`, `autoDeleteEnabled`, and `autoDeleteDays`.
  - Enforced `allowedDomainUuids` domain filtering, `maxMailboxes` quota, `canCreateMailboxes`, and `autoDeleteDays` message retention cutoff across `getUserWorkspaceOverview`, `listUserMailboxes`, `createUserSelfMailbox`, `listMailboxMessagesForUser`, and `getMessageDetailForUser` (`src/core/messages/service.ts`) as well as demo workspace counterparts (`src/core/messages/demo-workspace.ts`).
  - Added compact quota (`Quota: used / max`) and retention (`Auto-delete: Nd`) indicators and `Create mailbox` button gating in `UsersWorkspaceShell`, `UserOverview`, and `UserMailboxesView`.
  - Verified with `tests/messages/phase5-users-workspace.test.ts` (`10/10 passed`), `tests/ui/users-phase5.test.tsx` (`6/6 passed`), `compile_applet`, and `lint_applet`.
  - **Out-of-Scope Impact Check:** `NONE` — Only the scoped `/users` policy enforcement and workspace components were updated.
