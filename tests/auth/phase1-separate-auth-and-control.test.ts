import {
  canUserCreateMoreMailboxes,
  computeMessageRetentionCutoff,
  DEFAULT_USER_CONTROL_SETTINGS,
  getUserControlSettings,
  isDomainAllowedForUser,
  normalizeUserControlSettings,
  resetDemoUserControlSettings,
  resolveEffectiveUserPolicy,
  updateUserControlSettings,
} from "@/core/accounts/user-control-policy";
import { createManagedUser } from "@/core/accounts/users";
import { authorizeCredentials } from "@/core/auth/credentials";
import {
  authorizeDevDemoCredentials,
  clearDevDemoSessions,
  getDevDemoSecuritySnapshot,
  listDevDemoDynamicUsers,
  updateDevDemoProfile,
} from "@/core/auth/dev-demo-auth";
import { createOpaqueToken } from "@/core/auth/opaque-token";
import { hashPassword } from "@/core/auth/password";
import {
  clearAdminResetTokenStore,
  completePasswordResetDetailed,
  requestPasswordReset,
} from "@/core/auth/password-reset";
import {
  getActiveAppSession,
  registerAppSession,
  revokeAppSession,
} from "@/core/auth/session-registry";
import {
  registerUserAccount,
  updatePendingUserVerification,
  upsertAdminAccountRecord,
  validateSignUpInput,
} from "@/core/auth/sign-up";
import type { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { test } from "node:test";

interface SyntheticAdminRow {
  id: bigint;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  email: string;
  isSuperuser: boolean;
  isActive: boolean;
  passwordResetRequired: boolean;
  lastLogin: Date | null;
}

interface SyntheticUserRow {
  id: bigint;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  verificationStatus: "verified" | "pending_approval" | "rejected";
  passwordResetRequired: boolean;
  lastLogin: Date | null;
}

function makePhase1Prisma() {
  const state = {
    admins: [] as SyntheticAdminRow[],
    users: [] as SyntheticUserRow[],
    adminSessions: [] as {
      adminId: bigint;
      tokenHash: string;
      expiresAt: Date;
      lastSeenAt?: Date | null;
      ipAddress?: string | null;
      userAgent?: string;
    }[],
    adminResetTokens: [] as {
      adminId: bigint;
      tokenHash: string;
      expiresAt: Date;
    }[],
    passwordResetTokens: [] as {
      userId: bigint;
      tokenHash: string;
      expiresAt: Date;
    }[],
    appSessions: [] as {
      userId: bigint;
      tokenHash: string;
      expiresAt: Date;
      lastSeenAt?: Date | null;
      ipAddress?: string | null;
      userAgent?: string;
    }[],
    policies: [] as {
      userId: bigint;
      canCreateMailboxes: boolean;
      canDeleteMessages: boolean;
      canDeleteMailboxes: boolean;
      maxMailboxes: number;
      allowedDomainUuids: string[];
      autoDeleteEnabled: boolean;
      autoDeleteDays: number;
    }[],
    attempts: [] as {
      usernameNormalized: string;
      ipAddress: string | null;
      succeeded: boolean;
      createdAt: Date;
    }[],
    audits: [] as {
      action: string;
      targetType: string;
      targetIdentifier: string;
      details: Record<string, unknown>;
    }[],
    nextAdminId: BigInt(101),
    nextUserId: BigInt(501),
  };

  const client: Record<string, unknown> = {
    $executeRaw: async () => 1,
    $queryRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
      const sql = query.join("");
      const id = values[0] as bigint;
      if (sql.includes('FROM "admin_accounts"')) {
        const admin = state.admins.find((row) => row.id === id);
        return admin?.isActive && !admin.passwordResetRequired
          ? [{ id: admin.id }]
          : [];
      }
      if (sql.includes('FROM "users"')) {
        const user = state.users.find((row) => row.id === id);
        return user?.isActive && !user.passwordResetRequired
          ? [{ id: user.id }]
          : [];
      }
      return [];
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(client),
    loginAttempt: {
      deleteMany: async () => ({ count: 0 }),
      findMany: async () => [],
      create: async (args: {
        data: {
          usernameNormalized: string;
          ipAddress: string | null;
          succeeded: boolean;
          createdAt: Date;
        };
      }) => {
        state.attempts.push(args.data);
        return args.data;
      },
    },
    auditLog: {
      create: async (args: {
        data: {
          action: string;
          targetType: string;
          targetIdentifier: string;
          details: Record<string, unknown>;
        };
      }) => {
        state.audits.push(args.data);
        return args.data;
      },
    },
    adminAccount: {
      findFirst: async (args: {
        where: {
          username?: { equals?: string };
          OR?: Array<{
            username?: { equals?: string };
            email?: { equals?: string };
          }>;
        };
      }) => {
        const directTarget = args.where.username?.equals?.toLowerCase();
        if (directTarget) {
          return (
            state.admins.find(
              (row) => row.username.toLowerCase() === directTarget,
            ) ?? null
          );
        }
        if (args.where.OR) {
          for (const cond of args.where.OR) {
            const u = cond.username?.equals?.toLowerCase();
            const e = cond.email?.equals?.toLowerCase();
            const match = state.admins.find(
              (row) =>
                (u && row.username.toLowerCase() === u) ||
                (e && row.email.toLowerCase() === e),
            );
            if (match) return match;
          }
        }
        return null;
      },
      findUnique: async (args: { where: { id: bigint } }) =>
        state.admins.find((row) => row.id === args.where.id) ?? null,
      update: async (args: {
        where: { id: bigint };
        data: Partial<SyntheticAdminRow>;
      }) => {
        const row = state.admins.find((item) => item.id === args.where.id);
        if (!row) throw new Error("Admin not found");
        Object.assign(row, args.data);
        return row;
      },
      upsert: async (args: {
        where: { username: string };
        create: Omit<SyntheticAdminRow, "id" | "lastLogin">;
        update: Partial<SyntheticAdminRow>;
      }) => {
        const existing = state.admins.find(
          (item) => item.username === args.where.username,
        );
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        const created: SyntheticAdminRow = {
          id: state.nextAdminId++,
          lastLogin: null,
          ...args.create,
        };
        state.admins.push(created);
        return created;
      },
    },
    adminSession: {
      create: async (args: {
        data: {
          adminId: bigint;
          tokenHash: string;
          expiresAt: Date;
          lastSeenAt?: Date | null;
          ipAddress?: string | null;
          userAgent?: string;
        };
      }) => {
        state.adminSessions.push(args.data);
        return args.data;
      },
      findUnique: async (args: { where: { tokenHash: string } }) => {
        const session = state.adminSessions.find(
          (row) => row.tokenHash === args.where.tokenHash,
        );
        if (!session) return null;
        const admin = state.admins.find((row) => row.id === session.adminId);
        if (!admin) return null;
        return {
          ...session,
          admin,
        };
      },
      update: async (args: {
        where: { tokenHash: string };
        data: Partial<{
          lastSeenAt: Date;
          ipAddress: string | null;
          userAgent: string;
        }>;
      }) => {
        const session = state.adminSessions.find(
          (row) => row.tokenHash === args.where.tokenHash,
        );
        if (!session) throw new Error("Admin session not found");
        Object.assign(session, args.data);
        return session;
      },
      deleteMany: async (args: {
        where: { tokenHash?: string; adminId?: bigint };
      }) => {
        const before = state.adminSessions.length;
        state.adminSessions = state.adminSessions.filter(
          (row) =>
            (args.where.tokenHash === undefined ||
              row.tokenHash !== args.where.tokenHash) &&
            (args.where.adminId === undefined ||
              row.adminId !== args.where.adminId),
        );
        return { count: before - state.adminSessions.length };
      },
    },
    adminResetToken: {
      create: async (args: {
        data: { adminId: bigint; tokenHash: string; expiresAt: Date };
      }) => {
        state.adminResetTokens.push(args.data);
        return args.data;
      },
      findUnique: async (args: { where: { tokenHash: string } }) => {
        const token = state.adminResetTokens.find(
          (row) => row.tokenHash === args.where.tokenHash,
        );
        if (!token) return null;
        const admin = state.admins.find((row) => row.id === token.adminId);
        return {
          ...token,
          admin: admin ? { username: admin.username } : null,
        };
      },
      deleteMany: async (args: {
        where: {
          adminId?: bigint;
          tokenHash?: string;
          expiresAt?: { gt: Date };
        };
      }) => {
        const matches = state.adminResetTokens.filter(
          (row) =>
            (args.where.adminId === undefined ||
              row.adminId === args.where.adminId) &&
            (args.where.tokenHash === undefined ||
              row.tokenHash === args.where.tokenHash) &&
            (!args.where.expiresAt?.gt ||
              row.expiresAt > args.where.expiresAt.gt),
        );
        state.adminResetTokens = state.adminResetTokens.filter(
          (row) => !matches.includes(row),
        );
        return { count: matches.length };
      },
    },
    passwordResetToken: {
      create: async (args: {
        data: { userId: bigint; tokenHash: string; expiresAt: Date };
      }) => {
        state.passwordResetTokens.push(args.data);
        return args.data;
      },
      findUnique: async (args: { where: { tokenHash: string } }) =>
        state.passwordResetTokens.find(
          (row) => row.tokenHash === args.where.tokenHash,
        ) ?? null,
      deleteMany: async (args: {
        where: {
          userId?: bigint;
          tokenHash?: string;
          expiresAt?: { gt: Date };
        };
      }) => {
        const matches = state.passwordResetTokens.filter(
          (row) =>
            (args.where.userId === undefined ||
              row.userId === args.where.userId) &&
            (args.where.tokenHash === undefined ||
              row.tokenHash === args.where.tokenHash) &&
            (!args.where.expiresAt?.gt ||
              row.expiresAt > args.where.expiresAt.gt),
        );
        state.passwordResetTokens = state.passwordResetTokens.filter(
          (row) => !matches.includes(row),
        );
        return { count: matches.length };
      },
    },
    user: {
      findFirst: async (args: { where: { username?: { equals?: string } } }) => {
        const target = args.where.username?.equals?.toLowerCase();
        const found =
          state.users.find((row) => row.username.toLowerCase() === target) ??
          null;
        if (!found) return null;
        return {
          ...found,
          administratorProfile: null,
        };
      },
      findUnique: async (args: { where: { id: bigint } }) => {
        const found =
          state.users.find((row) => row.id === args.where.id) ?? null;
        if (!found) return null;
        return {
          ...found,
          administratorProfile: null,
        };
      },
      create: async (args: { data: Omit<SyntheticUserRow, "id" | "lastLogin"> }) => {
        const created: SyntheticUserRow = {
          id: state.nextUserId++,
          username: args.data.username,
          passwordHash: args.data.passwordHash,
          firstName: args.data.firstName,
          lastName: args.data.lastName,
          email: args.data.email,
          phone: args.data.phone ?? "",
          isActive: args.data.isActive,
          verificationStatus: args.data.verificationStatus ?? "verified",
          passwordResetRequired: args.data.passwordResetRequired,
          lastLogin: null,
        };
        state.users.push(created);
        return created;
      },
      update: async (args: {
        where: { id: bigint };
        data: Partial<SyntheticUserRow>;
      }) => {
        const found = state.users.find((row) => row.id === args.where.id);
        if (!found) throw new Error("User not found");
        Object.assign(found, args.data);
        return found;
      },
    },
    userAccessPolicy: {
      create: async (args: {
        data: {
          userId: bigint;
          canCreateMailboxes?: boolean;
          canDeleteMessages: boolean;
          canDeleteMailboxes: boolean;
          maxMailboxes?: number;
          allowedDomainUuids?: string[];
          autoDeleteEnabled?: boolean;
          autoDeleteDays?: number;
        };
      }) => {
        const policy = {
          userId: args.data.userId,
          canCreateMailboxes: args.data.canCreateMailboxes ?? true,
          canDeleteMessages: args.data.canDeleteMessages,
          canDeleteMailboxes: args.data.canDeleteMailboxes,
          maxMailboxes: args.data.maxMailboxes ?? 3,
          allowedDomainUuids: args.data.allowedDomainUuids ?? [],
          autoDeleteEnabled: args.data.autoDeleteEnabled ?? false,
          autoDeleteDays: args.data.autoDeleteDays ?? 0,
        };
        state.policies.push(policy);
        return policy;
      },
    },
    appSession: {
      create: async (args: {
        data: {
          userId: bigint;
          tokenHash: string;
          expiresAt: Date;
          lastSeenAt?: Date | null;
          ipAddress?: string | null;
          userAgent?: string;
        };
      }) => {
        state.appSessions.push(args.data);
        return args.data;
      },
      findUnique: async (args: { where: { tokenHash: string } }) => {
        const session = state.appSessions.find(
          (row) => row.tokenHash === args.where.tokenHash,
        );
        if (!session) return null;
        const user = state.users.find((row) => row.id === session.userId);
        if (!user) return null;
        return {
          ...session,
          user: {
            ...user,
            administratorProfile: null,
          },
        };
      },
      update: async (args: {
        where: { tokenHash: string };
        data: Partial<{
          lastSeenAt: Date;
          ipAddress: string | null;
          userAgent: string;
        }>;
      }) => {
        const session = state.appSessions.find(
          (row) => row.tokenHash === args.where.tokenHash,
        );
        if (!session) throw new Error("App session not found");
        Object.assign(session, args.data);
        return session;
      },
      deleteMany: async (args: { where: { tokenHash?: string } }) => {
        const before = state.appSessions.length;
        state.appSessions = state.appSessions.filter(
          (row) => row.tokenHash !== args.where.tokenHash,
        );
        return { count: before - state.appSessions.length };
      },
    },
  };

  return { prisma: client as unknown as PrismaClient, state };
}

test("separate admin_accounts and users tables enforce strict loginScope isolation", async () => {
  const { prisma, state } = makePhase1Prisma();
  const adminPasswordHash = await hashPassword("AdminPass#2026!");
  const userPasswordHash = await hashPassword("UserPass#2026!");

  state.admins.push({
    id: BigInt(101),
    username: "ops.admin",
    passwordHash: adminPasswordHash,
    firstName: "Ops",
    lastName: "Admin",
    email: "ops.admin@readbox.local",
    isSuperuser: true,
    isActive: true,
    passwordResetRequired: false,
    lastLogin: null,
  });

  state.users.push({
    id: BigInt(501),
    username: "workspace.member",
    passwordHash: userPasswordHash,
    firstName: "Workspace",
    lastName: "Member",
    email: "member@readbox.local",
    phone: "+15550101",
    isActive: true,
    verificationStatus: "verified",
    passwordResetRequired: false,
    lastLogin: null,
  });

  // 1. Admin account rejected on user login portal (`loginScope: "user"`)
  const adminOnUserScope = await authorizeCredentials(prisma, {
    username: "ops.admin",
    password: "AdminPass#2026!",
    loginScope: "user",
  });
  assert.equal(adminOnUserScope, null);

  // 2. Admin account accepted on admin login portal (`loginScope: "admin"`)
  const adminOnAdminScope = await authorizeCredentials(prisma, {
    username: "ops.admin",
    password: "AdminPass#2026!",
    loginScope: "admin",
  });
  assert.equal(adminOnAdminScope?.id, "101");
  assert.equal(adminOnAdminScope?.isAdministrator, true);
  assert.equal(adminOnAdminScope?.isSuperuser, true);
  assert.equal(adminOnAdminScope?.authSource, "admin_table");

  // 3. Regular user rejected on admin login portal (`loginScope: "admin"`)
  const userOnAdminScope = await authorizeCredentials(prisma, {
    username: "workspace.member",
    password: "UserPass#2026!",
    loginScope: "admin",
  });
  assert.equal(userOnAdminScope, null);

  // 4. Regular user accepted on user login portal (`loginScope: "user"`)
  const userOnUserScope = await authorizeCredentials(prisma, {
    username: "workspace.member",
    password: "UserPass#2026!",
    loginScope: "user",
  });
  assert.equal(userOnUserScope?.id, "501");
  assert.equal(userOnUserScope?.isAdministrator, false);
  assert.equal(userOnUserScope?.authSource, "user_table");
});

test("separate admin_sessions and app_sessions isolate session lifecycle and record IP/UA/lastSeenAt telemetry (BUG-10)", async () => {
  const { prisma, state } = makePhase1Prisma();
  state.admins.push({
    id: BigInt(101),
    username: "ops.admin",
    passwordHash: "hash",
    firstName: "Ops",
    lastName: "Admin",
    email: "ops@readbox.local",
    isSuperuser: true,
    isActive: true,
    passwordResetRequired: false,
    lastLogin: null,
  });
  state.users.push({
    id: BigInt(501),
    username: "workspace.member",
    passwordHash: "hash",
    firstName: "Workspace",
    lastName: "Member",
    email: "member@readbox.local",
    phone: "",
    isActive: true,
    verificationStatus: "verified",
    passwordResetRequired: false,
    lastLogin: null,
  });

  const adminToken = createOpaqueToken();
  const userToken = createOpaqueToken();
  const initialNow = new Date("2026-11-16T10:00:00.000Z");
  const laterNow = new Date("2026-11-16T10:05:00.000Z");
  const expiresAt = new Date(Date.now() + 60_000);

  assert.equal(
    await registerAppSession(prisma, "101", adminToken, expiresAt, {
      authSource: "admin_table",
      ipAddress: "198.51.100.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/131.0",
      now: initialNow,
    }),
    true,
  );
  assert.equal(state.adminSessions.length, 1);
  assert.equal(state.adminSessions[0]?.ipAddress, "198.51.100.1");
  assert.equal(
    state.adminSessions[0]?.userAgent,
    "Mozilla/5.0 (Windows NT 10.0) Chrome/131.0",
  );
  assert.equal(
    state.adminSessions[0]?.lastSeenAt?.toISOString(),
    initialNow.toISOString(),
  );
  assert.equal(state.appSessions.length, 0);

  assert.equal(
    await registerAppSession(prisma, "501", userToken, expiresAt, {
      authSource: "user_table",
      ipAddress: "203.0.113.5",
      userAgent: "Mozilla/5.0 (Macintosh) Firefox/132.0",
      now: initialNow,
    }),
    true,
  );
  assert.equal(state.appSessions.length, 1);
  assert.equal(state.appSessions[0]?.ipAddress, "203.0.113.5");

  const activeAdmin = await getActiveAppSession(prisma, "101", adminToken, {
    authSource: "admin_table",
    now: laterNow,
  });
  assert.equal(activeAdmin?.username, "ops.admin");
  assert.equal(activeAdmin?.isAdministrator, true);
  assert.equal(activeAdmin?.authSource, "admin_table");
  assert.equal(
    state.adminSessions[0]?.lastSeenAt?.toISOString(),
    laterNow.toISOString(),
  );

  const activeUser = await getActiveAppSession(prisma, "501", userToken, {
    authSource: "user_table",
    now: laterNow,
  });
  assert.equal(activeUser?.username, "workspace.member");
  assert.equal(activeUser?.isAdministrator, false);
  assert.equal(activeUser?.authSource, "user_table");
  assert.equal(
    state.appSessions[0]?.lastSeenAt?.toISOString(),
    laterNow.toISOString(),
  );

  await revokeAppSession(prisma, adminToken);
  assert.equal(state.adminSessions.length, 0);
  assert.equal(state.appSessions.length, 1);
});

test("UserControlSettings and Sign-Up enforce field requirements, invite code, admin approval, and policy defaults", async () => {
  resetDemoUserControlSettings();
  clearDevDemoSessions();
  const { prisma, state } = makePhase1Prisma();

  const updated = await updateUserControlSettings(null, {
    ...DEFAULT_USER_CONTROL_SETTINGS,
    firstNameRequirement: "required",
    phoneRequirement: "required",
    verificationMode: "invite_code",
    inviteCode: "READBOX-2026",
    allowedDomainUuids: ["domain-uuid-1"],
    defaultMaxMailboxes: 5,
    autoDeleteEnabled: true,
    autoDeleteDays: 14,
  });
  assert.equal(updated.ok, true);

  const settings = await getUserControlSettings(null);
  assert.equal(settings.verificationMode, "invite_code");
  assert.equal(settings.defaultMaxMailboxes, 5);

  // Missing required firstName/phone & wrong inviteCode
  const invalidAttempt = validateSignUpInput(
    {
      username: "new.member",
      password: "StrongPassword#2026",
      passwordConfirmation: "StrongPassword#2026",
      firstName: "",
      email: "new.member@example.com",
      phone: "",
      inviteCode: "WRONG",
    },
    settings,
  );
  assert.equal(invalidAttempt.ok, false);

  // Valid sign-up with invite code
  const registered = await registerUserAccount(
    prisma,
    {
      username: "new.member",
      password: "StrongPassword#2026",
      passwordConfirmation: "StrongPassword#2026",
      firstName: "New",
      lastName: "Member",
      email: "new.member@example.com",
      phone: "+1-555-0199",
      inviteCode: "READBOX-2026",
    },
    { settings },
  );
  assert.equal(registered.ok, true);
  if (registered.ok) {
    assert.equal(registered.verificationStatus, "verified");
    assert.equal(registered.requiresApproval, false);
  }
  assert.equal(state.users.length, 1);
  assert.equal(state.policies.length, 1);
  assert.equal(state.policies[0]?.maxMailboxes, 5);
  assert.deepEqual(state.policies[0]?.allowedDomainUuids, ["domain-uuid-1"]);
  assert.equal(state.policies[0]?.autoDeleteEnabled, true);
  assert.equal(state.policies[0]?.autoDeleteDays, 14);

  // Admin approval mode places user in pending_approval and blocks login until approved
  const approvalSettings = normalizeUserControlSettings({
    ...DEFAULT_USER_CONTROL_SETTINGS,
    verificationMode: "admin_approval",
  });
  const pendingSignup = await registerUserAccount(
    prisma,
    {
      username: "pending.user",
      password: "StrongPassword#2026",
      passwordConfirmation: "StrongPassword#2026",
      email: "pending@example.com",
    },
    { settings: approvalSettings },
  );
  assert.equal(pendingSignup.ok, true);
  if (pendingSignup.ok) {
    assert.equal(pendingSignup.requiresApproval, true);
    assert.equal(
      await authorizeCredentials(prisma, {
        username: "pending.user",
        password: "StrongPassword#2026",
        loginScope: "user",
      }),
      null,
    );

    const approvalResult = await updatePendingUserVerification(
      prisma,
      pendingSignup.userId,
      "verified",
    );
    assert.equal(approvalResult.ok, true);

    const afterApproval = await authorizeCredentials(prisma, {
      username: "pending.user",
      password: "StrongPassword#2026",
      loginScope: "user",
    });
    assert.equal(afterApproval?.username, "pending.user");
  }
});

test("dev demo auth and policy helpers enforce scope, domain access, mailbox quota, and retention cutoff", () => {
  clearDevDemoSessions();
  assert.equal(
    authorizeDevDemoCredentials("development", {
      username: "demo.admin",
      password: "demo-admin-local-dev",
      loginScope: "user",
    }),
    null,
  );
  assert.equal(
    authorizeDevDemoCredentials("development", {
      username: "demo.user",
      password: "demo-user-local-dev",
      loginScope: "admin",
    }),
    null,
  );
  assert.equal(
    authorizeDevDemoCredentials("development", {
      username: "demo.admin",
      password: "demo-admin-local-dev",
      loginScope: "admin",
    })?.isAdministrator,
    true,
  );

  const effective = resolveEffectiveUserPolicy(
    normalizeUserControlSettings({
      ...DEFAULT_USER_CONTROL_SETTINGS,
      allowedDomainUuids: ["dom-1", "dom-2"],
      defaultMaxMailboxes: 2,
      autoDeleteEnabled: true,
      autoDeleteDays: 7,
    }),
    null,
  );
  assert.equal(isDomainAllowedForUser("dom-1", effective), true);
  assert.equal(isDomainAllowedForUser("dom-3", effective), false);
  assert.equal(canUserCreateMoreMailboxes(1, effective).allowed, true);
  assert.equal(canUserCreateMoreMailboxes(2, effective).allowed, false);
  assert.equal(
    canUserCreateMoreMailboxes(2, effective).reason,
    "quota_reached",
  );

  const now = new Date("2026-11-15T00:00:00.000Z");
  const cutoff = computeMessageRetentionCutoff(effective, now);
  assert.equal(cutoff?.toISOString(), "2026-11-08T00:00:00.000Z");

  // Phase 2 FA-006: nullable UserAccessPolicy columns inherit global UserControlSettings dynamically
  const updatedGlobal = normalizeUserControlSettings({
    ...DEFAULT_USER_CONTROL_SETTINGS,
    defaultCanCreateMailboxes: false,
    defaultMaxMailboxes: 5,
    autoDeleteEnabled: true,
    autoDeleteDays: 14,
    allowedDomainUuids: ["dom-9"],
  });
  const inheritedFromNull = resolveEffectiveUserPolicy(updatedGlobal, {
    canCreateMailboxes: null,
    canDeleteMessages: true,
    canDeleteMailboxes: false,
    maxMailboxes: null,
    allowedDomainUuids: [],
    autoDeleteEnabled: null,
    autoDeleteDays: null,
  });
  assert.equal(inheritedFromNull.canCreateMailboxes, false);
  assert.equal(inheritedFromNull.canDeleteMessages, true);
  assert.equal(inheritedFromNull.canDeleteMailboxes, false);
  assert.equal(inheritedFromNull.maxMailboxes, 5);
  assert.deepEqual(inheritedFromNull.allowedDomainUuids, ["dom-9"]);
  assert.equal(inheritedFromNull.autoDeleteEnabled, true);
  assert.equal(inheritedFromNull.autoDeleteDays, 14);

  // Explicit non-null overrides win over global UserControlSettings
  const explicitOverride = resolveEffectiveUserPolicy(updatedGlobal, {
    canCreateMailboxes: true,
    canDeleteMessages: false,
    canDeleteMailboxes: false,
    maxMailboxes: 1,
    allowedDomainUuids: ["dom-custom"],
    autoDeleteEnabled: false,
    autoDeleteDays: 0,
  });
  assert.equal(explicitOverride.canCreateMailboxes, true);
  assert.equal(explicitOverride.maxMailboxes, 1);
  assert.deepEqual(explicitOverride.allowedDomainUuids, ["dom-custom"]);
  assert.equal(explicitOverride.autoDeleteEnabled, false);
  assert.equal(explicitOverride.autoDeleteDays, 0);
});

test("Phase-02 BUG-11, BUG-12, BUG-13, BUG-14: password reset, starter mailbox auto-provisioning, cross-table username uniqueness, and demo dynamic user overrides", async () => {
  resetDemoUserControlSettings();
  clearDevDemoSessions();
  clearAdminResetTokenStore();

  // BUG-12 & BUG-14: Demo sign-up with autoProvisionStarterMailbox enabled provisions starter mailbox & records user_self_signup event
  const starterSettings = normalizeUserControlSettings({
    ...DEFAULT_USER_CONTROL_SETTINGS,
    autoProvisionStarterMailbox: true,
  });
  const demoRegistered = await registerUserAccount(
    null,
    {
      username: "starter.user",
      password: "StarterPass#2026",
      passwordConfirmation: "StarterPass#2026",
      firstName: "Starter",
      lastName: "User",
      email: "starter.user@example.com",
    },
    { settings: starterSettings, devDemoActive: true },
  );
  assert.equal(demoRegistered.ok, true);
  if (demoRegistered.ok) {
    assert.equal(
      demoRegistered.starterMailboxEmail,
      "starter.user@readbox.local",
    );

    // BUG-14: Profile update on dynamic demo user is reflected in listDevDemoDynamicUsers()
    updateDevDemoProfile(demoRegistered.userId, {
      firstName: "UpdatedFirst",
      lastName: "UpdatedLast",
      email: "updated@example.com",
      phone: "+15550000",
    });
    const dynamicUsers = listDevDemoDynamicUsers();
    const updatedDynamic = dynamicUsers.find(
      (u) => u.id === demoRegistered.userId,
    );
    assert.equal(updatedDynamic?.firstName, "UpdatedFirst");

    const snapshot = getDevDemoSecuritySnapshot(demoRegistered.userId);
    assert.equal(
      snapshot.recentEvents.some((e) => e.action === "user_self_signup"),
      true,
    );
  }

  // BUG-11: Self-service password reset for Demo Mode and AdminAccount with dynamic policy
  const demoResetIssued = await requestPasswordReset(null, "starter.user", {
    devDemoActive: true,
  });
  assert.equal(demoResetIssued.ok, true);
  assert.ok(demoResetIssued.token);

  const weakDemoReset = await completePasswordResetDetailed(
    null,
    demoResetIssued.token!,
    "weakpass",
    "weakpass",
    {
      devDemoActive: true,
      policy: { minLength: 12, requireStrongPassword: true },
    },
  );
  assert.equal(weakDemoReset.ok, false);

  const validDemoReset = await completePasswordResetDetailed(
    null,
    demoResetIssued.token!,
    "NewStrongPass#2026",
    "NewStrongPass#2026",
    {
      devDemoActive: true,
      policy: { minLength: 12, requireStrongPassword: true },
    },
  );
  assert.equal(validDemoReset.ok, true);

  // BUG-11 & BUG-13 on Prisma: AdminAccount password reset + cross-table username collision prevention
  const { prisma, state } = makePhase1Prisma();
  state.admins.push({
    id: BigInt(101),
    username: "ops.admin",
    passwordHash: await hashPassword("AdminPass#2026!"),
    firstName: "Ops",
    lastName: "Admin",
    email: "ops.admin@readbox.local",
    isSuperuser: true,
    isActive: true,
    passwordResetRequired: false,
    lastLogin: null,
  });

  // BUG-13: createManagedUser blocks creating a regular user with an admin's username
  const collisionCreate = await createManagedUser(
    prisma,
    {
      username: "OPS.ADMIN",
      password: "ValidPassword#2026!",
      passwordConfirmation: "ValidPassword#2026!",
      firstName: "Duplicate",
      lastName: "User",
      email: "dup@readbox.local",
      isActive: true,
    },
    {
      actorId: BigInt(101),
      authSource: "admin_table",
      actorUsername: "ops.admin",
    },
  );
  assert.equal(collisionCreate.ok, false);
  if (!collisionCreate.ok) {
    assert.equal(collisionCreate.code, "validation");
  }

  // Create a regular user and verify upsertAdminAccountRecord rejects colliding username
  state.users.push({
    id: BigInt(501),
    username: "regular.member",
    passwordHash: await hashPassword("UserPass#2026!"),
    firstName: "Regular",
    lastName: "Member",
    email: "regular@readbox.local",
    phone: "",
    isActive: true,
    verificationStatus: "verified",
    passwordResetRequired: false,
    lastLogin: null,
  });
  await assert.rejects(
    upsertAdminAccountRecord(prisma, {
      username: "REGULAR.MEMBER",
      passwordHash: "hash",
    }),
  );

  // BUG-11 & FA-002: AdminAccount password reset persists in admin_reset_tokens (survives memory clear) and logs targetType admin_account
  const adminResetReq = await requestPasswordReset(prisma, "ops.admin");
  assert.equal(adminResetReq.ok, true);
  assert.ok(adminResetReq.token);
  assert.equal(state.adminResetTokens.length, 1);

  // Simulate process/worker restart by clearing any in-memory token store
  clearAdminResetTokenStore();

  const adminResetDone = await completePasswordResetDetailed(
    prisma,
    adminResetReq.token!,
    "NextAdminPass#2026!",
    "NextAdminPass#2026!",
    { policy: { minLength: 12, requireStrongPassword: true } },
  );
  assert.equal(adminResetDone.ok, true);
  assert.equal(state.adminResetTokens.length, 0);
  assert.equal(
    state.audits.some(
      (a) =>
        a.action === "password_reset_requested" &&
        a.targetType === "admin_account",
    ),
    true,
  );
  assert.equal(
    state.audits.some(
      (a) =>
        a.action === "password_reset_completed" &&
        a.targetType === "admin_account",
    ),
    true,
  );

  // Replay of already-used DB admin reset token must fail
  const replayAdminReset = await completePasswordResetDetailed(
    prisma,
    adminResetReq.token!,
    "NextAdminPass#2026!",
    "NextAdminPass#2026!",
    { policy: { minLength: 12, requireStrongPassword: true } },
  );
  assert.equal(replayAdminReset.ok, false);
});

test("Phase 3 FA-010: starter mailbox auto-provisioning refuses partial DB-only fallback when full Maildir/mailserver contract fails", async () => {
  const { prisma } = makePhase1Prisma();
  let bareMailboxCreates = 0;

  const clientObj = prisma as unknown as Record<string, unknown>;
  clientObj.domain = {
    findMany: async () => [
      {
        id: BigInt(1),
        uuid: "11111111-1111-4111-8111-111111111111",
        name: "readbox.test",
      },
    ],
    findUnique: async () => ({
      id: BigInt(1),
      uuid: "11111111-1111-4111-8111-111111111111",
      name: "readbox.test",
      status: "active",
      verificationStatus: "verified",
    }),
  };
  clientObj.mailboxMembership = {
    count: async () => 0,
  };
  clientObj.mailbox = {
    findFirst: async () => null,
    create: async () => {
      bareMailboxCreates += 1;
      throw new Error("Should never fall back to bare mailbox.create");
    },
  };
  // Force provisionMailbox to fail cleanly on mailserver SQL/lock step
  clientObj.$queryRaw = async () => {
    throw new Error("mailserver schema unavailable");
  };

  const starterSettings = normalizeUserControlSettings({
    ...DEFAULT_USER_CONTROL_SETTINGS,
    autoProvisionStarterMailbox: true,
  });

  const registered = await registerUserAccount(
    prisma,
    {
      username: "contract.user",
      password: "ContractPass#2026!",
      passwordConfirmation: "ContractPass#2026!",
      firstName: "Contract",
      lastName: "User",
      email: "contract@readbox.test",
    },
    { settings: starterSettings, devDemoActive: false },
  );

  assert.equal(registered.ok, true);
  if (registered.ok) {
    assert.equal(registered.starterMailboxEmail, null);
  }
  assert.equal(bareMailboxCreates, 0);
});
