# User accounts, administrators, permissions and audit

ReadBox separates the ordinary user workspace (`/users`) and protected management workspace (`/vcon`). The authenticated administrator has an Admin panel, while a normal user sees only assigned mailboxes and permitted actions.

## Users and user control

**Admin → Users** lists users, role, status, mailbox assignments, last sign-in and delete capabilities. **Add user** opens a managed account form with generated password assistance and mailbox assignment controls. Edit/delete operations enforce authorization and account safety guards.

**Admin → Users control** is the central policy page:
- Enable or disable public `/sign-up`.
- Choose which name, email and phone fields are required/optional/hidden.
- Configure password length/strength, and sign-up verification mode: **Instant activation**, **Invite code required** or **Admin approval**.
- Set allowed domains, default mailbox quota, self-service creation and deletion permissions, optional starter mailbox creation, and message retention.
- Approve or reject pending registrations and override permitted domains, quotas and capabilities for individual users.

Policies are persisted through `UserControlSettings` and `UserAccessPolicy` rather than browser-only flags; the message/mailbox services enforce them.

## Login and first-time administrator

Public user login is `/sign-in`, admin login is `/vcon/login`. The initial owner may use `/initial-setup` only with the installer activation gate; a forced password reset follows. Password reset is token-based and governed by separate user/admin reset records; **an automatic email reset service is not demonstrated by this code**. A browser form should not be mistaken for email delivery of reset links.

## Profile and sessions

**User → Settings** supports account profile changes, password changes, active-session review, revoking one session and signing out other sessions (subject to current account policy). Sessions are registered and validated against PostgreSQL records even though Auth.js uses a JWT cookie transport. Login failures and lockouts are recorded.

## Audit & security

**Admin → Audit & security** provides action audit logs, recent login attempts and lockout monitoring. Search/filter controls are informational; audit data is sanitized before storage/display. Do not assume the audit UI exposes raw tokens or private logs.

**Source:** `src/auth.ts`, `src/core/auth/{credentials,session-registry,route-guards,sign-up,password-reset}.ts`, `src/core/accounts/{users,user-control-policy,user-profile}.ts`, `src/core/audit/{record,queries}.ts`, `src/components/vcon/{users-control-console,users-directory,audit-console}.tsx`.
