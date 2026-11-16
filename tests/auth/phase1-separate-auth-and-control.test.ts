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
import { authorizeCredentials } from "@/core/auth/credentials";
import {
  authorizeDevDemoCredentials,
  clearDevDemoSessions,
} from "@/core/auth/dev-demo-auth";
import { createOpaqueToken } from "@/core/auth/opaque-token";
import { hashPassword } from "@/core/auth/password";
import {
  getActiveAppSession,
  registerAppSession,
  revokeAppSession,
} from "@/core/auth/session-registry";
import {
  registerUserAccount,
  updatePendingUserVerification,
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
    }[],
    appSessions: [] as {
      userId: bigint;
      tokenHash: string;
      expiresAt: Date;
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
      findFirst: async (args: { where: { username?: { equals?: string } } }) => {
        const target = args.where.username?.equals?.toLowerCase();
        return (
          state.admins.find(
            (row) => row.username.toLowerCase() === target,
          ) ?? null
        );
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
    },
    adminSession: {
      create: async (args: {
        data: { adminId: bigint; tokenHash: string; expiresAt: Date };
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
      deleteMany: async (args: { where: { tokenHash?: string } }) => {
        const before = state.adminSessions.length;
        state.adminSessions = state.adminSessions.filter(
          (row) => row.tokenHash !== args.where.tokenHash,
        );
        return { count: before - state.adminSessions.length };
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
          phone: args.data.phone,
          isActive: args.data.isActive,
          verificationStatus: args.data.verificationStatus,
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
          canCreateMailboxes: boolean;
          canDeleteMessages: boolean;
          canDeleteMailboxes: boolean;
          maxMailboxes: number;
          allowedDomainUuids: string[];
          autoDeleteEnabled: boolean;
          autoDeleteDays: number;
        };
      }) => {
        state.policies.push(args.data);
        return args.data;
      },
    },
    appSession: {
      create: async (args: {
        data: { userId: bigint; tokenHash: string; expiresAt: Date };
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

test("separate admin_sessions and app_sessions isolate session lifecycle", async () => {
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
  const expiresAt = new Date(Date.now() + 60_000);

  assert.equal(
    await registerAppSession(prisma, "101", adminToken, expiresAt, {
      authSource: "admin_table",
    }),
    true,
  );
  assert.equal(state.adminSessions.length, 1);
  assert.equal(state.appSessions.length, 0);

  assert.equal(
    await registerAppSession(prisma, "501", userToken, expiresAt, {
      authSource: "user_table",
    }),
    true,
  );
  assert.equal(state.appSessions.length, 1);

  const activeAdmin = await getActiveAppSession(prisma, "101", adminToken, {
    authSource: "admin_table",
  });
  assert.equal(activeAdmin?.username, "ops.admin");
  assert.equal(activeAdmin?.isAdministrator, true);
  assert.equal(activeAdmin?.authSource, "admin_table");

  const activeUser = await getActiveAppSession(prisma, "501", userToken, {
    authSource: "user_table",
  });
  assert.equal(activeUser?.username, "workspace.member");
  assert.equal(activeUser?.isAdministrator, false);
  assert.equal(activeUser?.authSource, "user_table");

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
});
