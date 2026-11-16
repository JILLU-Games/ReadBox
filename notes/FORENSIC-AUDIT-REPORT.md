# ReadBox — Production & Engine Forensic Audit Report

**Audit Type:** 100% Source-Code-Verified Deep Forensic Audit (Zero Guesswork)  
**Scope:** Authentication, Registration & Password Reset, User Panel (`/users/*`), Admin Panel (`/vcon/*`), API Routes (`/api/*`), Core Backend Engines (`/src/core/*`), Prisma Schema & PostgreSQL Migrations (`/prisma/*`), Ops & System Updater (`/scripts/*`), and Demo Mode vs. Production Parity.  
**Report Policy:** Strictly findings, architectural gaps, demo-vs-production discrepancies, and verified source-code proofs (`file:line` + verbatim code blocks). No implementation plan is included in this file.

---

## 1. Executive Summary & Severity Matrix

| Severity | Count | Bug IDs |
| --- | ---: | --- |
| **CRITICAL** | 5 | `BUG-01`, `BUG-02`, `BUG-05`, `BUG-10`, `BUG-21` |
| **HIGH** | 9 | `BUG-03`, `BUG-06`, `BUG-07`, `BUG-11`, `BUG-12`, `BUG-13`, `BUG-15`, `BUG-16`, `BUG-20` |
| **MEDIUM** | 7 | `BUG-04`, `BUG-08`, `BUG-09`, `BUG-14`, `BUG-17`, `BUG-18`, `BUG-19` |
| **LOW** | 0 | — |
| **TOTAL** | **21** | **`BUG-01` – `BUG-21`** |

---

## 2. Classification Matrices (Per Audit Objectives)

### Category A — Features Working Only in Demo Mode or Silently Falling Back to Memory / Demo Data

| Bug ID | Feature / Subsystem | Reality in Source Code |
| --- | --- | --- |
| `BUG-05` | User Control Settings & Per-User Extended Policies (`/vcon/users/control`) | Catches DB errors and silently saves to in-memory `globalThis` demo store while returning `{ ok: true }`. `updateUserExtendedPolicy` reads `getUserControlSettings(null)` instead of DB; `listUsersControlSnapshot` injects `DEMO_VERIFIED_DOMAINS` even when `databaseConnected: true` if 0 DB domains exist; hardcodes `mailboxCount: 3` for `demo.user` despite 4 seeded mailboxes. |
| `BUG-06` | Site Settings Persistence (`/vcon/settings`) | Swallows PostgreSQL errors when `NODE_ENV !== "production"` and returns `{ ok: true, message: "Settings saved successfully." }` from an ephemeral in-memory object. |
| `BUG-07` | Public Contact / Inquiry Submission (`/contact`) | No Prisma model and no `/vcon` viewer exist. Inquiry payloads (`full_name`, `work_email`, `company`, `phone`, `message`) are stored only in an in-memory array (`submissionsStore`) and omitted from `audit_logs`. Uses hardcoded fallback HMAC secret when `AUTH_SECRET` / `CONTACT_SECRET_KEY` are unset. |
| `BUG-08` | Demo Workspace Enforcement & Live Polling (`/users/*`) | Bypasses ownership, capability restrictions (`canDeleteMessages: true` hardcoded), retention checks, and user-scoped quota (`store.mailboxes.length` global check). `pollDemoLivePayload` forces admin overview (`true`), hardcodes `cursor: 100`, and always returns `messages: []`. Inbox/message pages omit actor flags when calling demo helpers. |
| `BUG-09` | Installer / Trusted Setup Runner (`/src/core/setup/trusted-operations.ts`) | Exists only as isolated library modules with zero API routes or UI triggers anywhere in the app. |

### Category B — UI-Visible Controls Broken, Incomplete, Stale, or Unreachable

| Bug ID | UI Control / Flow | Reality in Source Code |
| --- | --- | --- |
| `BUG-11` | Self-Service Password Reset (`/reset-password`) | Displays token + password inputs, but has no "Forgot Password / Request Reset Token" flow or route, ignores dynamic `UserControlSettings.minPasswordLength` (hardcoded `minLength={15}` / `MIN_PASSWORD_LENGTH`), excludes `AdminAccount`, writes no audit log, and does not work in Demo Mode. |
| `BUG-12` | Auto-Provision Starter Mailbox Toggle (`/vcon/users/control`) | Admin UI & `UserControlSettings.autoProvisionStarterMailbox` toggle save to DB/demo store, but neither `registerSelfSignupUser` nor `createDevDemoDynamicUser` ever provisions a mailbox on signup. |
| `BUG-15` | Admin Switching Into `/users/*` Workspace | `AppShell` renders Management sidebar whenever `isAdministrator === true` regardless of route (`!isAdminRoute`), hiding User Workspace navigation and the sidebar **+ Add mailbox** button required by `UsersWorkspaceShell` (`readbox:open-create-mailbox` event). |
| `BUG-16` | Admin Self-Service Profile, Password & Sessions (`/users/settings` & `/vcon/*`) | `admin_table` administrators are blocked (`editable: false`, `canManageSecurity: false`) in `/users/settings` and have no profile/password/session management page in `/vcon/*`. Meanwhile `user_table` admins get contradictory `editable: false` on initial page fallback vs `editable: true` in `getUserProfile`. |
| `BUG-17` | Inbox Live Counters, Domain Select State, Sidebar Pagination & Silent DB Errors (`/users/*`) | `MailboxInboxView` (`liveCounts`) and `CreateUserMailboxModal` (`domainUuid`) fail to resync React state when props change on navigation. `/users/layout.tsx` fetches only `page: 1` (25 mailboxes) for sidebar Inboxes & polling scope, and `/users/*` pages swallow DB errors into unconfigured placeholders without logging. |
| `BUG-19` | Message Reader Inline `cid:` Images & Print View | HTML sanitizer strips `img` tags unless `src` is `data:image/{png,jpeg,gif,webp};base64,...`, breaking inline `cid:` attachments despite storing `isInline` / `contentId`. Print button triggers raw `window.print()` with no print CSS isolation, printing full sidebar/header chrome. |

