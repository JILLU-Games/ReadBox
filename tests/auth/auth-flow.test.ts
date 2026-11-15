import { authorizeCredentials } from "@/core/auth/credentials";
import { createOpaqueToken, hashOpaqueToken } from "@/core/auth/opaque-token";
import { bootstrapInitialAccount } from "@/core/auth/operator-bootstrap";
import { getOperatorEnvironmentError } from "@/core/auth/operator-environment";
import { hashPassword } from "@/core/auth/password";
import {
  LOGIN_FAILURE_LIMIT,
  passwordConfirmationMatches,
} from "@/core/auth/password-policy";
import {
  completePasswordReset,
  issuePasswordResetToken,
} from "@/core/auth/password-reset";
import { getAuthRuntimeConfigurationError } from "@/core/auth/runtime-policy";
import {
  getActiveAppSession,
  registerAppSession,
  revokeAppSession,
} from "@/core/auth/session-registry";
import type { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { test } from "node:test";

interface SyntheticUser {
  id: bigint;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  passwordResetRequired: boolean;
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  lastLogin?: Date | null;
}

test("password confirmation accepts only identical string values", () => {
  assert.equal(
    passwordConfirmationMatches("synthetic-password", "synthetic-password"),
    true,
  );
  assert.equal(
    passwordConfirmationMatches("synthetic-password", "different-password"),
    false,
  );
  assert.equal(passwordConfirmationMatches("synthetic-password", null), false);
  assert.equal(passwordConfirmationMatches(undefined, undefined), false);
});

interface SyntheticLoginAttempt {
  usernameNormalized: string;
  ipAddress: string | null;
  succeeded: boolean;
  createdAt: Date;
}

interface SyntheticResetToken {
  userId: bigint;
  tokenHash: string;
  expiresAt: Date;
}

interface SyntheticAppSession {
  userId: bigint;
  tokenHash: string;
  expiresAt: Date;
}

interface SyntheticAdministratorProfile {
  id: bigint;
  userId: bigint;
  isSuperuser: boolean;
}

function makeSyntheticPrisma(initialUser?: SyntheticUser) {
  const state = {
    users: initialUser ? [initialUser] : ([] as SyntheticUser[]),
    attempts: [] as SyntheticLoginAttempt[],
    resetTokens: [] as SyntheticResetToken[],
    sessions: [] as SyntheticAppSession[],
    administratorProfiles: [] as SyntheticAdministratorProfile[],
    passwordHashReads: 0,
    nextId: initialUser ? initialUser.id + BigInt(1) : BigInt(1),
    nextAdministratorProfileId: BigInt(1),
  };
  const client: Record<string, unknown> = {};
  const whereMatchesToken = (
    where: Record<string, unknown>,
    row: SyntheticResetToken,
  ) =>
    (where.userId === undefined || where.userId === row.userId) &&
    (where.tokenHash === undefined || where.tokenHash === row.tokenHash) &&
    (typeof where.expiresAt !== "object" ||
      where.expiresAt === null ||
      ("gt" in where.expiresAt &&
        row.expiresAt > (where.expiresAt as { gt: Date }).gt));

  client.$queryRaw = async (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    if (query.join("").includes('SELECT "id" FROM "users"')) {
      const userId = values[0];
      const user = state.users.find((candidate) => candidate.id === userId);
      return user?.isActive && !user.passwordResetRequired
        ? [{ id: user.id }]
        : [];
    }
    return [];
  };
  client.$executeRaw = async () => 1;
  client.$transaction = async (
    callback: (transaction: unknown) => Promise<unknown>,
  ) => callback(client);
  client.$disconnect = async () => undefined;
  client.user = {
    count: async () => state.users.length,
    create: async (args: {
      data: Omit<SyntheticUser, "id" | "isStaff" | "isSuperuser"> &
        Partial<Pick<SyntheticUser, "isStaff" | "isSuperuser">>;
      select?: Record<string, boolean>;
    }) => {
      const user = {
        isStaff: false,
        isSuperuser: false,
        ...args.data,
        id: state.nextId++,
      };
      state.users.push(user);
      return args.select?.id ? { id: user.id } : user;
    },
    findFirst: async (args: { where: { username?: { equals?: string } } }) => {
      const username = args.where.username?.equals?.toLowerCase();
      const user =
        state.users.find(
          (candidate) => candidate.username.toLowerCase() === username,
        ) ?? null;
      if (!user) return null;
      return {
        ...user,
        administratorProfile:
          state.administratorProfiles.find(
            (profile) => profile.userId === user.id,
          ) ?? null,
      };
    },
    findUnique: async (args: {
      where: { id?: bigint };
      select?: Record<string, boolean>;
    }) => {
      const user = state.users.find(
        (candidate) => candidate.id === args.where.id,
      );
      if (!user) return null;
      if (args.select?.passwordHash) {
        state.passwordHashReads += 1;
        return { passwordHash: user.passwordHash };
      }
      if (args.select?.id && Object.keys(args.select).length === 1) {
        return { id: user.id };
      }
      return user;
    },
    update: async (args: {
      where: { id: bigint };
      data: Partial<SyntheticUser>;
    }) => {
      const user = state.users.find(
        (candidate) => candidate.id === args.where.id,
      );
      if (!user) throw new Error("Synthetic user missing");
      Object.assign(user, args.data);
      return user;
    },
  };
  client.loginAttempt = {
    findMany: async (args: {
      where: {
        usernameNormalized: string;
        ipAddress: string | null;
        succeeded: false;
        createdAt: { gte: Date };
      };
    }) =>
      state.attempts
        .filter(
          (attempt) =>
            attempt.usernameNormalized === args.where.usernameNormalized &&
            attempt.ipAddress === args.where.ipAddress &&
            !attempt.succeeded &&
            attempt.createdAt >= args.where.createdAt.gte,
        )
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((attempt) => ({ createdAt: attempt.createdAt })),
    deleteMany: async (args: {
      where: {
        usernameNormalized?: string;
        ipAddress?: string | null;
        succeeded?: boolean;
        createdAt?: { lt: Date };
      };
    }) => {
      const before = state.attempts.length;
      state.attempts = state.attempts.filter((attempt) => {
        if (
          args.where.usernameNormalized !== undefined &&
          attempt.usernameNormalized !== args.where.usernameNormalized
        ) {
          return true;
        }
        if (
          args.where.ipAddress !== undefined &&
          attempt.ipAddress !== args.where.ipAddress
        ) {
          return true;
        }
        if (
          args.where.succeeded !== undefined &&
          attempt.succeeded !== args.where.succeeded
        ) {
          return true;
        }
        if (
          args.where.createdAt?.lt &&
          !(attempt.createdAt < args.where.createdAt.lt)
        ) {
          return true;
        }
        return false;
      });
      return { count: before - state.attempts.length };
    },
    create: async (args: {
      data: Omit<SyntheticLoginAttempt, "createdAt"> & { createdAt?: Date };
    }) => {
      const attempt = {
        ...args.data,
        createdAt: args.data.createdAt ?? new Date(),
      };
      state.attempts.push(attempt);
      return attempt;
    },
  };
  client.passwordResetToken = {
    create: async (args: { data: SyntheticResetToken }) => {
      state.resetTokens.push(args.data);
      return args.data;
    },
    findUnique: async (args: { where: { tokenHash: string } }) =>
      state.resetTokens.find((row) => row.tokenHash === args.where.tokenHash) ??
      null,
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      const matches = state.resetTokens.filter((row) =>
        whereMatchesToken(args.where, row),
      );
      state.resetTokens = state.resetTokens.filter(
        (row) => !whereMatchesToken(args.where, row),
      );
      return { count: matches.length };
    },
  };
  client.administratorProfile = {
    create: async (args: {
      data: { userId: bigint; isSuperuser?: boolean };
    }) => {
      const profile = {
        id: state.nextAdministratorProfileId++,
        userId: args.data.userId,
        isSuperuser: args.data.isSuperuser ?? false,
      };
      state.administratorProfiles.push(profile);
      return profile;
    },
  };
  client.appSession = {
    create: async (args: { data: SyntheticAppSession }) => {
      state.sessions.push(args.data);
      return args.data;
    },
    findUnique: async (args: { where: { tokenHash: string } }) => {
      const row = state.sessions.find(
        (session) => session.tokenHash === args.where.tokenHash,
      );
      const user = state.users.find(
        (candidate) => candidate.id === row?.userId,
      );
      if (!row || !user) return null;
      return {
        ...row,
        user: {
          ...user,
          administratorProfile:
            state.administratorProfiles.find(
              (profile) => profile.userId === user.id,
            ) ?? null,
        },
      };
    },
    deleteMany: async (args: {
      where: { userId?: bigint; tokenHash?: string };
    }) => {
      const matches = (row: SyntheticAppSession) =>
        (args.where.userId === undefined || row.userId === args.where.userId) &&
        (args.where.tokenHash === undefined ||
          row.tokenHash === args.where.tokenHash);
      const before = state.sessions.length;
      state.sessions = state.sessions.filter((row) => !matches(row));
      return { count: before - state.sessions.length };
    },
  };

  return { prisma: client as unknown as PrismaClient, state };
}

