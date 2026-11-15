import {
  generateRandomUsername,
  generateSecurePassword,
} from "@/core/accounts/credentials-generator";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUserForEdit,
  listManagedUsers,
  updateManagedUser,
} from "@/core/accounts/users";
import {
  evaluateIngestionHeartbeat,
  getAdminOverviewData,
  type OverviewPrismaClient,
} from "@/core/admin/overview";
import {
  listAuditLogs,
  listLoginSecurityMonitor,
} from "@/core/audit/queries";
import { MIN_PASSWORD_LENGTH } from "@/core/auth/password-policy";
import type { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { test } from "node:test";

test("getAdminOverviewData returns safe unconfigured state without DATABASE_URL", async () => {
  const overview = await getAdminOverviewData({
    hasDatabaseUrl: false,
    mailStorageRoot: "/tmp/nonexistent-vmail",
    checkStorageAccess: async () => ({ ok: false, detail: "Unavailable" }),
  });

  assert.equal(overview.databaseConfigured, false);
  assert.equal(overview.databaseConnected, false);
  assert.equal(overview.health.database.state, "unconfigured");
  assert.equal(overview.health.mailStorage.state, "bad");
  assert.equal(overview.kpis.totalMailboxes, 0);
  assert.deepEqual(overview.recentMessages, []);
});

test("getAdminOverviewData computes KPIs, heartbeat states, and recent lists", async () => {
  const now = new Date("2026-11-15T12:00:00.000Z");
  const mockPrisma = {
    $queryRaw: async () => [{ "?column?": 1 }],
    mailbox: {
      count: async (args?: { where?: { status?: string } }) => {
        if (args?.where?.status === "active") return 7;
        if (args?.where?.status === "disabled") return 2;
        return 9;
      },
      findMany: async () => [
        {
          uuid: "mb-1",
          emailAddress: "sales@example.com",
          status: "active",
          totalMessages: BigInt(14),
        },
      ],
    },
    message: {
      count: async (args?: { where?: { isRead?: boolean } }) =>
        args?.where?.isRead === false ? 3 : 14,
      findFirst: async () => ({
        receivedAt: new Date("2026-11-15T11:55:00.000Z"),
      }),
      findMany: async () => [
        {
          uuid: "msg-1",
          subject: "Welcome to ReadBox",
          senderAddress: "alice@remote.test",
          senderName: "Alice",
          receivedAt: new Date("2026-11-15T11:55:00.000Z"),
          isRead: false,
          mailbox: {
            uuid: "mb-1",
            emailAddress: "sales@example.com",
          },
        },
      ],
    },
    serviceHeartbeat: {
      findUnique: async () => ({
        status: "healthy",
        lastSeenAt: new Date("2026-11-15T11:59:10.000Z"),
      }),
    },
  } as unknown as OverviewPrismaClient;

  const overview = await getAdminOverviewData({
    prisma: mockPrisma,
    hasDatabaseUrl: true,
    mailStorageRoot: "/var/vmail",
    ingestionStaleAfterSeconds: 120,
    now,
    checkStorageAccess: async () => ({ ok: true, detail: "Accessible" }),
  });

  assert.equal(overview.databaseConfigured, true);
  assert.equal(overview.databaseConnected, true);
  assert.equal(overview.kpis.totalMailboxes, 9);
  assert.equal(overview.kpis.activeMailboxes, 7);
  assert.equal(overview.kpis.disabledMailboxes, 2);
  assert.equal(overview.kpis.totalMessages, 14);
  assert.equal(overview.kpis.totalUnread, 3);
  assert.equal(overview.kpis.lastReceivedAt, "2026-11-15T11:55:00.000Z");
  assert.equal(overview.health.database.state, "ok");
  assert.equal(overview.health.ingestion.state, "ok");
  assert.equal(overview.health.mailStorage.state, "ok");
  assert.equal(overview.recentMessages[0]?.mailboxEmail, "sales@example.com");
  assert.equal(overview.recentMailboxes[0]?.totalMessages, "14");

  const stale = evaluateIngestionHeartbeat(
    {
      status: "healthy",
      lastSeenAt: new Date("2026-11-15T11:50:00.000Z"),
    },
    120,
    now,
  );
  assert.equal(stale.state, "warn");
  assert.equal(stale.detail, "Stale heartbeat");
});

test("credentials generators produce valid usernames and >=15 char complex passwords", () => {
  const generatedUsername = generateRandomUsername({
    firstName: "Amina",
    lastName: "Rahman!",
  });
  assert.match(generatedUsername, /^amina\.rahman\d{2}$/);

  const fallbackUsername = generateRandomUsername();
  assert.match(fallbackUsername, /^[a-z]+\.[a-z]+\d{2}$/);

  const password = generateSecurePassword(16);
  assert.ok(password.length >= MIN_PASSWORD_LENGTH);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[!@#$%^&*()\-_=+]/);
});

test("createManagedUser provisions non-admin user, policy, memberships, and audits", async () => {
  const audits: Array<{ action: string; targetIdentifier: string; details: unknown }> = [];
  let createdUserData: Record<string, unknown> | null = null;
  let createdPolicyData: Record<string, unknown> | null = null;
  let createdMemberships: Array<Record<string, unknown>> = [];

  const mockPrisma = {
    user: {
      findFirst: async () => null,
      findUnique: async ({ where }: { where: { id: bigint } }) =>
        where.id === BigInt(1) ? { id: BigInt(1) } : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdUserData = data;
        return {
          id: BigInt(42),
          username: data.username as string,
          isActive: data.isActive as boolean,
        };
      },
    },
    mailbox: {
      findMany: async () => [
        { id: BigInt(10), emailAddress: "team@example.com" },
      ],
    },
    userAccessPolicy: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdPolicyData = data;
        return data;
      },
    },
    mailboxMembership: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        createdMemberships = data;
        return { count: data.length };
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; targetIdentifier: string; details: unknown } }) => {
        audits.push({
          action: data.action,
          targetIdentifier: data.targetIdentifier,
          details: data.details,
        });
        return data;
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(mockPrisma),
  } as unknown as PrismaClient;

  const result = await createManagedUser(
    mockPrisma,
    {
      username: "maya.lin",
      firstName: "Maya",
      lastName: "Lin",
      email: "maya@example.com",
      isActive: true,
      password: "CorrectHorseBatteryStaple!99",
      passwordConfirmation: "CorrectHorseBatteryStaple!99",
      canDeleteMessages: true,
      canDeleteMailboxes: false,
      assignedMailboxIds: ["10"],
    },
    { actorId: BigInt(1), clientIp: "198.51.100.7" },
    async (plain) => `hashed:${plain.length}`,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.username, "maya.lin");
  }
  assert.equal(createdUserData?.["isStaff"], false);
  assert.equal(createdUserData?.["isSuperuser"], false);
  assert.equal(createdUserData?.["passwordResetRequired"], false);
  assert.equal(createdPolicyData?.["canDeleteMessages"], true);
  assert.equal(createdMemberships.length, 1);
  assert.deepEqual(
    audits.map((entry) => entry.action),
    [
      "mailbox_assignment_added",
      "user_delete_permissions_changed",
      "user_created",
    ],
  );
});