### Category C — Critical Backend Engine, Schema, Auth/Session, Retention & Updater Defects

| Bug ID | Engine / Subsystem | Reality in Source Code |
| --- | --- | --- |
| `BUG-01` | Prisma Schema vs SQL Migrations Drift | `prisma/schema.prisma` defines `AdminAccount`, `AdminSession`, `UserControlSettings`, `User.phone`, `User.verificationStatus`, extended `UserAccessPolicy` columns, and `ReadBox` branding defaults, none of which exist in `/prisma/migrations/*.sql`. Fresh `prisma migrate deploy` produces a broken database. |
| `BUG-02` | Cross-Table Actor ID Collision & FK Failures | `AuditLog.actorId`, `MailboxMembership.assignedById`, `Mailbox.deletedById`, and `Message.deletedById` FK only to `users.id`. Queries look up numeric `actorId` in `prisma.user` without checking `authSource`, misattributing `AdminAccount` actions to unrelated `users.id` rows (and blocking deletion of `users.id = 1`), while direct `recordAudit` callers trigger FK failures (`audit_persistence_failed`). |
| `BUG-03` | Message Ingestion `parse_status` CHECK Failure | PostgreSQL CHECK constraint requires `('ok', 'warning', 'error', 'oversized')`, whereas `ingestion/service.ts` writes `"failed"` and `operations/service.ts` queries `"failed"`. |
| `BUG-04` | Mailbox Local-Part Regex Drift | Demo mode allows `+` and leading/trailing `.` / `-` / `_`, whereas `validators.ts` and `mailserver.postfix_virtual_mailboxes` SQL view reject them. |
| `BUG-10` | Session Device / IP / Last-Seen Tracking | Production `registerAppSession` & `getActiveAppSession` never capture `ipAddress`, `userAgent`, or update `lastSeenAt`, causing all production sessions in Security settings to show `"Unknown device"` and `null` IP/activity. |
| `BUG-13` | Admin User Creation/Update Collision & Operator Bootstrap | `createManagedUser` / `updateManagedUser` only check `prisma.user` for duplicate usernames (ignoring `prisma.adminAccount`). `bootstrapInitialAccount` creates legacy `User` + `AdministratorProfile` instead of `AdminAccount`. |
| `BUG-14` | Demo Dynamic User Overrides & Approval Audit Missing | `listDevDemoDynamicUsers` ignores `applyAccountOverrides`; `updateDevDemoDynamicUserStatus` emits no `appendDemoSecurityEvent`. |
| `BUG-18` | Live Polling Retention & Cross-Tab State Blindness | `pollLiveMessagesForUser` ignores user retention policy/cutoffs, sums raw unretained counters, and never notifies open tabs when existing messages are marked read/unread/deleted (`id <= requestedCursor`). |
| `BUG-20` | Message Auto-Delete Retention Policy (`autoDeleteEnabled` / `autoDeleteDays`) | Only filters UI reads; expired DB rows, Maildir files, and attachments are never purged; `mailbox.totalMessages` / `unreadMessages` stay inflated; and `{ receivedAt: { gte } }` excludes `receivedAt = null` rows despite JS fallback allowing them. |
| `BUG-21` | System Updater Path Mismatch & Legacy `vibmail` Hardcodes | `env-schema.ts` defaults `UPDATE_SCRIPT_PATH` to `/opt/vibmail/app/scripts/upgrade.sh` while `update_worker.py` uses `/opt/vibmail/app/scripts/updater/upgrade.sh`. Both `updates/service.ts`, `upgrade.sh`, and `backup.sh` hardcode legacy `/opt/vibmail`, `/etc/vibmail`, `/var/backups/vibmail`, `vibmail-web.service`, and `vibmail-ingestion.service`. |

---

## 3. Complete Forensic Bug Registry (Verified Code Proofs)

### BUG-01 — Prisma Schema vs. SQL Migrations Drift
- **Severity:** CRITICAL
- **Area:** Database Schema & Migrations (`/prisma/`)
- **Impact:** Running `prisma migrate deploy` on a fresh PostgreSQL database omits `admin_accounts`, `admin_sessions`, `user_control_settings`, `users.phone`, `users.verification_status`, extended `user_access_policies` columns, and updated `ReadBox` defaults—causing immediate runtime query failures (`P2021`/`P2022`) in production.

**Verified Code Proof — `/prisma/schema.prisma:18-58,103-143,338-353`:**
```prisma
// prisma/schema.prisma:18-21
  phone        String    @default("") @db.VarChar(40)
  isStaff      Boolean   @default(false) @map("is_staff")
  isActive     Boolean   @default(true) @map("is_active")
  verificationStatus String @default("verified") @map("verification_status") @db.VarChar(24)

// prisma/schema.prisma:40-58
model AdminAccount {
  id                    BigInt         @id @default(autoincrement())
  ...
  @@map("admin_accounts")
}

// prisma/schema.prisma:103-143
model UserAccessPolicy {
  id                 BigInt   @id @default(autoincrement())
  userId             BigInt   @unique @map("user_id")
  canCreateMailboxes Boolean  @default(true) @map("can_create_mailboxes")
  ...
  maxMailboxes       Int      @default(3) @map("max_mailboxes")
  allowedDomainUuids Json     @default("[]") @map("allowed_domain_uuids")
  autoDeleteEnabled  Boolean  @default(false) @map("auto_delete_enabled")
  autoDeleteDays     Int      @default(0) @map("auto_delete_days")
...
model UserControlSettings {
  id                          BigInt   @id @default(autoincrement())
  ...
  @@map("user_control_settings")
}

// prisma/schema.prisma:340,349
  siteName         String   @default("ReadBox") @map("site_name") @db.VarChar(120)
  sourceCodeUrl    String   @default("https://github.com/vibtools/ReadBox") @map("source_code_url") @db.VarChar(200)
```