function resetRequiredUser(): SyntheticUser {
  return {
    id: BigInt(41),
    username: "synthetic.operator",
    firstName: "Synthetic",
    lastName: "Operator",
    email: "synthetic@example.invalid",
    passwordHash: "synthetic-placeholder-that-must-not-be-read",
    passwordResetRequired: true,
    isActive: true,
    isStaff: true,
    isSuperuser: true,
  };
}

test("production allows auth only with database and secret and forbids dev auth modes", () => {
  assert.equal(
    getAuthRuntimeConfigurationError({
      nodeEnv: "production",
      authEnabled: true,
      hasAuthSecret: true,
      hasDatabaseUrl: true,
      devAuthMode: "off",
    }),
    null,
  );
  assert.equal(
    getAuthRuntimeConfigurationError({
      nodeEnv: "production",
      authEnabled: true,
      hasAuthSecret: true,
      hasDatabaseUrl: false,
      devAuthMode: "off",
    }),
    "DATABASE_URL is required when authentication is enabled in production",
  );
  assert.equal(
    getAuthRuntimeConfigurationError({
      nodeEnv: "production",
      authEnabled: false,
      hasAuthSecret: false,
      devAuthMode: "bypass",
    }),
    "Development authentication modes are forbidden in production",
  );
  assert.equal(
    getAuthRuntimeConfigurationError({
      nodeEnv: "development",
      authEnabled: true,
      hasAuthSecret: false,
    }),
    "AUTH_SECRET is required when authentication is enabled",
  );
  assert.equal(
    getAuthRuntimeConfigurationError({
      nodeEnv: "production",
      authEnabled: false,
      hasAuthSecret: false,
    }),
    null,
  );
});

