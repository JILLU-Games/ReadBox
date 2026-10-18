import { env } from "@/config/env";
import { getPrismaClient } from "@/core/database/client";
import "server-only";

export async function getReadinessSnapshot() {
  let databaseConnection = "unavailable";

  if (env.databaseUrl) {
    try {
      await getPrismaClient().$queryRaw`SELECT 1`;
      databaseConnection = "reachable";
    } catch {
      databaseConnection = "unavailable";
    }
  }

  const ready = databaseConnection === "reachable";

  return {
    status: ready ? ("ready" as const) : ("not_ready" as const),
    checks: {
      configuration: { ok: true },
      database: {
        configured: Boolean(env.databaseUrl),
        connection: databaseConnection,
      },
      mailServices: { connected: false },
    },
  };
}