**Verified Code Proof — `/prisma/migrations/20261017000000_initial_application_schema/migration.sql:5-42,169-185`:**
```sql
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "password_hash" VARCHAR(128) NOT NULL,
    "last_login" TIMESTAMPTZ(6),
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "username" VARCHAR(150) NOT NULL,
    "first_name" VARCHAR(150) NOT NULL DEFAULT '',
    "last_name" VARCHAR(150) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL DEFAULT '',
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "date_joined" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
...
CREATE TABLE "user_access_policies" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "can_delete_messages" BOOLEAN NOT NULL DEFAULT false,
    "can_delete_mailboxes" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_access_policies_pkey" PRIMARY KEY ("id")
);
...
CREATE TABLE "site_settings" (
    "id" BIGSERIAL NOT NULL,
    "site_name" VARCHAR(120) NOT NULL DEFAULT 'MailStack',
    ...
    "source_code_url" VARCHAR(200) NOT NULL DEFAULT 'https://github.com/vibtools/MailStack',
```
*(The other 3 migrations in `/prisma/migrations/` only add `app_sessions`, `password_reset_tokens`, `administrator_profiles`, and the `mailserver` schema; none create `admin_accounts`, `admin_sessions`, or `user_control_settings`.)*

---

### BUG-02 — Cross-Table Actor ID Collision & Foreign-Key Mismatch (`admin_accounts` vs `users`)
- **Severity:** CRITICAL
- **Area:** Database Integrity, Audit Logging & Admin Authorization (`/prisma/schema.prisma`, `/src/core/*`)
- **Impact:** When an `admin_table` administrator (`AdminAccount`) performs actions:
  1. `resolveActorIdForDatabase` resolves `actorId` by numeric ID alone in `prisma.user`, misattributing `AdminAccount.id = 1` actions to `users.id = 1`.
  2. `deleteManagedUser` compares `userId === auditContext.actorId` without checking `authSource`, falsely blocking deletion of `users.id = 1`.
  3. Callers passing raw `actorId` directly to `recordAudit` trigger PostgreSQL FK violations on `audit_logs_actor_id_fkey` whenever `AdminAccount.id` has no matching row in `users`, silently dropping audit logs (`audit_persistence_failed`).

**Verified Code Proof — `/prisma/schema.prisma:212,233,269,320`:**
```prisma
  deletedBy   User?               @relation("MailboxDeletedBy", fields: [deletedById], references: [id], onDelete: SetNull)
  assignedBy User?    @relation("MembershipAssigner", fields: [assignedById], references: [id], onDelete: SetNull)
  deletedBy User?        @relation("MessageDeletedBy", fields: [deletedById], references: [id], onDelete: SetNull)
  actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)
```

**Verified Code Proof — `/src/core/accounts/users.ts:178-188,829-835`:**
```ts
async function resolveActorIdForDatabase(
  tx: Pick<PrismaClient, "user">,
  actorId: bigint,
): Promise<bigint | null> {
  if (actorId <= BigInt(0)) return null;
  const existing = await tx.user.findUnique({
    where: { id: actorId },
    select: { id: true },
  });
  return existing?.id ?? null;
}
...
  if (userId === auditContext.actorId) {
    return {
      ok: false,
      code: "self_delete",
      error: "You cannot delete your current administrator account.",
    };
  }
```

**Verified Code Proof — `/src/core/accounts/user-control-policy.ts:612-613,742-743` & `/src/core/audit/record.ts:129-144`:**
```ts
// user-control-policy.ts:612-613
      await recordAudit(prisma as unknown as AuditWriteClient, {
        actorId: auditContext?.actorId ?? null,
        action: "user_control_settings_updated",

// audit/record.ts:129-144
    const record = await prisma.auditLog.create({
      data: {
        actorId: normalizeActorId(input.actorId),
        ...
      },
    });
    return record as TResult;
  } catch {
    logger.error("audit_persistence_failed", { auditAction: action });
    return null;
  }
```
*(Same unguarded raw `actorId` pattern occurs in `src/core/settings/service.ts:594`, `src/core/updates/service.ts:658`, and `src/core/auth/sign-up.ts:421`; sibling `resolveActorIdForDatabase` helpers without `authSource` exist in `src/core/mailboxes/service.ts:129-139`, `src/core/domains/service.ts:74-84`, `src/core/operations/service.ts:209-219`, and `src/core/messages/service.ts:396-409`.)*

---

### BUG-03 — `messages.parse_status` PostgreSQL CHECK Constraint Mismatch (`'error'` vs `'failed'`)
- **Severity:** HIGH
- **Area:** Ingestion & Operations Overview (`/prisma/migrations/`, `/src/core/ingestion/service.ts`, `/src/core/operations/service.ts`)
- **Impact:** Any ingested email with `parseFailed = true` attempts to insert `parseStatus: "failed"`, violating `messages_parse_status_check` (`'ok' | 'warning' | 'error' | 'oversized'`) and aborting message ingestion. Operations dashboard counts `parseStatus: "failed"`, missing `'error'` rows.

**Verified Code Proof — `/prisma/migrations/20261017000000_initial_application_schema/migration.sql:335`:**
```sql
ALTER TABLE "messages" ADD CONSTRAINT "messages_parse_status_check" CHECK ("parse_status" IN ('ok', 'warning', 'error', 'oversized'));
```

**Verified Code Proof — `/src/core/ingestion/service.ts:385-389`:**
```ts
    const parseStatus = parsed.parseFailed
      ? "failed"
      : warnings.length > 0
        ? "warning"
        : "ok";
```

**Verified Code Proof — `/src/core/operations/service.ts:335-341`:**
```ts
      prisma.message.count({
        where: {
          deletedAt: null,
          parseStatus: "failed",
          mailbox: { deletedAt: null },
        },
      }),
```

---

### BUG-04 — Mailbox Local-Part Regex Drift Across Demo, Validators & Postfix View
- **Severity:** MEDIUM
- **Area:** Mailbox Validation & Mailserver Contract
- **Impact:** Demo workspace accepts `+` subaddressing and leading/trailing `.`/`_`/`-`, whereas production validators and the PostgreSQL `mailserver.postfix_virtual_mailboxes` view strictly reject them.