test("operator bootstrap rejects unsafe local execution contexts", () => {
  const safeConfiguration = {
    nodeEnv: "development",
    databaseUrl:
      "postgresql://operator:synthetic@127.0.0.1:55432/readbox_auth_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    interactive: true,
  };

  assert.equal(getOperatorEnvironmentError(safeConfiguration), null);
  assert.equal(
    getOperatorEnvironmentError({
      ...safeConfiguration,
      databaseUrl:
        "postgresql://operator:synthetic@127.0.0.1:5432/mailstack_dev",
    }),
    "A permitted local database is required",
  );
  assert.equal(
    getOperatorEnvironmentError({ ...safeConfiguration, interactive: false }),
    "An interactive local terminal is required",
  );
  assert.equal(
    getOperatorEnvironmentError({
      ...safeConfiguration,
      nodeEnv: "production",
    }),
    "Local development configuration required",
  );
  assert.equal(
    getOperatorEnvironmentError({
      ...safeConfiguration,
      databaseUrl: "postgresql://operator:synthetic@db.example.invalid/test",
    }),
    "Loopback PostgreSQL is required",
  );
});

test("forced reset enables only the newly-set synthetic password", async () => {
  const { prisma, state } = makeSyntheticPrisma(resetRequiredUser());

  assert.equal(
    await authorizeCredentials(prisma, {
      username: "synthetic.operator",
      password: "old-password-is-not-used",
    }),
    null,
  );
  assert.equal(state.passwordHashReads, 0);

  const expiredToken = await issuePasswordResetToken(prisma, BigInt(41));
  assert.notEqual(state.resetTokens[0]?.tokenHash, expiredToken);
  state.resetTokens[0]!.expiresAt = new Date(Date.now() - 1_000);
  assert.equal(
    await completePasswordReset(
      prisma,
      expiredToken,
      "synthetic-new-password-1",
      "synthetic-new-password-1",
    ),
    false,
  );

  const resetToken = await issuePasswordResetToken(prisma, BigInt(41));
  assert.equal(
    await completePasswordReset(
      prisma,
      resetToken,
      "synthetic-new-password-1",
      "synthetic-new-password-1",
    ),
    true,
  );
  assert.match(state.users[0]!.passwordHash, /^\$argon2id\$/);
  assert.equal(state.users[0]!.passwordResetRequired, false);
  assert.equal(state.resetTokens.length, 0);
  assert.equal(
    await completePasswordReset(
      prisma,
      resetToken,
      "synthetic-new-password-1",
      "synthetic-new-password-1",
    ),
    false,
  );

  const authenticated = await authorizeCredentials(prisma, {
    username: "SYNTHETIC.OPERATOR",
    password: "synthetic-new-password-1",
  });
  assert.equal(authenticated?.id, "41");
  assert.equal(authenticated?.isAdministrator, false);
  assert.equal(authenticated && "passwordHash" in authenticated, false);
  assert.equal(
    await authorizeCredentials(prisma, {
      username: "synthetic.operator",
      password: "incorrect-password",
    }),
    null,
  );
  assert.equal(
    await authorizeCredentials(prisma, {
      username: "unknown.synthetic",
      password: "incorrect-password",
    }),
    null,
  );
});

