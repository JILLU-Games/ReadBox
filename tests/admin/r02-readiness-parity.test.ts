import { parseEnvironment } from "@/config/env-schema";
import {
  getExpectedPrismaMigrationNames,
  getReadinessSnapshot,
  type ReadinessProbePrismaLike,
} from "@/core/health/snapshot";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const expected = getExpectedPrismaMigrationNames();
const completedRows = expected.map((migration_name) => ({
  migration_name,
  finished_at: new Date("2026-11-17T14:00:00.000Z"),
  rolled_back_at: null,
}));

test("R-02 migration bundle contains the seven reviewed migrations", () => {
  assert.ok(expected.length >= 7);
  assert.ok(expected.includes("20261017000000_initial_application_schema"));
  assert.ok(expected.includes("20261117010000_postfix_login_identity"));
  assert.deepEqual([...expected].sort(), expected);
});

test("R-02 manifest reader rejects missing/truncated/unsafe migration bundles and includes new migrations", () => {
  const base = mkdtempSync(join(tmpdir(), "readbox-r02-migrations-"));
  try {
    assert.throws(() => getExpectedPrismaMigrationNames(join(base, "not-present")));
    const root = join(base, "prisma");
    mkdirSync(root);
    assert.throws(() => getExpectedPrismaMigrationNames(root));
    for (const name of expected) {
      const dir = join(root, name);
      mkdirSync(dir);
      writeFileSync(join(dir, "migration.sql"), "-- test fixture\n");
    }
    assert.deepEqual(getExpectedPrismaMigrationNames(root), expected);
    const future = "20261118000000_future_compatible_migration";
    mkdirSync(join(root, future));
    writeFileSync(join(root, future, "migration.sql"), "-- future fixture\n");
    assert.deepEqual(getExpectedPrismaMigrationNames(root), [...expected, future].sort());
    rmSync(join(root, expected[0], "migration.sql"));
    assert.throws(() => getExpectedPrismaMigrationNames(root));
    writeFileSync(join(root, expected[0], "migration.sql"), "-- restored\n");
    const symlinkRoot = join(base, "prisma-symlink");
    symlinkSync(root, symlinkRoot, "dir");
    assert.throws(() => getExpectedPrismaMigrationNames(symlinkRoot));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("R-02 health readiness fails closed on missing/failed migration history without changing other probes", async () => {
  const mailRoot = mkdtempSync(join(tmpdir(), "readbox-r02-health-mail-"));
  const attachmentRoot = mkdtempSync(join(tmpdir(), "readbox-r02-health-attachments-"));
  try {
    const runtimeEnv = parseEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://readbox:integration-test@127.0.0.1:5432/readbox",
      AUTH_ENABLED: "true",
      AUTH_SECRET: "not-a-real-secret-0123456789abcdefghijkl",
      MAIL_DOMAIN: "r02.example.test",
      MAIL_HOSTNAME: "mail.r02.example.test",
      APP_HOSTNAME: "app.r02.example.test",
      SERVER_IP: "203.0.113.8",
      MAIL_STORAGE_ROOT: mailRoot,
      ATTACHMENT_STORAGE_ROOT: attachmentRoot,
    });

    const client = (
      rows: readonly unknown[] = completedRows,
      failedCount = 0,
      failLookup = false,
    ) => ({
      async $queryRaw<T = unknown>(strings: TemplateStringsArray): Promise<T> {
        return (strings.join(" ").includes("_prisma_migrations")
          ? [{ pending_count: BigInt(failedCount) }]
          : [{ "?column?": 1 }]) as T;
      },
      async $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T> {
        assert.match(sql, /"public"\."_prisma_migrations"/);
        assert.deepEqual(params[0], expected);
        if (failLookup) throw new Error("No migration table / connection lost");
        return rows as T;
      },
      async $executeRawUnsafe() {
        return 0;
      },
    });

    const probe = async (prisma: ReadinessProbePrismaLike) =>
      getReadinessSnapshot({ runtimeEnv, prisma });

    const complete = await probe(client());
    assert.equal(complete.status, "ready");
    assert.equal(complete.checks.migrations.ok, true);
    assert.equal(complete.checks.database.ok, true);
    assert.equal(complete.checks.mailStorage.ok, true);

    const missing = await probe(client(completedRows.slice(0, -1)));
    assert.equal(missing.status, "not_ready");
    assert.equal(missing.checks.migrations.ok, false);
    assert.equal(missing.checks.database.ok, true);

    const unfinished = await probe(client([
      ...completedRows.slice(0, -1),
      { ...completedRows.at(-1)!, finished_at: null },
    ]));
    assert.equal(unfinished.status, "not_ready");
    assert.equal(unfinished.checks.migrations.ok, false);

    const pendingFailed = await probe(client(completedRows, 1));
    assert.equal(pendingFailed.status, "not_ready");
    assert.equal(pendingFailed.checks.migrations.ok, false);

    const inaccessible = await probe(client(completedRows, 0, true));
    assert.equal(inaccessible.status, "not_ready");
    assert.equal(inaccessible.checks.migrations.ok, false);

    const unsupported = await probe({ $queryRaw: client().$queryRaw });
    assert.equal(unsupported.status, "not_ready");
    assert.equal(unsupported.checks.migrations.ok, false);
  } finally {
    rmSync(mailRoot, { recursive: true, force: true });
    rmSync(attachmentRoot, { recursive: true, force: true });
  }
});