**Verified Code Proof — `/src/core/messages/demo-workspace.ts:803`:**
```ts
  if (!/^[a-z0-9._+-]{1,64}$/.test(localPart)) {
```

**Verified Code Proof — `/src/core/mailboxes/validators.ts:3` & `/prisma/migrations/20261115000000_mailserver_schema_and_roles/migration.sql:91`:**
```ts
// validators.ts:3
export const LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
```
```sql
-- 20261115000000_mailserver_schema_and_roles/migration.sql:91
  AND lower(m."local_part") ~ '^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$'
```

---

### BUG-05 — User Control Settings & Per-User Policy Silently Swallow DB Failures & Inject Demo Data
- **Severity:** CRITICAL
- **Area:** Admin User Control (`/src/core/accounts/user-control-policy.ts`)
- **Impact:**
  1. Failed PostgreSQL reads/writes in `getUserControlSettings`, `updateUserControlSettings`, `getUserExtendedPolicy`, `updateUserExtendedPolicy`, and `listUsersControlSnapshot` catch errors silently and fall back to memory (`setDemoUserControlSettings` / `setDemoUserAccessPolicy`), falsely returning `{ ok: true }` in production.
  2. `updateUserExtendedPolicy` reads `getUserControlSettings(null)` instead of querying Prisma, normalizing per-user policies against stale in-memory defaults.
  3. `listUsersControlSnapshot` injects `DEMO_VERIFIED_DOMAINS` (`readbox.local`, `teambox.dev`) when `dbDomains.length === 0` even if `databaseConnected: true`.
  4. Demo branch hardcodes `mailboxCount: acc.username === "demo.user" ? 3 : 0` even though `demo-workspace.ts` seeds 4 mailboxes (`billing.ops`, `olivia.martin`, `support.desk`, `alerts.archive`).

**Verified Code Proof — `/src/core/accounts/user-control-policy.ts:529-531,631-634,705,761-764,854-864,893`:**
```ts
// user-control-policy.ts:529-531
  } catch {
    return getDemoUserControlSettings();
  }

// user-control-policy.ts:631-634
  } catch {
    setDemoUserControlSettings(normalized);
    return { ok: true, settings: normalized };
  }

// user-control-policy.ts:705
  const globalSettings = await getUserControlSettings(null);

// user-control-policy.ts:761-764
  } catch {
    setDemoUserAccessPolicy(trimmedId, normalized);
    return { ok: true, policy: normalized };
  }

// user-control-policy.ts:854-864
      return {
        settings,
        domains:
          dbDomains.length > 0 ? dbDomains : [...DEMO_VERIFIED_DOMAINS],
        pendingUsers,
        governedUsers,
        databaseConnected: true,
      };
    } catch {
      // Fall back to demo snapshot when PostgreSQL is unreachable
    }

// user-control-policy.ts:893
    mailboxCount: acc.username === "demo.user" ? 3 : 0,
```

---

### BUG-06 — `SiteSettings` Silently Falls Back to In-Memory Save on Non-Production DB Errors
- **Severity:** HIGH
- **Area:** System Settings Engine (`/src/core/settings/service.ts`)
- **Impact:** Outside `NODE_ENV === "production"`, database errors during `saveSiteSettings` are silently ignored and reported as saved using an in-memory snapshot, masking real SQL/schema failures during staging/local DB testing.

**Verified Code Proof — `/src/core/settings/service.ts:549-565`:**
```ts
        savedRecord = await client.siteSettings.upsert({
          where: { id: BigInt(1) },
          create: payload,
          update: payload,
        });
        dbConnected = true;
        dbCheckCooldownUntil = 0;
      } catch (dbError) {
        if (env.nodeEnv === "production") {
          throw dbError;
        }
        savedRecord = {
          id: BigInt(1),
          ...payload,
          updatedAt: new Date(),
        };
      }
```

---