test("session registry rejects malformed, expired, and revoked sessions", async () => {
  const user = resetRequiredUser();
  user.passwordResetRequired = false;
  user.passwordHash = await hashPassword("synthetic-session-test-password");
  const { prisma, state } = makeSyntheticPrisma(user);
  const sessionId = createOpaqueToken();

  assert.equal(await getActiveAppSession(prisma, "41", "not-a-token"), null);
  assert.equal(
    await registerAppSession(
      prisma,
      "41",
      sessionId,
      new Date(Date.now() - 1_000),
    ),
    true,
  );
  assert.equal(await getActiveAppSession(prisma, "41", sessionId), null);

  const activeSessionId = createOpaqueToken();
  assert.equal(
    await registerAppSession(
      prisma,
      "41",
      activeSessionId,
      new Date(Date.now() + 60_000),
    ),
    true,
  );
  assert.equal(
    (await getActiveAppSession(prisma, "41", activeSessionId))?.isAdministrator,
    false,
  );
  state.administratorProfiles.push({
    id: BigInt(1),
    userId: user.id,
    isSuperuser: true,
  });
  assert.equal(
    (await getActiveAppSession(prisma, "41", activeSessionId))?.isSuperuser,
    true,
  );
  state.administratorProfiles = [];
  assert.equal(
    (await getActiveAppSession(prisma, "41", activeSessionId))?.isAdministrator,
    false,
  );
  await revokeAppSession(prisma, activeSessionId);
  assert.equal(await getActiveAppSession(prisma, "41", activeSessionId), null);
});

test("login failures are temporarily rate limited", async () => {
  const user = resetRequiredUser();
  user.passwordResetRequired = false;
  user.passwordHash = await hashPassword("synthetic-rate-limit-password");
  const { prisma, state } = makeSyntheticPrisma(user);

  for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
    assert.equal(
      await authorizeCredentials(prisma, {
        username: user.username,
        password: "synthetic-wrong-password",
      }),
      null,
    );
  }
  assert.equal(state.attempts.length, LOGIN_FAILURE_LIMIT);
  assert.equal(
    await authorizeCredentials(prisma, {
      username: user.username,
      password: "synthetic-rate-limit-password",
    }),
    null,
  );
  assert.equal(state.attempts.length, LOGIN_FAILURE_LIMIT);
});

