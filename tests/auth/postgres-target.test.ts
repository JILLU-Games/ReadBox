import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertDisposablePostgresContainer,
  parseAuthTestTarget,
  type PostgresContainerEvidence,
} from "../../scripts/testing/postgres-target";

const databaseName = `readbox_auth_test_${"a".repeat(32)}`;
const databasePassword =
  "synthetic-test-password-0123456789-abcdefghijklmnopqrstuvwxyz";
const baseEnvironment = {
  AUTH_TEST_DATABASE_NAME: databaseName,
  AUTH_TEST_POSTGRES_PASSWORD: databasePassword,
  AUTH_TEST_DATABASE_URL: `postgresql://readbox_test:${databasePassword}@127.0.0.1:55432/${databaseName}?schema=public`,
};

function validEvidence(): PostgresContainerEvidence {
  return {
    id: "a".repeat(64),
    running: true,
    image: "postgres:16.14-alpine",
    integrationLabel: "ephemeral-postgres",
    project: "readbox-auth-test",
    service: "postgres-test",
    workingDirectory: process.cwd(),
    configFiles: [join(process.cwd(), "compose.yaml")],
    configuredDatabase: databaseName,
    configuredUser: "readbox_test",
    passwordMatches: true,
    expectedDatabase: databaseName,
    portBindings: {
      "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55432" }],
    },
    tmpfs: { "/var/lib/postgresql/data": "rw,noexec,nosuid,size=512m" },
    mounts: [{ Type: "tmpfs", Destination: "/var/lib/postgresql/data" }],
  };
}

test("requires explicit test-only variables and never falls back to DATABASE_URL", () => {
  assert.throws(
    () =>
      parseAuthTestTarget({
        DATABASE_URL: baseEnvironment.AUTH_TEST_DATABASE_URL,
      }),
    /set AUTH_TEST_DATABASE_URL/,
  );
});

test("accepts only a unique explicit loopback PostgreSQL test URL", () => {
  assert.deepEqual(parseAuthTestTarget(baseEnvironment), {
    connectionString: baseEnvironment.AUTH_TEST_DATABASE_URL,
    databaseName,
  });
});

test("rejects development, production, wrong-host, and wrong-port targets", () => {
  assert.throws(
    () =>
      parseAuthTestTarget({
        ...baseEnvironment,
        AUTH_TEST_DATABASE_NAME: "mailstack_dev",
        AUTH_TEST_DATABASE_URL:
          "postgresql://readbox_test:secret@127.0.0.1:55432/mailstack_dev",
      }),
    /configuration does not match/,
  );
  assert.throws(
    () => parseAuthTestTarget({ ...baseEnvironment, NODE_ENV: "production" }),
    /NODE_ENV=production/,
  );
  assert.throws(
    () =>
      parseAuthTestTarget({
        ...baseEnvironment,
        AUTH_TEST_DATABASE_URL: baseEnvironment.AUTH_TEST_DATABASE_URL.replace(
          "127.0.0.1",
          "db.example.invalid",
        ),
      }),
    /configuration does not match/,
  );
  assert.throws(
    () =>
      parseAuthTestTarget({
        ...baseEnvironment,
        AUTH_TEST_DATABASE_URL: baseEnvironment.AUTH_TEST_DATABASE_URL.replace(
          "55432",
          "5432",
        ),
      }),
    /configuration does not match/,
  );
});

test("rejects reusing the ordinary database endpoint and mismatched secrets", () => {
  assert.throws(
    () =>
      parseAuthTestTarget({
        ...baseEnvironment,
        DATABASE_URL: baseEnvironment.AUTH_TEST_DATABASE_URL,
      }),
    /differ from DATABASE_URL/,
  );
  assert.throws(
    () =>
      parseAuthTestTarget({
        ...baseEnvironment,
        AUTH_TEST_POSTGRES_PASSWORD: "different-secret",
      }),
    (error: Error) => {
      assert.doesNotMatch(
        error.message,
        /different-secret|synthetic-test-password/,
      );
      return true;
    },
  );
});

test("requires a long URL-safe test-only password", () => {
  assert.throws(
    () =>
      parseAuthTestTarget({
        ...baseEnvironment,
        AUTH_TEST_POSTGRES_PASSWORD: "too-short",
      }),
    /at least 32 URL-safe characters/,
  );
  assert.throws(
    () =>
      parseAuthTestTarget({
        ...baseEnvironment,
        AUTH_TEST_POSTGRES_PASSWORD: "!".repeat(40),
      }),
    /at least 32 URL-safe characters/,
  );
});

test("accepts only the expected ephemeral Compose PostgreSQL container", () => {
  assert.doesNotThrow(() => assertDisposablePostgresContainer(validEvidence()));
  assert.throws(
    () =>
      assertDisposablePostgresContainer({
        ...validEvidence(),
        mounts: [{ Type: "volume", Destination: "/var/lib/postgresql/data" }],
      }),
    /ephemeral Compose service/,
  );
  assert.throws(
    () =>
      assertDisposablePostgresContainer({
        ...validEvidence(),
        configFiles: [
          ...validEvidence().configFiles,
          join(process.cwd(), "compose.override.yaml"),
        ],
      }),
    /ephemeral Compose service/,
  );
  assert.throws(
    () =>
      assertDisposablePostgresContainer({
        ...validEvidence(),
        portBindings: {
          "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "55432" }],
        },
      }),
    /ephemeral Compose service/,
  );
});
