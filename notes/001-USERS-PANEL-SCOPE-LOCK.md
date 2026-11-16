# 001 — Users Panel Scope Lock & Implementation Log

**Status:** Completed & Verified  
**Target Area:** Users Panel (`/users/*` & workspace sidebar navigation)

---

## 1. Strict Scope Lock

### In-Scope (Implemented)
1. **Sidebar `Add mailbox` nav button**
   - `src/components/layout/app-shell.tsx`: Added `Add mailbox` button under `Workspace navigation` (`!isAdminRoute`), closing mobile drawer and dispatching `readbox:open-create-mailbox`.
   - `src/components/users/users-workspace-shell.tsx`: Listens for `readbox:open-create-mailbox` to open `<CreateUserMailboxModal />` from any `/users/*` route when quota permits, or displays exact policy/quota error via `notify.error(...)`.
   - `src/app/(workspace)/layout.tsx`: Passes active `user.id` when loading demo workspace mailboxes for sidebar consistency.
2. **User Panel Personal & Profile Settings Page (`/users/settings`)**
   - `src/components/layout/app-shell.tsx`: Added `Settings` (`/users/settings`) link in `workspaceNavigation`.
   - `src/core/accounts/user-profile-schema.ts`: Pure Zod validation schemas (`firstName`, `lastName`, `email`, `phone`, plus `validateUserPasswordInput` enforcing policy min length, complexity, non-reuse, confirmation) and security summary types/formatters.
   - `src/core/accounts/user-profile.ts`: Server-side `getUserProfile`, `updateUserProfile`, `getUserSecuritySnapshot`, `updateUserPassword`, `revokeUserSessionById`, and `revokeOtherUserSessions` with Argon2 verification/hashing, transaction-safe updates, active session protection, and audit logging.
   - `src/core/auth/dev-demo-auth.ts`: Added demo profile/password overrides, demo session metadata tracking, and demo security event feed so all profile & security actions persist in local demo mode too.
   - `src/app/(workspace)/users/settings/current-session.ts`: Server-only helper decoding the Auth.js JWT cookie to identify the current session ID safely without modifying `src/auth.ts` or exposing raw session IDs to the client.
   - `src/app/(workspace)/users/settings/actions.ts`, `src/app/(workspace)/users/settings/page.tsx`, and `src/components/users/user-settings-view.tsx`: Built strictly with `@/components/ui` primitives (`PageHeader`, `Panel`, `FormField`, `Input`, `Checkbox`, `Button`, `IconButton`, `Badge`, `AlertBanner`, `Table`, `MonoText`, `notify`) for Profile Details, Account Summary, Change Password, Active Sessions Management, and Recent Security Activity.
3. **Tests**
   - `tests/messages/user-profile-settings.test.ts`: Unit tests for profile & password validation, demo persistence/session revocation, and Prisma + audit log updates.
   - `tests/ui/app-shell.test.tsx`: Assertions for `Settings` link and `Add mailbox` event dispatch.
   - `tests/ui/users-settings.test.tsx`: UI tests for `UsersWorkspaceShell` modal/quota behavior, `UserSettingsView` profile edit, password update, active sessions revocation, and security activity.

### Out-of-Scope (Locked — Untouched)
- `/vcon/*` admin console pages and admin services
- Public landing/contact/privacy pages and auth pages (`/sign-in`, `/sign-up`, `/reset-password`)
- Email message reader, HTML sanitizer, and attachment endpoints
- `prisma/schema.prisma`

---

## 2. Verification Status

- [x] `npm run typecheck`
- [x] `npm run test:unit` (including `tests/messages/user-profile-settings.test.ts`)
- [x] `npm run test:ui` (16 test files, 63/63 tests)
- [x] `playwright-cli` browser verification (`/users/settings` password update, sign-in verification, active sessions, security activity, light/dark themes, mobile)
- [x] `compile_applet`, `lint_applet`, `NODE_ENV=production npm run build`
