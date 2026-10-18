import { authorizeCredentials } from "@/core/auth/credentials";
import { bootstrapInitialAccount } from "@/core/auth/operator-bootstrap";
import { completePasswordReset } from "@/core/auth/password-reset";
import {
  getActiveAppSession,
  registerAppSession,
  revokeAppSession,
} from "@/core/auth/session-registry";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

function isolatedTestDatabaseUrl(): string | null {
  const value = process.env.AUTH_TEST_DATABASE_URL;
  if (!value) return null;

  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !databaseName.startsWith("readbox_auth_test_")
  ) {
    throw new Error(
      "AUTH_TEST_DATABASE_URL must target an isolated loopback test database",
    );
  }

  return value;
}

const testDatabaseUrl = isolatedTestDatabaseUrl();

test(
  "local database supports bootstrap, reset, credentials, and immediate revocation",
  { skip: !testDatabaseUrl },
  async () => {
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
    });
    const uniqueUsername = `synthetic-auth-${randomBytes(8).toString("hex")}`;
    const originalPassword = `synthetic-${randomBytes(24).toString("base64url")}`;
    const newPassword = `synthetic-${randomBytes(24).toString("base64url")}`;
    let createdUserId: bigint | undefined;

    try {
      assert.equal(
        await client.user.count(),
        0,
        "test database must start empty",
      );
      const bootstrap = await bootstrapInitialAccount(client, {
        username: uniqueUsername,
        firstName: "Synthetic",
        lastName: "Account",
        email: `${uniqueUsername}@example.invalid`,
      });
      assert.ok(bootstrap);
      createdUserId = BigInt(bootstrap.userId);

      assert.equal(
        await authorizeCredentials(client, {
          username: uniqueUsername,
          password: originalPassword,
        }),
        null,
      );
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

      const identity = await authorizeCredentials(client, {
        username: uniqueUsername,
        password: newPassword,
      });
      assert.equal(identity?.id, bootstrap.userId);
      assert.equal(identity && "passwordHash" in identity, false);

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
      assert.ok(await getActiveAppSession(client, bootstrap.userId, sessionId));
      await revokeAppSession(client, sessionId);
      assert.equal(
        await getActiveAppSession(client, bootstrap.userId, sessionId),
        null,
      );
    } finally {
      if (createdUserId !== undefined) {
        await client.user.deleteMany({ where: { id: createdUserId } });
      }
      await client.loginAttempt.deleteMany({
        where: { usernameNormalized: uniqueUsername.toLowerCase() },
      });
      await client.$disconnect();
    }
  },
);
