import { env } from "@/config/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "server-only";

const globalForPrisma = globalThis as typeof globalThis & {
  mailstackPrisma?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalForPrisma.mailstackPrisma) {
    const adapter = new PrismaPg({ connectionString: env.databaseUrl });
    globalForPrisma.mailstackPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.mailstackPrisma;
}