test("login lockout is isolated per client IP, prunes stale attempts, clears failures, and updates lastLogin", async () => {
  const user = resetRequiredUser();
  user.passwordResetRequired = false;
  user.passwordHash = await hashPassword("synthetic-ip-lockout-password");
  const { prisma, state } = makeSyntheticPrisma(user);

  const now = new Date("2026-11-15T12:00:00.000Z");
  state.attempts.push({
    usernameNormalized: "stale.user",
    ipAddress: "198.51.100.9",
    succeeded: false,
    createdAt: new Date(now.getTime() - 9 * 15 * 60 * 1000),
  });

  for (let i = 0; i < 3; i += 1) {
    assert.equal(
      await authorizeCredentials(
        prisma,
        { username: user.username, password: "wrong-password" },
        {
          clientIp: "198.51.100.10",
          failureLimit: 3,
          failureWindowMs: 60_000,
          lockoutMs: 120_000,
          now,
        },
      ),
      null,
    );
  }

  assert.equal(
    state.attempts.some((attempt) => attempt.usernameNormalized === "stale.user"),
    false,
  );

  // Blocked on the offending IP within lockout window
  assert.equal(
    await authorizeCredentials(
      prisma,
      { username: user.username, password: "synthetic-ip-lockout-password" },
      {
        clientIp: "198.51.100.10",
        failureLimit: 3,
        failureWindowMs: 60_000,
        lockoutMs: 120_000,
        now: new Date(now.getTime() + 30_000),
      },
    ),
    null,
  );

  // Still blocked at +90s when lockoutMs (120s) > failureWindowMs (60s)
  assert.equal(
    await authorizeCredentials(
      prisma,
      { username: user.username, password: "synthetic-ip-lockout-password" },
      {
        clientIp: "198.51.100.10",
        failureLimit: 3,
        failureWindowMs: 60_000,
        lockoutMs: 120_000,
        now: new Date(now.getTime() + 90_000),
      },
    ),
    null,
  );

  // Allowed on a different client IP, clears failures for that IP, and updates lastLogin
  const loginTime = new Date(now.getTime() + 91_000);
  const authenticatedFromCleanIp = await authorizeCredentials(
    prisma,
    { username: user.username, password: "synthetic-ip-lockout-password" },
    {
      clientIp: "203.0.113.20",
      failureLimit: 3,
      failureWindowMs: 60_000,
      lockoutMs: 120_000,
      now: loginTime,
    },
  );
  assert.equal(authenticatedFromCleanIp?.id, user.id.toString());
  assert.equal(state.users[0]!.lastLogin?.getTime(), loginTime.getTime());

  // Original offending IP unlocks strictly after lockout window elapses and clears prior failures
  const afterLockout = new Date(now.getTime() + 120_001);
  const unlocked = await authorizeCredentials(
    prisma,
    { username: user.username, password: "synthetic-ip-lockout-password" },
    {
      clientIp: "198.51.100.10",
      failureLimit: 3,
      failureWindowMs: 60_000,
      lockoutMs: 120_000,
      now: afterLockout,
    },
  );
  assert.equal(unlocked?.id, user.id.toString());
  assert.equal(
    state.attempts.filter(
      (attempt) =>
        attempt.ipAddress === "198.51.100.10" && !attempt.succeeded,
    ).length,
    0,
  );
});

test("initial bootstrap creates only one reset-required synthetic admin", async () => {
  const { prisma, state } = makeSyntheticPrisma();
  const input = {
    username: "synthetic.initial-admin",
    firstName: "Synthetic",
    lastName: "Admin",
    email: "synthetic-admin@example.invalid",
  };

  const created = await bootstrapInitialAccount(prisma, input);
  assert.ok(created);
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0]!.passwordResetRequired, true);
  assert.equal(state.users[0]!.isStaff, false);
  assert.equal(state.users[0]!.isSuperuser, false);
  assert.deepEqual(state.administratorProfiles, [
    { id: BigInt(1), userId: state.users[0]!.id, isSuperuser: true },
  ]);
  assert.equal(
    state.resetTokens[0]?.tokenHash,
    hashOpaqueToken(created.resetToken),
  );
  assert.equal(
    await bootstrapInitialAccount(prisma, {
      ...input,
      username: "synthetic.second-admin",
    }),
    null,
  );
});

test("initial bootstrap rejects invalid input before creating any records", async () => {
  const { prisma, state } = makeSyntheticPrisma();

  await assert.rejects(
    bootstrapInitialAccount(prisma, {
      username: "   ",
      firstName: "Synthetic",
      lastName: "Invalid",
      email: "synthetic-invalid@example.invalid",
    }),
    { message: "Invalid initial account details" },
  );
  assert.equal(state.users.length, 0);
  assert.equal(state.administratorProfiles.length, 0);
  assert.equal(state.resetTokens.length, 0);
});

test("legacy User role flags do not grant admin; profile membership does", async () => {
  const user = resetRequiredUser();
  user.passwordResetRequired = false;
  user.passwordHash = await hashPassword("synthetic-profile-admin-password");
  const { prisma, state } = makeSyntheticPrisma(user);

  const legacyFlagsOnly = await authorizeCredentials(prisma, {
    username: user.username,
    password: "synthetic-profile-admin-password",
  });
  assert.equal(legacyFlagsOnly?.isAdministrator, false);
  assert.equal(legacyFlagsOnly?.isSuperuser, false);

  state.administratorProfiles.push({
    id: BigInt(1),
    userId: user.id,
    isSuperuser: false,
  });
  const profileAdmin = await authorizeCredentials(prisma, {
    username: user.username,
    password: "synthetic-profile-admin-password",
  });
  assert.equal(profileAdmin?.isAdministrator, true);
  assert.equal(profileAdmin?.isSuperuser, false);
});