### BUG-07 — Public Contact Inquiries Stored Only in Volatile RAM (No DB Persistence or Admin Inbox)
- **Severity:** HIGH
- **Area:** Public Contact Engine (`/src/core/contact/service.ts`, `/prisma/schema.prisma`)
- **Impact:** Customer contact submissions (`full_name`, `work_email`, `company`, `phone`, `message`) are pushed only to an in-memory array `submissionsStore` and discarded from PostgreSQL (`recordAudit` omits every field containing the sender's name, email, company, phone, or message). No Prisma table or `/vcon` admin view exists to inspect inquiries, and `getSecretKey()` falls back to a hardcoded static HMAC string when `AUTH_SECRET` / `CONTACT_SECRET_KEY` are unset.

**Verified Code Proof — `/src/core/contact/service.ts:70-78,409-441`:**
```ts
const csrfTokensStore = new Map<string, CsrfTokenEntry>();
const submissionsStore: SubmissionRateEntry[] = [];

function getSecretKey(): string {
  return (
    env.authSecret ||
    process.env.CONTACT_SECRET_KEY ||
    "readbox-public-contact-default-hmac-secret-key-2026"
  );
}
...
  const requestId = randomBytes(16).toString("hex");
  submissionsStore.push({
    requestId,
    ipHash,
    emailHash,
    createdAt: nowSeconds,
    cleaned: options.cleaned,
  });
...
      await recordAudit(client, {
        actorId: null,
        action: "public_contact_submitted",
        targetType: "contact_inquiry",
        targetIdentifier: requestId,
        headers: options.headers,
        details: {
          service_type: options.cleaned.service_type,
          service_label: SERVICE_LABELS[options.cleaned.service_type] ?? options.cleaned.service_type,
          team_size: options.cleaned.team_size || "not_specified",
          work_email_domain: options.cleaned.work_email.split("@")[1] ?? "",
          has_company: Boolean(options.cleaned.company),
          has_phone: Boolean(options.cleaned.phone),
        },
      });
```

---

### BUG-08 — Demo Workspace Bypasses Ownership, Delete Capabilities, Retention & Live Polling
- **Severity:** MEDIUM
- **Area:** Demo Workspace (`/src/core/messages/demo-workspace.ts`, `/src/app/(workspace)/users/inbox/*`)
- **Impact:**
  1. `resolveDemoCapabilities` hardcodes `canDeleteMessages: true` even when disabled in policy.
  2. `createDemoMailbox` enforces `maxMailboxes` against global `store.mailboxes.length` instead of per-user count.
  3. `listDemoMailboxMessages`, `getDemoMessageDetail`, `getDemoMessageHtml`, `getDemoAttachmentDownload`, `deleteDemoMailbox`, `bulkDeleteDemoMailboxes`, `markDemoMessageUnread`, and `softDeleteDemoMessage` skip user ownership/capability enforcement, and `getDemoMessageDetail` bypasses retention checks and hardcodes `canDeleteMessage: true`.
  4. `pollDemoLivePayload` forces admin overview (`getDemoUserOverview(true)`), hardcodes `cursor: 100`, and always returns `messages: []`.
  5. Both `/users/inbox/[mailboxUuid]/page.tsx` and `[messageUuid]/page.tsx` omit `user.isAdministrator` and `user.id` when calling demo helpers.

**Verified Code Proof — `/src/core/messages/demo-workspace.ts:390,683-696,737,786,869-879,959-995`:**
```ts
// demo-workspace.ts:390
  return {
    canDeleteMessages: true,
    canDeleteMailboxes: effective.canDeleteMailboxes,

// demo-workspace.ts:683-696,737
export function getDemoMessageDetail(
  mailboxUuid: string,
  messageUuid: string,
): UserMessageDetail | null {
...
  msg.isRead = true;
  const stats = computeMailboxStats(store, mailbox.uuid);
...
    canDeleteMessage: true,

// demo-workspace.ts:786
    const quotaCheck = canUserCreateMoreMailboxes(store.mailboxes.length, {

// demo-workspace.ts:959-963,981-995
export function pollDemoLivePayload(
  mailboxUuids: readonly string[],
): LiveUpdatePayload {
  const store = getDemoStore();
  const overview = getDemoUserOverview(true);
...
  return {
    cursor: 100,
    has_more: false,
...
    messages: [],
  };
```

**Verified Code Proof — `/src/app/(workspace)/users/inbox/[mailboxUuid]/page.tsx:63-68` & `[messageUuid]/page.tsx:72,85`:**
```tsx
// [mailboxUuid]/page.tsx:63-68
    : listDemoMailboxMessages(mailboxUuid, {
        query: searchParams.q,
        read: readParam,
        attachments: searchParams.attachments,
        page: Number(searchParams.page) || 1,
      });

// [messageUuid]/page.tsx:72,85
    : getDemoMessageDetail(mailboxUuid, messageUuid);
...
    : listDemoMailboxMessages(mailboxUuid, filters);
```

---

### BUG-09 — Setup / Installer Execution Framework Completely Orphaned
- **Severity:** MEDIUM
- **Area:** Setup & Provisioning (`/src/core/setup/trusted-operations.ts`)
- **Impact:** `defineInstallerOperation` and `createTrustedOperationRunner` exist solely as unused core modules with zero API routes, CLI entrypoints, or UI workflows wired to them.

**Verified Code Proof — `/src/core/setup/trusted-operations.ts:45-79`:**
```ts
export function defineInstallerOperation<TInput>(
  definition: InstallerOperationDefinition<TInput>,
): RegisteredInstallerOperation {
...
export function createTrustedOperationRunner(
  definitions: readonly RegisteredInstallerOperation[],
  authorize?: TrustedOperationAuthorizer,
): {
  run(operationId: string, input: unknown): Promise<InstallerOperationResult>;
} {
```
*(No route under `/src/app/` or caller outside `/src/core/setup/` invokes `createTrustedOperationRunner`.)*

---

### BUG-10 — Production Sessions Never Record `ipAddress`, `userAgent`, or `lastSeenAt`
- **Severity:** CRITICAL
- **Area:** Authentication & Session Security (`/src/auth.ts`, `/src/core/auth/session-registry.ts`, `/src/core/accounts/user-profile.ts`)
- **Impact:** Unlike Demo Mode (which synthesizes `"Local demo browser"`), production `registerAppSession` inserts sessions without `ipAddress` or `userAgent`, and `getActiveAppSession` never updates `lastSeenAt`. All production active sessions in User Settings display `"Unknown device"`, `ipAddress: null`, and `lastSeenAt: null`.

**Verified Code Proof — `/src/auth.ts:137-143`:**
```ts
          registered = devDemoActive
            ? registerDevDemoSession(env.nodeEnv, user.id, sessionId)
            : await registerAppSession(
                getPrismaClient(),
                user.id,
                sessionId,
                expiresAt,
                { authSource },
              );
```

**Verified Code Proof — `/src/core/auth/session-registry.ts:33-57` & `/src/core/accounts/user-profile.ts:347-355`:**
```ts
// session-registry.ts:33-39,50-56
      await transaction.adminSession.create({
        data: {
          adminId: id,
          tokenHash: hashOpaqueToken(sessionId),
          expiresAt,
        },
      });
...
    await transaction.appSession.create({
      data: {
        userId: id,
        tokenHash: hashOpaqueToken(sessionId),
        expiresAt,
      },
    });

// user-profile.ts:347-355
      activeSessions: sessions.map((session) => ({
        id: session.id.toString(),
        label: formatUserAgentSummary(session.userAgent),
        ipAddress: session.ipAddress ?? null,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt ? session.lastSeenAt.toISOString() : null,
        expiresAt: session.expiresAt.toISOString(),
        isCurrent: Boolean(currentHash && session.tokenHash === currentHash),
      })),
```

---

### BUG-11 — Password Reset Lacks Self-Service Request Flow, Ignores Dynamic Policy, Excludes Admins & Demo Mode
- **Severity:** HIGH
- **Area:** Password Reset (`/src/core/auth/password-reset.ts`, `/src/components/auth/password-reset-form.tsx`)
- **Impact:**
  1. No self-service "Forgot password" request flow or email/token generator exists—users cannot initiate a reset without an admin manually issuing a token out-of-band.
  2. `completePasswordReset` enforces hardcoded `MIN_PASSWORD_LENGTH` (`15`) and ignores `UserControlSettings.minPasswordLength` / `requireStrongPassword`.
  3. Form hardcodes HTML `minLength={15}` and does not prefill `?token=` query parameters.
  4. Excludes `AdminAccount` rows, writes zero `AuditLog` entries, and has no Demo Mode implementation.

**Verified Code Proof — `/src/core/auth/password-reset.ts:17-20,51-95` & `/src/components/auth/password-reset-form.tsx:48-80`:**
```ts
// password-reset.ts:17-20,57-64,86-93
const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH);
...
  const parsedPassword = newPasswordSchema.safeParse(newPassword);
...
    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, passwordResetRequired: false },
    });
    await transaction.appSession.deleteMany({
      where: { userId: resetToken.userId },
    });
    return true;
```
```tsx
// password-reset-form.tsx:49-67
        <Input
          autoComplete="off"
          id="reset-token"
          maxLength={43}
          name="token"
          required
          spellCheck={false}
        />
...
        <Input
          autoComplete="new-password"
          id="new-password"
          maxLength={128}
          minLength={15}
          name="password"
          required
          type="password"
        />
```

---

### BUG-12 — `autoProvisionStarterMailbox` Policy Toggle Is Completely Unimplemented
- **Severity:** HIGH
- **Area:** Self-Service Registration & Mailbox Provisioning (`/src/core/auth/sign-up.ts`, `/prisma/schema.prisma`)
- **Impact:** Enabling `autoProvisionStarterMailbox` in Admin User Control persists the flag, but neither immediate-verified signups nor admin-approved pending signups ever create a starter mailbox or `MailboxMembership`.

**Verified Code Proof — `/prisma/schema.prisma:134` & `/src/core/auth/sign-up.ts:304-357,410-433`:**
```ts
// sign-up.ts:304-357 (creates user, userAccessPolicy, and auditLog — zero mailbox creation)
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ ... });
      await tx.userAccessPolicy.create({ ... });
      if ("auditLog" in tx && tx.auditLog) {
        await recordAudit(tx as unknown as AuditWriteClient, { ... });
      }
      return user;
    });

// sign-up.ts:410-433 (admin approval updates user.verificationStatus & isActive — zero mailbox creation)
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          verificationStatus: decision,
          isActive: decision === "verified",
        },
      });
```

---

### BUG-13 — Managed User Username Collisions Across `admin_accounts` & Legacy Operator Bootstrap
- **Severity:** HIGH
- **Area:** Account Management & Bootstrap (`/src/core/accounts/users.ts`, `/src/core/auth/operator-bootstrap.ts`)
- **Impact:**
  1. `createManagedUser` and `updateManagedUser` only check `prisma.user` for duplicate usernames, permitting a regular user to share the same username as an `AdminAccount` (ambiguous login namespace).
  2. `bootstrapInitialAccount` still creates a legacy `User` + `AdministratorProfile` instead of an `AdminAccount` in `admin_accounts`.

**Verified Code Proof — `/src/core/accounts/users.ts:389-400,601-615`:**
```ts
// users.ts:389-393
    const existingUsername = await prisma.user.findFirst({
      where: { username: { equals: data.username, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingUsername) {

// users.ts:601-608
    const duplicateUsername = await prisma.user.findFirst({
      where: {
        username: { equals: data.username, mode: "insensitive" },
        id: { not: userId },
      },
      select: { id: true },
    });
```

**Verified Code Proof — `/src/core/auth/operator-bootstrap.ts:43-65`:**
```ts
    if ((await transaction.user.count()) !== 0) return null;

    const user = await transaction.user.create({
      data: {
        username,
        firstName: parsedInput.data.firstName,
        lastName: parsedInput.data.lastName,
        email: parsedInput.data.email.toLowerCase(),
        passwordHash,
        passwordResetRequired: true,
        isActive: true,
      },
      select: { id: true },
    });

    await transaction.administratorProfile.create({
      data: { userId: user.id, isSuperuser: true },
    });
```

---

### BUG-14 — Demo Dynamic Users Ignore Profile Overrides & Skip Approval Audit Events
- **Severity:** MEDIUM
- **Area:** Demo Authentication Store (`/src/core/auth/dev-demo-auth.ts`)
- **Impact:** Profile updates made by dynamically signed-up demo users are not reflected in admin snapshots (`listDevDemoDynamicUsers`), and approving/rejecting pending demo users creates no security event (`appendDemoSecurityEvent`).

**Verified Code Proof — `/src/core/auth/dev-demo-auth.ts:300-317`:**
```ts
export function listDevDemoDynamicUsers(): DevDemoAccount[] {
  return Array.from(getDynamicUserStore().values());
}

export function updateDevDemoDynamicUserStatus(
  userId: string,
  status: "verified" | "rejected",
): DevDemoAccount | null {
  const existing = getDynamicUserStore().get(userId);
  if (!existing) return null;
  const updated: DevDemoAccount = {
    ...existing,
    isActive: status === "verified",
    verificationStatus: status,
  };
  getDynamicUserStore().set(userId, updated);
  return updated;
}
```

---

### BUG-15 — Administrators Visiting `/users/*` Get Management Sidebar & Break `Add mailbox` Modal Trigger
- **Severity:** HIGH
- **Area:** Workspace Navigation & Shell (`/src/components/layout/app-shell.tsx`, `/src/components/users/users-workspace-shell.tsx`)
- **Impact:** `AppShell` checks only `isAdministrator` (`:307`) rather than `isAdministrator && isAdminRoute`, so admins opening `/users` or `/users/inbox/*` see only the `/vcon` Management sidebar—losing the User sidebar links, Inboxes quick-switch list, and the `+ Add mailbox` button that dispatches `readbox:open-create-mailbox`.

**Verified Code Proof — `/src/components/layout/app-shell.tsx:140-141,307,418-436`:**
```tsx
  const isAdministrator = user?.isAdministrator === true;
  const isAdminRoute = pathname.startsWith("/vcon");
...
          {isAdministrator ? (
            <>
              <div className="px-3 pb-1.5 pt-3">
                <CaptionText className="font-medium text-sidebar-muted">
                  Management
                </CaptionText>
              </div>
...
              {!isAdminRoute ? (
                <div className="px-2 pt-2">
                  <Button
...
                    onClick={() => {
                      closeMobileNavigation();
                      window.dispatchEvent(
                        new CustomEvent("readbox:open-create-mailbox"),
                      );
                    }}
                  >
                    <Icon glyph={Plus} />
                    <span>Add mailbox</span>
                  </Button>
                </div>
              ) : null}
```

---

### BUG-16 — Admin Accounts Have Zero Self-Service Profile, Password Change, or Session Management UI
- **Severity:** HIGH
- **Area:** User & Admin Account Settings (`/src/core/accounts/user-profile.ts`, `/src/app/(workspace)/users/settings/page.tsx`)
- **Impact:** `admin_table` admins have `editable: false` and `canManageSecurity: false` in `/users/settings`, and `/vcon/*` provides zero self-settings pages for profile updates, password rotation, or session revocation. Moreover, `users/settings/page.tsx:50` initializes `editable: !user.isAdministrator && user.authSource === "user_table"` while `getUserProfile` (`user-profile.ts:140`) sets `editable: true` for `user_table` accounts.

**Verified Code Proof — `/src/core/accounts/user-profile.ts:100-103,140,170-176,284-291` & `/src/app/(workspace)/users/settings/page.tsx:50`:**
```ts
// user-profile.ts:100-103
          isAdministrator: true,
          authSource: "admin_table",
          editable: false,
...
// user-profile.ts:140
        editable: true,
...
// user-profile.ts:170-176
  if (actor.authSource === "admin_table") {
    return {
      ok: false,
      code: "admin_protected",
      error: "Administrator accounts cannot update personal profile fields here.",
    };
  }
...
// user-profile.ts:284-291
  if (actor.authSource === "admin_table" || actor.userId <= BigInt(0)) {
    return {
      passwordPolicy,
      activeSessions: [],
      recentEvents: [],
      canManageSecurity: false,
    };
  }
```
```tsx
// users/settings/page.tsx:50
    editable: !user.isAdministrator && user.authSource === "user_table",
```

---

### BUG-17 — Stale Client State, 25-Mailbox Sidebar Cap & Silent DB Catch Blocks in `/users/*`
- **Severity:** MEDIUM
- **Area:** User Workspace Components & Layouts (`/src/components/users/*`, `/src/app/(workspace)/users/*`)
- **Impact:**
  1. `MailboxInboxView` initializes `liveCounts` with `useState` and never resets it when navigating between mailboxes (`mailbox.uuid` / props change).
  2. `CreateUserMailboxModal` initializes `domainUuid` with `useState` and never syncs if `domains` updates.
  3. `/users/layout.tsx` queries `{ page: 1 }` only (capped at 25 mailboxes), hiding mailbox 26+ from the sidebar and live-poll list.
  4. DB errors in `/users/layout.tsx` (and sibling `/users` pages) are silently caught and converted to `unconfigured` fallbacks without error logging.

**Verified Code Proof — `/src/components/users/mailbox-inbox-view.tsx:72-80`, `/src/components/users/create-user-mailbox-modal.tsx:68`, `/src/app/(workspace)/users/layout.tsx:31-46`:**
```tsx
// mailbox-inbox-view.tsx:72-80
  const [liveCounts, setLiveCounts] = useState<{
    totalMessages: number;
    unreadMessages: number;
    status: string;
  }>({
    totalMessages: mailbox.totalMessages,
    unreadMessages: mailbox.unreadMessages,
    status: mailbox.status,
  });

// create-user-mailbox-modal.tsx:68
  const [domainUuid, setDomainUuid] = useState(defaultDomain?.uuid ?? "");

// users/layout.tsx:33-46
      listResult = await listUserMailboxes(
        getPrismaClient(),
        {
          userId,
          username: user.username,
          isAdministrator: user.isAdministrator,
        },
        { page: 1 },
      );
    } catch {
      listResult = createUnconfiguredUserMailboxList({
        isAdministrator: user.isAdministrator,
      });
    }
```

---

### BUG-18 — `pollLiveMessagesForUser` Ignores Retention Policy & Misses Cross-Tab Read/Delete Updates
- **Severity:** MEDIUM
- **Area:** Live Updates Engine (`/src/core/messages/service.ts`)
- **Impact:** `pollLiveMessagesForUser` never calls `resolveActorCapabilities` / `resolveActorRetentionCutoff`, summing raw `mailbox.totalMessages` and `unreadMessages` (including expired/hidden messages) and returning new messages strictly with `id > requestedCursor`, failing to push cross-tab read/unread/delete state transitions.

**Verified Code Proof — `/src/core/messages/service.ts:1599-1607,1622-1623,1643-1666,1742-1755`:**
```ts
export async function pollLiveMessagesForUser(
  prisma: Pick<PrismaClient, "mailbox" | "message">,
  actor: Pick<UserWorkspaceActor, "userId" | "isAdministrator">,
  input: {
    readonly bootstrap?: boolean;
    readonly cursor?: number | bigint;
    readonly mailboxUuids?: readonly string[];
  } = {},
): Promise<LiveUpdatePayload> {
...
  const mailboxWhere = buildAccessibleMailboxWhere(actor);
  const messageWhere = buildAccessibleMessageWhere(actor);
...
    prisma.mailbox.aggregate({
      where: mailboxWhere,
      _sum: {
        totalMessages: true,
        unreadMessages: true,
      },
      _max: {
        lastReceivedAt: true,
      },
    }),
...
    const rows = await prisma.message.findMany({
      where: {
        ...messageWhere,
        id: { gt: requestedCursor },
      },
```

---

### BUG-19 — Message Reader Strips Inline `cid:` Images & Prints Full AppShell Chrome
- **Severity:** MEDIUM
- **Area:** Email HTML Sanitizer & Message Reader (`/src/core/ingestion/sanitizer.ts`, `/src/components/users/message-reader-view.tsx`)
- **Impact:**
  1. Ingestion stores inline `cid:` attachments (`isInline`, `contentId`), yet `sanitizer.ts` removes every `<img>` whose `src` does not match `data:image/(png|jpeg|gif|webp);base64,...`, breaking inline newsletter/signature images.
  2. Clicking Print calls `window.print()` directly without print CSS isolation, printing the entire sidebar, header, and message list alongside the email.

**Verified Code Proof — `/src/core/ingestion/sanitizer.ts:612-615,648-651` & `/src/components/users/message-reader-view.tsx:417-421`:**
```ts
// sanitizer.ts:612-615,648-651
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["data"],
    },
...
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") {
        return !isSafeRasterDataImageUri(frame.attribs.src);
      }
```
```tsx
// message-reader-view.tsx:417-421
  function handlePrintMessage() {
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  }
```

---

### BUG-20 — `autoDeleteEnabled` / `autoDeleteDays` Retention Is Read-Filter-Only (No Purge Worker & Skewed Counters)
- **Severity:** HIGH
- **Area:** Data Retention Engine (`/src/core/messages/service.ts`, `/src/core/accounts/user-control-policy.ts`)
- **Impact:** Enabling `autoDeleteEnabled` / `autoDeleteDays` only hides aged messages inside list/detail queries. No background job or purge routine deletes expired DB rows, stored attachments, or Maildir files; `mailbox.totalMessages` and `unreadMessages` counters stay inflated; and Prisma filters `{ receivedAt: { gte: retentionCutoff } }` drop `receivedAt = null` rows in SQL before the JS fallback filter (`!msg.receivedAt || ...`) can see them.

**Verified Code Proof — `/src/core/messages/service.ts:470-478,544-545,563-567`:**
```ts
  const retentionCutoff = resolveActorRetentionCutoff(
    capabilities,
    actor.isAdministrator,
  );
  const mailboxWhere = buildAccessibleMailboxWhere(actor);
  const messageWhere = buildAccessibleMessageWhere(
    actor,
    retentionCutoff ? { receivedAt: { gte: retentionCutoff } } : {},
  );
...
        totalMessages: true,
        unreadMessages: true,
...
  const recentMessages = retentionCutoff
    ? recentMessagesRaw.filter(
        (msg) => !msg.receivedAt || msg.receivedAt >= retentionCutoff,
      )
    : recentMessagesRaw;
```

---

### BUG-21 — System Updater Default Script Path Mismatch & Legacy `vibmail` Infrastructure Hardcodes
- **Severity:** CRITICAL
- **Area:** System Updater & Operations Scripts (`/src/config/env-schema.ts`, `/src/core/updates/service.ts`, `/scripts/updater/*`, `/scripts/ops/backup.sh`)
- **Impact:**
  1. `env-schema.ts` defaults `UPDATE_SCRIPT_PATH` to `/opt/vibmail/app/scripts/upgrade.sh` (missing `/updater/`), while the real script and `update_worker.py` use `/opt/vibmail/app/scripts/updater/upgrade.sh`—blocking preflight with `"upgrade script executable"` failure.
  2. `updates/service.ts`, `upgrade.sh`, and `backup.sh` hardcode legacy `vibmail` paths and systemd unit names (`/opt/vibmail/app`, `/etc/vibmail/vibmail.env`, `/var/backups/vibmail`, `vibmail-web.service`, `vibmail-ingestion.service`, `/etc/nginx/sites-available/vibmail-app.conf`, `/etc/dovecot/conf.d/99-vibmail.conf`).
  3. `queueUpdateRequest` calls `recordAudit` with raw `options?.actorId` (also subject to `BUG-02`).

**Verified Code Proof — `/src/config/env-schema.ts:199-210`, `/scripts/updater/update_worker.py:17-23`, `/src/core/updates/service.ts:328-332,420-428,657-659`, `/scripts/updater/upgrade.sh:59-63,112,130`:**
```ts
// env-schema.ts:199-210
    UPDATE_RUNTIME_DIR: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/run/vibmail"),
    ),
    UPDATE_SERVICE_NAME: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("vibmail-updater.service"),
    ),
    UPDATE_SCRIPT_PATH: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).default("/opt/vibmail/app/scripts/upgrade.sh"),
    ),
```
```python
# scripts/updater/update_worker.py:17-23
RUNTIME_DIR = Path(os.environ.get("UPDATE_RUNTIME_DIR", "/run/vibmail"))
...
UPGRADE_SCRIPT = Path(
    os.environ.get("UPDATE_SCRIPT_PATH", "/opt/vibmail/app/scripts/updater/upgrade.sh")
)
```
```ts
// updates/service.ts:328-332,425-427
  const upgradeScriptPath = options?.upgradeScriptPath ?? env.updateScriptPath;
  const appRoot = options?.appRoot ?? "/opt/vibmail/app";
  const envFilePath = options?.envFilePath ?? "/etc/vibmail/vibmail.env";
  const backupRoot = options?.backupRoot ?? "/var/backups/vibmail";
  const systemdUnitDir = options?.systemdUnitDir ?? "/etc/systemd/system";
...
    "nginx.service",
    "vibmail-web.service",
    "vibmail-ingestion.service",
```
```bash
# scripts/updater/upgrade.sh:59-63,112,130
APP_ROOT=${APP_ROOT:-/opt/vibmail/app}
ENV_FILE=${VIBMAIL_ENV_FILE:-/etc/vibmail/vibmail.env}
LOCK_FILE=${UPGRADE_LOCK_FILE:-/run/vibmail/vibmail-upgrade.lock}
UPGRADE_ROOT=${UPGRADE_ROOT:-/var/backups/vibmail/upgrades}
STAGING_ROOT=${STAGING_ROOT:-/opt/vibmail-upgrades}
...
systemctl stop vibmail-ingestion.service vibmail-web.service
...
systemctl start vibmail-web.service vibmail-ingestion.service
```