test("updateManagedUser & getManagedUserForEdit block administrators and audit diffs", async () => {
  const adminPrisma = {
    user: {
      findUnique: async () => ({
        id: BigInt(7),
        username: "admin.root",
        firstName: "Root",
        lastName: "Admin",
        email: "root@example.com",
        isActive: true,
        dateJoined: new Date(),
        lastLogin: null,
        administratorProfile: { isSuperuser: true },
        accessPolicy: null,
        memberships: [],
      }),
    },
    userAccessPolicy: {},
  } as unknown as PrismaClient;

  const blockedGet = await getManagedUserForEdit(adminPrisma, "7");
  assert.equal(blockedGet.ok, false);
  if (!blockedGet.ok) {
    assert.equal(blockedGet.code, "admin_protected");
  }

  const audits: string[] = [];
  const updatePrisma = {
    user: {
      findUnique: async ({ where }: { where: { id: bigint } }) => {
        if (where.id === BigInt(1)) return { id: BigInt(1) };
        return {
          id: BigInt(15),
          username: "casey",
          isActive: true,
          administratorProfile: null,
          accessPolicy: {
            canDeleteMessages: false,
            canDeleteMailboxes: false,
          },
          memberships: [
            {
              mailboxId: BigInt(100),
              mailbox: { emailAddress: "old@example.com" },
            },
          ],
        };
      },
      findFirst: async () => null,
      update: async ({ data }: { data: { username: string; isActive: boolean } }) => ({
        id: BigInt(15),
        username: data.username,
        isActive: data.isActive,
      }),
    },
    mailbox: {
      findMany: async () => [
        { id: BigInt(200), emailAddress: "new@example.com" },
      ],
    },
    userAccessPolicy: {
      upsert: async () => ({}),
    },
    mailboxMembership: {
      deleteMany: async () => ({ count: 1 }),
      createMany: async () => ({ count: 1 }),
    },
    auditLog: {
      create: async ({ data }: { data: { action: string } }) => {
        audits.push(data.action);
        return data;
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(updatePrisma),
  } as unknown as PrismaClient;

  const updateResult = await updateManagedUser(
    updatePrisma,
    "15",
    {
      username: "casey",
      firstName: "Casey",
      lastName: "Reed",
      email: "",
      isActive: false,
      canDeleteMessages: true,
      canDeleteMailboxes: false,
      assignedMailboxIds: ["200"],
    },
    { actorId: BigInt(1), clientIp: "198.51.100.7" },
  );

  assert.equal(updateResult.ok, true);
  assert.deepEqual(audits, [
    "mailbox_assignment_added",
    "mailbox_assignment_removed",
    "user_delete_permissions_changed",
    "user_deactivated",
    "user_updated",
  ]);
});

test("deleteManagedUser enforces self-delete, last-admin, and admin-delete guards while preserving mailboxes for regular users", async () => {
  const basePrisma = {
    user: {
      findUnique: async () => null,
      count: async () => 1,
      delete: async () => ({}),
    },
    auditLog: {
      create: async () => ({}),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(basePrisma),
  } as unknown as PrismaClient;

  const selfAttempt = await deleteManagedUser(basePrisma, "1", {
    actorId: BigInt(1),
  });
  assert.equal(selfAttempt.ok, false);
  if (!selfAttempt.ok) assert.equal(selfAttempt.code, "self_delete");

  const lastAdminPrisma = {
    ...basePrisma,
    user: {
      ...basePrisma.user,
      findUnique: async () => ({
        id: BigInt(2),
        username: "other.admin",
        isActive: true,
        administratorProfile: { isSuperuser: false },
      }),
      count: async () => 1,
    },
  } as unknown as PrismaClient;

  const lastAdminAttempt = await deleteManagedUser(lastAdminPrisma, "2", {
    actorId: BigInt(1),
  });
  assert.equal(lastAdminAttempt.ok, false);
  if (!lastAdminAttempt.ok) assert.equal(lastAdminAttempt.code, "last_admin");

  let deletedId: bigint | null = null;
  let loggedDetails: unknown = null;
  const regularDeletePrisma = {
    user: {
      findUnique: async ({ where }: { where: { id: bigint } }) => {
        if (where.id === BigInt(1)) return { id: BigInt(1) };
        return {
          id: BigInt(9),
          username: "inbox.user",
          isActive: true,
          administratorProfile: null,
        };
      },
      count: async () => 1,
      delete: async ({ where }: { where: { id: bigint } }) => {
        deletedId = where.id;
        return {};
      },
    },
    auditLog: {
      create: async ({ data }: { data: { details: unknown } }) => {
        loggedDetails = data.details;
        return data;
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
      fn(regularDeletePrisma),
  } as unknown as PrismaClient;

  const deleted = await deleteManagedUser(regularDeletePrisma, "9", {
    actorId: BigInt(1),
  });
  assert.equal(deleted.ok, true);
  assert.equal(deletedId, BigInt(9));
  assert.deepEqual(loggedDetails, { mailboxes_preserved: true });
});

test("listManagedUsers & audit queries redact details and compute active LoginAttempt lockouts", async () => {
  const userList = await listManagedUsers(
    {
      user: {
        count: async () => 1,
        findMany: async () => [
          {
            id: BigInt(3),
            username: "admin.one",
            firstName: "Admin",
            lastName: "One",
            email: "",
            isActive: true,
            dateJoined: new Date("2026-11-01T00:00:00.000Z"),
            lastLogin: null,
            administratorProfile: { isSuperuser: true },
            accessPolicy: null,
            _count: { memberships: 2 },
          },
        ],
      },
    } as unknown as Pick<PrismaClient, "user">,
    { query: "admin", page: 1 },
  );
  assert.equal(userList.items[0]?.isAdministrator, true);
  assert.equal(userList.items[0]?.mailboxCount, 2);

  const logs = await listAuditLogs(
    {
      auditLog: {
        count: async () => 1,
        findMany: async (args: { distinct?: string[] }) => {
          if (args.distinct) return [{ action: "user_created" }];
          return [
            {
              uuid: "a-1",
              action: "user_created",
              targetType: "user",
              targetIdentifier: "maya.lin",
              ipAddress: "198.51.100.7",
              userAgent: "Test",
              details: { password: "leak", active: true },
              createdAt: new Date("2026-11-15T10:00:00.000Z"),
              actor: { username: "admin.one" },
            },
          ];
        },
      },
    } as unknown as Pick<PrismaClient, "auditLog">,
    { action: "user_created", page: 1 },
  );

  assert.equal(logs.items[0]?.details["password"], "[REDACTED]");
  assert.equal(logs.items[0]?.details["active"], true);

  const now = new Date("2026-11-15T12:00:00.000Z");
  const monitor = await listLoginSecurityMonitor(
    {
      loginAttempt: {
        findMany: async (args: { take?: number }) => {
          if (args.take === 25) return [];
          return Array.from({ length: 5 }, (_, idx) => ({
            usernameNormalized: "victim",
            ipAddress: "203.0.113.99",
            createdAt: new Date(now.getTime() - (idx + 1) * 30_000),
          }));
        },
      },
    } as unknown as Pick<PrismaClient, "loginAttempt">,
    {
      failureLimit: 5,
      failureWindowSeconds: 900,
      lockoutSeconds: 900,
      now,
    },
  );

  assert.equal(monitor.activeLockouts.length, 1);
  assert.equal(monitor.activeLockouts[0]?.usernameNormalized, "victim");
  assert.equal(monitor.activeLockouts[0]?.failureCount, 5);
});
