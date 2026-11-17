import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const localDevelopmentUrl =
  "postgresql://mailstack:local-development-only@127.0.0.1:5432/mailstack_dev?schema=public";
const datasourceUrl = process.env.DATABASE_URL ?? localDevelopmentUrl;
const parsedDatasourceUrl = new URL(datasourceUrl);

if (!["postgres:", "postgresql:"].includes(parsedDatasourceUrl.protocol)) {
  throw new Error("Prisma CLI DATABASE_URL must use PostgreSQL");
}

const isAllowedHost =
  process.env.PRISMA_CLI_ALLOW_REMOTE === "true" ||
  process.env.NODE_ENV === "production" ||
  ["127.0.0.1", "localhost", "[::1]", "postgres", "db"].includes(
    parsedDatasourceUrl.hostname,
  );

if (!isAllowedHost) {
  throw new Error("Prisma CLI is restricted to a local PostgreSQL database");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
