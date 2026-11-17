import { env } from "@/config/env";
import type { ReadBoxEnv } from "@/config/env-schema";
import { logger } from "@/core/server/logger";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "server-only";

export class DatabaseConfigurationError extends Error {
  constructor(message = "PostgreSQL DATABASE_URL is not configured.") {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export class DatabaseUnavailableError extends Error {
  constructor(message = "PostgreSQL database client could not be initialized.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

const globalForPrisma = globalThis as typeof globalThis & {
  mailstackPrisma?: PrismaClient;
};

function createMockPrismaClient(): PrismaClient {
  const noOpModel = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
    create: async (d?: { data?: Record<string, unknown> }) => d?.data ?? {},
    update: async (d?: { data?: Record<string, unknown> }) => d?.data ?? {},
    upsert: async (d?: {
      create?: Record<string, unknown>;
      update?: Record<string, unknown>;
    }) => ({
      id: BigInt(1),
      updatedAt: new Date(),
      ...(d?.create ?? d?.update ?? {}),
    }),
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
  };

  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (prop === "$queryRaw") return async () => [];
      if (prop === "$executeRaw") return async () => 0;
      if (prop === "$disconnect") return async () => undefined;
      if (prop === "$transaction") {
        return async (
          fn: ((tx: PrismaClient) => Promise<unknown>) | unknown[],
        ) => (typeof fn === "function" ? fn(createMockPrismaClient()) : []);
      }
      return noOpModel;
    },
  });
}

function defaultBuildPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export function resolvePrismaClient(
  runtimeEnv: Pick<ReadBoxEnv, "nodeEnv" | "databaseUrl"> = env,
  options?: {
    readonly buildClient?: (connectionString: string) => PrismaClient;
    readonly useGlobalCache?: boolean;
  },
): PrismaClient {
  const isProduction = runtimeEnv.nodeEnv === "production";
  const useCache =
    options?.useGlobalCache ??
    (runtimeEnv === env && options?.buildClient === undefined);
  const buildClient = options?.buildClient ?? defaultBuildPrismaClient;

  if (!runtimeEnv.databaseUrl) {
    if (isProduction) {
      logger.error("database_configuration_missing_in_production");
      throw new DatabaseConfigurationError(
        "DATABASE_URL must be configured when running in production.",
      );
    }
    console.warn("[AI Studio] Database not connected — using mock");
    return createMockPrismaClient();
  }

  if (useCache && globalForPrisma.mailstackPrisma) {
    return globalForPrisma.mailstackPrisma;
  }

  try {
    const client = buildClient(runtimeEnv.databaseUrl);
    if (useCache) {
      globalForPrisma.mailstackPrisma = client;
    }
    return client;
  } catch (error) {
    if (isProduction) {
      logger.error("database_client_init_failed", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      throw new DatabaseUnavailableError(
        "Could not initialize PostgreSQL connection in production.",
      );
    }
    console.warn("[AI Studio] Database not connected — using mock");
    return createMockPrismaClient();
  }
}

export function getPrismaClient(): PrismaClient {
  return resolvePrismaClient(env);
}
