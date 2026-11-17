import { recordWorkerDegradedHeartbeat } from "@/workers/ingestion";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("R04 failed ingestion marks heartbeat degraded without leaking original error", async () => {
  const updates: unknown[] = [];
  await recordWorkerDegradedHeartbeat(
    "initial_ingestion_pass_failed",
    { errorType: "DatabaseUnavailableError" },
    {
      serviceHeartbeat: {
        async upsert(args) {
          updates.push(args);
          return {};
        },
      },
    },
  );
  assert.equal(updates.length, 1);
  const update = updates[0] as {
    where: { serviceName: string };
    create: { status: string; details: { reason: string } };
  };
  assert.equal(update.where.serviceName, "maildir_ingestion");
  assert.equal(update.create.status, "degraded");
  assert.equal(update.create.details.reason, "initial_ingestion_pass_failed");
});

test("R04 worker Compose health gates app readiness, while web retains liveness to avoid cycle", () => {
  const compose = readFileSync("docker-compose.yml", "utf8");
  const webHealth = compose.split("  web:\n")[1]?.split("\n  worker:\n")[0];
  const workerHealth = compose.split("  worker:\n")[1]?.split("\n  # R-03")[0];
  assert.ok(webHealth?.includes("http://127.0.0.1:3000/health/live"));
  assert.ok(workerHealth?.includes("http://web:3000/health/ready"));
  assert.ok(workerHealth?.includes("scripts/mail/ingest.ts"));
  assert.ok(!webHealth?.includes("http://127.0.0.1:3000/health/ready"));
});
