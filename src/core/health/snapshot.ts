import { env } from "@/config/env";
import type { ReadBoxEnv } from "@/config/env-schema";
import { getPrismaClient } from "@/core/database/client";
import { randomBytes } from "node:crypto";
import { statSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import "server-only";

export interface ReadinessProbePrismaLike {
  $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  readonly serviceHeartbeat?: {
    findUnique(args: {
      where: { serviceName: string };
    }): Promise<{
      readonly status: string;
      readonly lastSeenAt: Date;
    } | null>;
  };
}

export async function checkWritableStorageDirectory(
  directoryPath: string,
): Promise<{ readonly ok: boolean }> {
  try {
    const st = statSync(directoryPath);
    if (!st.isDirectory()) {
      return { ok: false };
    }
    const probePath = join(
      directoryPath,
      `.readbox-healthcheck-${randomBytes(6).toString("hex")}`,
    );
    await writeFile(probePath, "ok", { encoding: "utf8", mode: 0o600 });
    await unlink(probePath);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function checkConfigurationReadiness(
  runtimeEnv: ReadBoxEnv = env,
): { readonly ok: boolean } {
  const baseComplete =
    Boolean(runtimeEnv.mailDomain?.trim()) &&
    Boolean(runtimeEnv.appHostname?.trim()) &&
    Boolean(runtimeEnv.mailHostname?.trim()) &&
    Boolean(runtimeEnv.serverIp?.trim());

  if (!baseComplete) {
    return { ok: false };
  }

  if (runtimeEnv.nodeEnv === "production") {
    const prodComplete =
      runtimeEnv.devAuthMode === "off" &&
      Boolean(runtimeEnv.databaseUrl?.trim()) &&
      (!runtimeEnv.authEnabled || Boolean(runtimeEnv.authSecret?.trim()));
    return { ok: prodComplete };
  }

  return { ok: true };
}

export async function getReadinessSnapshot(options?: {
  readonly prisma?: ReadinessProbePrismaLike | null;
  readonly runtimeEnv?: ReadBoxEnv;
  readonly now?: Date;
}) {
  const runtimeEnv = options?.runtimeEnv ?? env;
  const now = options?.now ?? new Date();
  const configuration = checkConfigurationReadiness(runtimeEnv);

  let databaseConnection: "reachable" | "unavailable" = "unavailable";
  let migrationsOk = false;
  let mailServicesConnected = false;
  let ingestionStatus = "unknown";

  const client =
    options?.prisma !== undefined
      ? options.prisma
      : runtimeEnv.databaseUrl
        ? (getPrismaClient() as unknown as ReadinessProbePrismaLike)
        : null;

  if (client && runtimeEnv.databaseUrl) {
    try {
      await client.$queryRaw`SELECT 1`;
      databaseConnection = "reachable";

      try {
        const failedRows = await client.$queryRaw<
          Array<{ pending_count: bigint | number }>
        >`
          SELECT COUNT(*)::bigint AS pending_count
          FROM "_prisma_migrations"
          WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
        `;
        const pendingCount = Number(failedRows?.[0]?.pending_count ?? 0);
        migrationsOk = pendingCount === 0;
      } catch {
        migrationsOk = false;
      }

      if (client.serviceHeartbeat) {
        try {
          const heartbeat = await client.serviceHeartbeat.findUnique({
            where: { serviceName: "maildir_ingestion" },
          });
          if (heartbeat) {
            const ageSeconds =
              (now.getTime() - heartbeat.lastSeenAt.getTime()) / 1_000;
            const isFresh =
              ageSeconds <= runtimeEnv.ingestionStaleAfterSeconds;
            ingestionStatus = isFresh ? heartbeat.status : "stale";
            mailServicesConnected =
              isFresh &&
              (heartbeat.status === "healthy" || heartbeat.status === "ok");
          }
        } catch {
          ingestionStatus = "unavailable";
        }
      }
    } catch {
      databaseConnection = "unavailable";
      migrationsOk = false;
    }
  }

  const [mailStorage, attachmentStorage] = await Promise.all([
    checkWritableStorageDirectory(runtimeEnv.mailStorageRoot),
    checkWritableStorageDirectory(runtimeEnv.attachmentStorageRoot),
  ]);

  const databaseOk = databaseConnection === "reachable";
  const ready =
    configuration.ok &&
    databaseOk &&
    migrationsOk &&
    mailStorage.ok &&
    attachmentStorage.ok;

  return {
    status: ready ? ("ready" as const) : ("not_ready" as const),
    checks: {
      configuration,
      database: {
        ok: databaseOk,
        configured: Boolean(runtimeEnv.databaseUrl),
        connection: databaseConnection,
      },
      migrations: {
        ok: migrationsOk,
      },
      mailStorage,
      attachmentStorage,
      mailServices: {
        connected: mailServicesConnected,
        ingestionStatus,
      },
    },
  };
}
