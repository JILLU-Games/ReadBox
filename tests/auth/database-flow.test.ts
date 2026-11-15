import { authorizeCredentials } from "@/core/auth/credentials";
import { bootstrapInitialAccount } from "@/core/auth/operator-bootstrap";
import { hashPassword } from "@/core/auth/password";
import { completePasswordReset } from "@/core/auth/password-reset";
import {
  getActiveAppSession,
  registerAppSession,
  revokeAppSession,
} from "@/core/auth/session-registry";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { verifyAuthTestTarget } from "../../scripts/testing/postgres-target";

loadEnv({ path: ".env.test.local" });
let client: PrismaClient;
const createdUserIds: bigint[] = [];
const testedUsernames: string[] = [];

before(async () => {
  const testTarget = await verifyAuthTestTarget();
  client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testTarget.connectionString }),
  });
});

after(async () => {
  if (!client) return;
  if (createdUserIds.length > 0) {
    await client.user.deleteMany({ where: { id: { in: createdUserIds } } });
    const remainingProfiles = await client.administratorProfile.count({
      where: { userId: { in: createdUserIds } },
    });
    assert.equal(remainingProfiles, 0);
  }
  if (testedUsernames.length > 0) {
    await client.loginAttempt.deleteMany({
      where: { usernameNormalized: { in: testedUsernames } },
    });
  }
  await client.$disconnect();
});

