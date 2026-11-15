import {
  ensureUserAccessPolicy,
  getAccountRoleFlags,
  getUserAccessCapabilities,
  isAccountAdministrator,
} from "@/core/accounts/policy";
import { recordAudit, sanitizeAuditDetails } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { authorizeCredentials } from "@/core/auth/credentials";
import { hashPassword } from "@/core/auth/password";
import type { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { test } from "node:test";

test("sanitizeAuditDetails recursively redacts sensitive keys and normalizes BigInt/Date", () => {
  const createdAt = new Date("2026-11-15T10:00:00.000Z");
  const details = sanitizeAuditDetails({
    username: "admin.user",
    password: "super-secret-password",
    nested: {
      authToken: "tok-123",
      session_id: "sid-456",
      X_Authorization_Header: "Bearer abc",
      privateKeyPem: "-----BEGIN PRIVATE KEY-----",
      safeField: "kept",
    },
    items: [
      { cookieValue: "secret-cookie", id: BigInt(99), at: createdAt },
      "plain-string",
    ],
  });

  assert.equal(details.username, "admin.user");
  assert.equal(details.password, "[REDACTED]");
  assert.deepEqual(details.nested, {
    authToken: "[REDACTED]",
    session_id: "[REDACTED]",
    X_Authorization_Header: "[REDACTED]",
    privateKeyPem: "[REDACTED]",
    safeField: "kept",
  });
  assert.deepEqual(details.items, [
    {
      cookieValue: "[REDACTED]",
      id: "99",
      at: "2026-11-15T10:00:00.000Z",
    },
    "plain-string",
  ]);
});

test("recordAudit enforces trusted-proxy IP rules, field truncation, and safe error handling", async () => {
  const captured: unknown[] = [];
  const fakePrisma: AuditWriteClient = {
    auditLog: {
      create: async (args) => {
        captured.push(args.data);
        return { id: BigInt(1), ...args.data };
      },
    },
  };

  const untrustedHeaders = new Headers({
    "x-forwarded-for": "203.0.113.55",
    "user-agent": "ReadBox-Test/1.0",
  });
  await recordAudit(fakePrisma, {
    actorId: "42",
    action: "x".repeat(120),
    targetType: "y".repeat(120),
    targetIdentifier: "z".repeat(300),
    headers: untrustedHeaders,
    trustProxyHeaders: false,
    details: { apiToken: "secret-val", ok: true },
  });

  assert.equal(captured.length, 1);
  const first = captured[0] as {
    actorId: bigint | null;
    action: string;
    targetType: string;
    targetIdentifier: string;
    ipAddress: string | null;
    userAgent: string;
    details: Record<string, unknown>;
  };
  assert.equal(first.actorId, BigInt(42));
  assert.equal(first.action.length, 80);
  assert.equal(first.targetType.length, 80);
  assert.equal(first.targetIdentifier.length, 255);
  assert.equal(first.ipAddress, null);
  assert.equal(first.userAgent, "ReadBox-Test/1.0");
  assert.deepEqual(first.details, { apiToken: "[REDACTED]", ok: true });

  await recordAudit(fakePrisma, {
    action: "login_success",
    headers: untrustedHeaders,
    trustProxyHeaders: true,
  });
  const second = captured[1] as { ipAddress: string | null };
  assert.equal(second.ipAddress, "203.0.113.55");

  const failingPrisma: AuditWriteClient = {
    auditLog: {
      create: async () => {
        throw new Error("DB down");
      },
    },
  };
  const failed = await recordAudit(failingPrisma, {
    action: "login_failure",
  });
  assert.equal(failed, null);
});

test("authorizeCredentials writes login_failure, lockout, and login_success into AuditLog", async () => {
  const passwordHash = await hashPassword("synthetic-audit-password-15+");
  const attempts: {
    usernameNormalized: string;
    ipAddress: string | null;
    succeeded: boolean;
    createdAt: Date;
  }[] = [];
  const auditLogs: {
    actorId: bigint | null;
    action: string;
    targetType: string;
    targetIdentifier: string;
    ipAddress: string | null;
    userAgent: string;
    details: Record<string, unknown>;
  }[] = [];

  const syntheticUser = {
    id: BigInt(7),
    username: "audit.operator",
    firstName: "Audit",
    lastName: "Operator",
    email: "audit@example.invalid",
    passwordHash,
    passwordResetRequired: false,
    isActive: true,
    administratorProfile: { isSuperuser: true },
    lastLogin: null as Date | null,
  };

  const client = {
    $executeRaw: async () => 1,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    user: {
      findFirst: async () => syntheticUser,
      findUnique: async () => ({ passwordHash: syntheticUser.passwordHash }),
      update: async (args: { data: { lastLogin: Date } }) => {
        syntheticUser.lastLogin = args.data.lastLogin;
        return syntheticUser;
      },
    },
    loginAttempt: {
      findMany: async (args: {
        where: {
          usernameNormalized: string;
          ipAddress: string | null;
        };
      }) =>
        attempts
          .filter(
            (attempt) =>
              attempt.usernameNormalized === args.where.usernameNormalized &&
              attempt.ipAddress === args.where.ipAddress &&
              !attempt.succeeded,
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((attempt) => ({ createdAt: attempt.createdAt })),
      deleteMany: async () => ({ count: 0 }),
      create: async (args: {
        data: {
          usernameNormalized: string;
          ipAddress: string | null;
          succeeded: boolean;
          createdAt: Date;
        };
      }) => {
        attempts.push(args.data);
        return args.data;
      },
    },
    auditLog: {
      create: async (args: { data: (typeof auditLogs)[number] }) => {
        auditLogs.push(args.data);
        return args.data;
      },
    },
  } as unknown as PrismaClient;

  await authorizeCredentials(
    client,
    { username: "audit.operator", password: "wrong-password" },
    {
      clientIp: "198.51.100.7",
      userAgent: "TestBrowser/2.0",
      failureLimit: 1,
      failureWindowMs: 60_000,
      lockoutMs: 60_000,
      now: new Date("2026-11-15T10:00:00.000Z"),
    },
  );
  await authorizeCredentials(
    client,
    { username: "audit.operator", password: "synthetic-audit-password-15+" },
    {
      clientIp: "198.51.100.7",
      userAgent: "TestBrowser/2.0",
      failureLimit: 1,
      failureWindowMs: 60_000,
      lockoutMs: 60_000,
      now: new Date("2026-11-15T10:00:10.000Z"),
    },
  );
  await authorizeCredentials(
    client,
    { username: "audit.operator", password: "synthetic-audit-password-15+" },
    {
      clientIp: "203.0.113.8",
      userAgent: "TestBrowser/2.0",
      failureLimit: 1,
      failureWindowMs: 60_000,
      lockoutMs: 60_000,
      now: new Date("2026-11-15T10:00:20.000Z"),
    },
  );

  assert.equal(auditLogs.length, 3);
  assert.equal(auditLogs[0]?.action, "login_failure");
  assert.deepEqual(auditLogs[0]?.details, {
    reason: "invalid_password",
    username: "audit.operator",
  });
  assert.equal(auditLogs[1]?.action, "login_failure");
  assert.deepEqual(auditLogs[1]?.details, {
    reason: "lockout",
    username: "audit.operator",
  });
  assert.equal(auditLogs[2]?.action, "login_success");
  assert.equal(auditLogs[2]?.actorId, BigInt(7));
  assert.equal(auditLogs[2]?.ipAddress, "203.0.113.8");
  assert.equal(auditLogs[2]?.userAgent, "TestBrowser/2.0");
});

test("accounts/policy ignores legacy staff flags and enforces UserAccessPolicy defaults", async () => {
  const legacyOnlyAccount = {
    isStaff: true,
    isSuperuser: true,
    administratorProfile: null,
  };
  assert.equal(isAccountAdministrator(legacyOnlyAccount), false);
  assert.deepEqual(getAccountRoleFlags(legacyOnlyAccount), {
    isAdministrator: false,
    isSuperuser: false,
  });

  const adminAccount = {
    isStaff: false,
    isSuperuser: false,
    administratorProfile: { isSuperuser: false },
  };
  assert.equal(isAccountAdministrator(adminAccount), true);
  assert.deepEqual(getAccountRoleFlags(adminAccount), {
    isAdministrator: true,
    isSuperuser: false,
  });

  const policies = new Map<
    bigint,
    { canDeleteMessages: boolean; canDeleteMailboxes: boolean }
  >();
  const policyPrisma = {
    userAccessPolicy: {
      upsert: async (args: {
        where: { userId: bigint };
        create: {
          userId: bigint;
          canDeleteMessages: boolean;
          canDeleteMailboxes: boolean;
        };
      }) => {
        const existing = policies.get(args.where.userId);
        if (existing) return existing;
        const created = {
          canDeleteMessages: args.create.canDeleteMessages,
          canDeleteMailboxes: args.create.canDeleteMailboxes,
        };
        policies.set(args.where.userId, created);
        return created;
      },
      findUnique: async (args: { where: { userId: bigint } }) =>
        policies.get(args.where.userId) ?? null,
    },
  } as unknown as Pick<PrismaClient, "userAccessPolicy">;

  assert.deepEqual(await getUserAccessCapabilities(policyPrisma, BigInt(12)), {
    canDeleteMessages: false,
    canDeleteMailboxes: false,
  });
  assert.deepEqual(await ensureUserAccessPolicy(policyPrisma, BigInt(12)), {
    canDeleteMessages: false,
    canDeleteMailboxes: false,
  });
});
