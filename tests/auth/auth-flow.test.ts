import { authorizeCredentials } from "@/core/auth/credentials";
import { createOpaqueToken, hashOpaqueToken } from "@/core/auth/opaque-token";
import { bootstrapInitialAccount } from "@/core/auth/operator-bootstrap";
import { hashPassword } from "@/core/auth/password";
import { LOGIN_FAILURE_LIMIT } from "@/core/auth/password-policy";
import {
  completePasswordReset,
  issuePasswordResetToken,
} from "@/core/auth/password-reset";
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
}

interface SyntheticLoginAttempt {
  usernameNormalized: string;
  ipAddress: null;
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

function makeSyntheticPrisma(initialUser?: SyntheticUser) {
  const state = {
    users: initialUser ? [initialUser] : ([] as SyntheticUser[]),
    attempts: [] as SyntheticLoginAttempt[],
    resetTokens: [] as SyntheticResetToken[],
    sessions: [] as SyntheticAppSession[],
    passwordHashReads: 0,
    nextId: initialUser ? initialUser.id + BigInt(1) : BigInt(1),
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
      data: Omit<SyntheticUser, "id">;
      select?: Record<string, boolean>;
    }) => {
      const user = { ...args.data, id: state.nextId++ };
      state.users.push(user);
      return args.select?.id ? { id: user.id } : user;
    },
    findFirst: async (args: { where: { username?: { equals?: string } } }) => {
      const username = args.where.username?.equals?.toLowerCase();
      return (
        state.users.find((user) => user.username.toLowerCase() === username) ??
        null
      );
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
    count: async (args: {
      where: {
        usernameNormalized: string;
        succeeded: false;
        createdAt: { gte: Date };
      };
    }) =>
      state.attempts.filter(
        (attempt) =>
          attempt.usernameNormalized === args.where.usernameNormalized &&
          !attempt.succeeded &&
          attempt.createdAt >= args.where.createdAt.gte,
      ).length,
    create: async (args: {
      data: Omit<SyntheticLoginAttempt, "createdAt">;
    }) => {
      const attempt = { ...args.data, createdAt: new Date() };
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
      return { ...row, user };
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
  const { prisma } = makeSyntheticPrisma(user);
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
  assert.ok(await getActiveAppSession(prisma, "41", activeSessionId));
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
  assert.equal(state.users[0]!.isSuperuser, true);
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
