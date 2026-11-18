import { parseEnvironment } from "@/config/env-schema";
import {
  getExpectedPrismaMigrationNames,
  getReadinessSnapshot,
  type ReadinessProbePrismaLike,
} from "@/core/health/snapshot";
import assert from "node:assert/strict";
import {
  mkdtempSync, rmSync, mkdirSync, symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const completed = getExpectedPrismaMigrationNames().map((migration_name) => ({
  migration_name, finished_at: new Date(), rolled_back_at: null,
}));

test("R04 production app readiness rejects missing/stale/future/degraded worker, failing DB/storage and recovers", async () => {
  const temp = mkdtempSync(join(tmpdir(), "readbox-r04-health-"));
  const mail = join(temp, "mail");
  const attachments = join(temp, "attachments");
  mkdirSync(mail);
  mkdirSync(attachments);
  try {
    const runtimeEnv = parseEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://readbox:ci-only@127.0.0.1:5432/readbox",
      AUTH_ENABLED: "true",
      AUTH_SECRET: "x".repeat(48),
      MAIL_DOMAIN: "r04.example.test",
      MAIL_HOSTNAME: "mail.r04.example.test",
      APP_HOSTNAME: "app.r04.example.test",
      SERVER_IP: "203.0.113.9",
      MAIL_STORAGE_ROOT: mail,
      ATTACHMENT_STORAGE_ROOT: attachments,
      REQUIRE_INGESTION_READY: "false",
      INGESTION_STALE_AFTER_SECONDS: "120",
    });
    const now = new Date("2026-11-17T14:00:00.000Z");
    const mock = (
      status: string | null,
      lastSeenAt = now,
      dbFails = false,
      heartbeatFails = false,
    ): ReadinessProbePrismaLike => ({
      async $queryRaw<T = unknown>(strings: TemplateStringsArray): Promise<T> {
        if (dbFails) throw new Error("db secret should not leak");
        return (strings.join(" ").includes("_prisma_migrations")
          ? [{ pending_count: BigInt(0) }]
          : [{ "?column?": 1 }]) as T;
      },
      async $queryRawUnsafe<T = unknown>(): Promise<T> {
        return completed as T;
      },
      async $executeRawUnsafe(): Promise<number> {
        return 0;
      },
      serviceHeartbeat: {
        async findUnique() {
          if (heartbeatFails) throw new Error("private heartbeat DB failure");
          return status === null ? null : { status, lastSeenAt };
        },
      },
    });
    const probe = async (
      client: ReadinessProbePrismaLike,
      envOverride = runtimeEnv,
    ) => getReadinessSnapshot({ prisma: client, runtimeEnv: envOverride, now });

    const good = await probe(mock("healthy"));
    assert.equal(good.status, "ready");
    assert.equal(good.scope, "application");
    assert.equal(good.checks.mailTransport.verified, false);
    assert.equal(good.checks.mailTransport.status, "not_checked");
    assert.equal(good.checks.mailServices.required, true);
    const missing = await probe(mock(null));
    assert.equal(missing.status, "not_ready");
    assert.equal(missing.checks.mailServices.ingestionStatus, "unknown");
    const stale = await probe(mock("healthy", new Date(now.getTime() - 121000)));
    assert.equal(stale.status, "not_ready");
    assert.equal(stale.checks.mailServices.ingestionStatus, "stale");
    const future = await probe(mock("healthy", new Date(now.getTime() + 60000)));
    assert.equal(future.status, "not_ready");
    const degraded = await probe(mock("degraded"));
    assert.equal(degraded.status, "not_ready");
    const running = await probe(mock("running"));
    assert.equal(running.status, "not_ready");
    const unreadableHeartbeat = await probe(mock("healthy", now, false, true));
    assert.equal(unreadableHeartbeat.status, "not_ready");
    assert.equal(unreadableHeartbeat.checks.mailServices.ingestionStatus, "unavailable");
    const down = await probe(mock("healthy", now, true));
    assert.equal(down.status, "not_ready");
    assert.equal(down.checks.database.ok, false);
    assert.equal(JSON.stringify(down).includes("db secret"), false);
    rmSync(mail, { recursive: true, force: true });
    const noMail = await probe(mock("healthy"));
    assert.equal(noMail.status, "not_ready");
    assert.equal(noMail.checks.mailStorage.ok, false);
    symlinkSync(attachments, mail, "dir");
    const unsafe = await probe(mock("healthy"));
    assert.equal(unsafe.status, "not_ready");
    assert.equal(unsafe.checks.mailStorage.ok, false);
    rmSync(mail);
    mkdirSync(mail);
    const recovered = await probe(mock("healthy"));
    assert.equal(recovered.status, "ready");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