test("applied migrations create the administrator relationship and constraints", async () => {
  const migrationRows = await client.$queryRaw<
    { migration_name: string; finished_at: Date | null }[]
  >`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    WHERE migration_name IN (
      '20261017000000_initial_application_schema',
      '20261017190000_local_auth_reset',
      '20261018120000_administrator_profiles'
    )
    ORDER BY migration_name
  `;
  assert.equal(migrationRows.length, 3);
  assert.ok(migrationRows.every((row) => row.finished_at !== null));

  const indexes = await client.$queryRaw<{ indexdef: string }[]>`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'administrator_profiles'
      AND indexname = 'administrator_profiles_user_id_key'
  `;
  assert.equal(indexes.length, 1);
  assert.match(
    indexes[0]!.indexdef,
    /CREATE UNIQUE INDEX .*administrator_profiles.*\(user_id\)/,
  );

  const relations = await client.$queryRaw<
    { constraint_name: string; delete_action: string; update_action: string }[]
  >`
    SELECT conname AS constraint_name,
      confdeltype::text AS delete_action,
      confupdtype::text AS update_action
    FROM pg_constraint
    WHERE conrelid = 'public.administrator_profiles'::regclass
      AND conname = 'administrator_profiles_user_id_fkey'
  `;
  assert.deepEqual(relations, [
    {
      constraint_name: "administrator_profiles_user_id_fkey",
      delete_action: "c",
      update_action: "c",
    },
  ]);

  const sessionRelation = await client.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM pg_constraint
    WHERE conname = 'app_sessions_user_id_fkey'
      AND conrelid = 'public.app_sessions'::regclass
  `;
  assert.equal(sessionRelation[0]?.count, BigInt(1));
});

test("bootstrap rolls back the canonical user if profile creation fails", async () => {
  const suffix = randomBytes(6).toString("hex");
  const functionName = `readbox_test_fail_profile_${suffix}`;
  const triggerName = `readbox_test_fail_profile_${suffix}`;

  assert.equal(await client.user.count(), 0);
  await client.$executeRawUnsafe(`
    CREATE FUNCTION public."${functionName}"()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'synthetic administrator-profile failure';
    END;
    $$
  `);
  await client.$executeRawUnsafe(`
    CREATE TRIGGER "${triggerName}"
    BEFORE INSERT ON public.administrator_profiles
    FOR EACH ROW EXECUTE FUNCTION public."${functionName}"()
  `);

  try {
    await assert.rejects(
      bootstrapInitialAccount(client, {
        username: `synthetic-rollback-${suffix}`,
        firstName: "Synthetic",
        lastName: "Rollback",
        email: `synthetic-rollback-${suffix}@example.invalid`,
      }),
    );
  } finally {
    await client.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON public.administrator_profiles`,
    );
    await client.$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS public."${functionName}"()`,
    );
  }

  assert.equal(await client.user.count(), 0);
  assert.equal(await client.passwordResetToken.count(), 0);
});

test("bootstrap serializes concurrent creation and preserves profile authorization", async () => {
  const firstUsername = `synthetic-auth-${randomBytes(8).toString("hex")}`;
  const secondUsername = `synthetic-auth-${randomBytes(8).toString("hex")}`;
  testedUsernames.push(firstUsername, secondUsername);

  assert.equal(await client.user.count(), 0);
  const results = await Promise.all([
    bootstrapInitialAccount(client, {
      username: firstUsername,
      firstName: "Synthetic",
      lastName: "Account",
      email: `${firstUsername}@example.invalid`,
    }),
    bootstrapInitialAccount(client, {
      username: secondUsername,
      firstName: "Synthetic",
      lastName: "Account",
      email: `${secondUsername}@example.invalid`,
    }),
  ]);
  const bootstraps = results.filter((result) => result !== null);
  assert.equal(bootstraps.length, 1);
  assert.equal(results.filter((result) => result === null).length, 1);

  const bootstrap = bootstraps[0]!;
  const createdUserId = BigInt(bootstrap.userId);
  createdUserIds.push(createdUserId);
  const user = await client.user.findUniqueOrThrow({
    where: { id: createdUserId },
    select: { username: true },
  });
  testedUsernames.push(user.username.toLowerCase());

  assert.equal(
    await client.administratorProfile.count({
      where: { userId: createdUserId },
    }),
    1,
  );
  await assert.rejects(
    client.administratorProfile.create({
      data: { userId: createdUserId },
    }),
  );
  await assert.rejects(
    client.administratorProfile.create({
      data: { userId: BigInt("987654321012345678") },
    }),
  );

  const resetTokenRecord = await client.passwordResetToken.findUnique({
    where: { userId: createdUserId },
    select: { tokenHash: true },
  });
  assert.ok(resetTokenRecord);
  assert.notEqual(resetTokenRecord.tokenHash, bootstrap.resetToken);

  assert.equal(
    await authorizeCredentials(client, {
      username: user.username,
      password: `synthetic-unused-${randomBytes(8).toString("hex")}`,
    }),
    null,
  );
  const newPassword = `synthetic-${randomBytes(24).toString("base64url")}`;
  assert.equal(
    await completePasswordReset(
      client,
      bootstrap.resetToken,
      newPassword,
      newPassword,
    ),
    true,
  );
  assert.equal(
    await completePasswordReset(
      client,
      bootstrap.resetToken,
      newPassword,
      newPassword,
    ),
    false,
  );

  const adminIdentity = await authorizeCredentials(client, {
    username: user.username,
    password: newPassword,
  });
  assert.equal(adminIdentity?.id, bootstrap.userId);
  assert.equal(adminIdentity?.isAdministrator, true);
  assert.equal(adminIdentity?.isSuperuser, true);
  assert.equal(adminIdentity && "passwordHash" in adminIdentity, false);

  const sessionId = randomBytes(32).toString("base64url");
  assert.equal(
    await registerAppSession(
      client,
      bootstrap.userId,
      sessionId,
      new Date(Date.now() + 60_000),
    ),
    true,
  );
  assert.equal(
    (await getActiveAppSession(client, bootstrap.userId, sessionId))
      ?.isAdministrator,
    true,
  );
  await client.administratorProfile.delete({
    where: { userId: createdUserId },
  });
  const withoutProfile = await getActiveAppSession(
    client,
    bootstrap.userId,
    sessionId,
  );
  assert.equal(withoutProfile?.isAdministrator, false);
  assert.equal(withoutProfile?.isSuperuser, false);
  await revokeAppSession(client, sessionId);
  assert.equal(
    await getActiveAppSession(client, bootstrap.userId, sessionId),
    null,
  );

  const legacyUsername = `synthetic-legacy-${randomBytes(8).toString("hex")}`;
  testedUsernames.push(legacyUsername);
  const legacyPassword = `synthetic-${randomBytes(24).toString("base64url")}`;
  const legacyUser = await client.user.create({
    data: {
      username: legacyUsername,
      firstName: "Synthetic",
      lastName: "Legacy",
      email: `${legacyUsername}@example.invalid`,
      passwordHash: await hashPassword(legacyPassword),
      passwordResetRequired: false,
      isActive: true,
      isStaff: true,
      isSuperuser: true,
    },
    select: { id: true },
  });
  createdUserIds.push(legacyUser.id);
  const legacyIdentity = await authorizeCredentials(client, {
    username: legacyUsername,
    password: legacyPassword,
  });
  assert.equal(legacyIdentity?.isAdministrator, false);
  assert.equal(legacyIdentity?.isSuperuser, false);

  const legacySessionId = randomBytes(32).toString("base64url");
  assert.equal(
    await registerAppSession(
      client,
      legacyUser.id.toString(),
      legacySessionId,
      new Date(Date.now() + 60_000),
    ),
    true,
  );
  await client.user.update({
    where: { id: legacyUser.id },
    data: { isActive: false },
  });
  assert.equal(
    await getActiveAppSession(
      client,
      legacyUser.id.toString(),
      legacySessionId,
    ),
    null,
  );
  assert.equal(
    await authorizeCredentials(client, {
      username: legacyUsername,
      password: legacyPassword,
    }),
    null,
  );
  await revokeAppSession(client, legacySessionId);
});
