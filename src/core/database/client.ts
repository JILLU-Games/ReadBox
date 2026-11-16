import { env } from "@/config/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "server-only";

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
    upsert: async (d?: { create?: Record<string, unknown>; update?: Record<string, unknown> }) => ({
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

export function getPrismaClient(): PrismaClient {
  if (!env.databaseUrl) {
    console.warn("[AI Studio] Database not connected — using mock");
    return createMockPrismaClient();
  }

  if (!globalForPrisma.mailstackPrisma) {
    try {
      const adapter = new PrismaPg({ connectionString: env.databaseUrl });
      globalForPrisma.mailstackPrisma = new PrismaClient({ adapter });
    } catch {
      console.warn("[AI Studio] Database not connected — using mock");
      return createMockPrismaClient();
    }
  }

  return globalForPrisma.mailstackPrisma;
}
