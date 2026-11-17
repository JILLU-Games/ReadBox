import { env } from "@/config/env";
import type { ReadBoxEnv } from "@/config/env-schema";
import { getPrismaClient } from "@/core/database/client";
import {
  createPrismaSqlExecutor,
  verifyMailserverMigrationParity,
  type PrismaRawQueryable,
} from "@/core/mailserver/pg-adapter";
import { randomBytes } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import "server-only";

export interface ReadinessProbePrismaLike {
  $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  readonly $queryRawUnsafe?: PrismaRawQueryable["$queryRawUnsafe"];
  readonly $executeRawUnsafe?: PrismaRawQueryable["$executeRawUnsafe"];
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
    const st = lstatSync(directoryPath);
    if (!st.isDirectory() || st.isSymbolicLink()) {
      return { ok: false };
    }
    // A writeable but unreadable Maildir is not operationally healthy.
    readdirSync(directoryPath);
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

// R-02 closure: do not permit a truncated migration bundle to appear healthy.
// Read all checked-in migration directories so future schema additions are included.
const REQUIRED_PRISMA_MIGRATIONS = [
  "20261017000000_initial_application_schema",
  "20261017190000_local_auth_reset",
  "20261018120000_administrator_profiles",
  "20261115000000_mailserver_schema_and_roles",
  "20261116000000_phase1_admin_reset_and_security",
  "20261116010000_phase2_user_access_policy_inheritance",
  "20261117010000_postfix_login_identity",
] as const;

export function getExpectedPrismaMigrationNames(
  migrationRoot = resolve(process.cwd(), "prisma", "migrations"),
): string[] {
  const rootStat = lstatSync(migrationRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Prisma migration manifest is unavailable.");
  }
  const names = readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (
    names.length < REQUIRED_PRISMA_MIGRATIONS.length ||
    REQUIRED_PRISMA_MIGRATIONS.some((name) => !names.includes(name))
  ) {
    throw new Error("Prisma migration manifest is incomplete.");
  }
  for (const name of names) {
    if (!/^\d{14}_[a-z0-9_]+$/.test(name)) {
      throw new Error("Prisma migration manifest contains an invalid entry.");
    }
    const migrationStat = lstatSync(join(migrationRoot, name, "migration.sql"));
    if (!migrationStat.isFile() || migrationStat.isSymbolicLink()) {
      throw new Error("Prisma migration SQL is missing or unsafe.");
    }
  }
  return names;
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

  let client: ReadinessProbePrismaLike | null = null;
  if (options?.prisma !== undefined) {
    client = options.prisma;
  } else if (runtimeEnv.databaseUrl) {
    try {
      client = getPrismaClient() as unknown as ReadinessProbePrismaLike;
    } catch {
      client = null;
    }
  }

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
        if (
          typeof client.$queryRawUnsafe !== "function" ||
          typeof client.$executeRawUnsafe !== "function"
        ) {
          throw new Error("Prisma migration query interface is unavailable.");
        }
        const expectedMigrations = getExpectedPrismaMigrationNames();
        const parity = await verifyMailserverMigrationParity(
          createPrismaSqlExecutor(client as PrismaRawQueryable),
          expectedMigrations,
        );
        migrationsOk = pendingCount === 0 && parity.ok;
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
              Number.isFinite(ageSeconds) &&
              ageSeconds >= 0 &&
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
  const ingestionDegradedOrStale =
    ingestionStatus === "stale" ||
    ingestionStatus === "degraded" ||
    ingestionStatus === "unavailable";
  // In production the worker is mandatory, even if an old Compose env value
  // still sets REQUIRE_INGESTION_READY=false. Development policy is retained.
  const requiresWorker =
    runtimeEnv.nodeEnv === "production" || runtimeEnv.requireIngestionReady;
  const ingestionGateOk = requiresWorker
    ? mailServicesConnected
    : !ingestionDegradedOrStale;

  const ready =
    configuration.ok &&
    databaseOk &&
    migrationsOk &&
    mailStorage.ok &&
    attachmentStorage.ok &&
    ingestionGateOk;

  return {
    status: ready ? ("ready" as const) : ("not_ready" as const),
    scope: "application" as const,
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
        required: requiresWorker,
      },
      // This route checks the ReadBox app/ingestion; it never asserts that
      // external SMTP/MX/PTR or Dovecot LMTP are actually accepting mail.
      mailTransport: { verified: false, status: "not_checked" as const },
    },
  };
}
