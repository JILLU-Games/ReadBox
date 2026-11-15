import { config as loadEnv } from "dotenv";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { verifyAuthTestTarget } from "./postgres-target";

function safeTestSummary(output: string): string[] {
  const lines = output.split(/\r?\n/);
  const summary = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      /^# Subtest: /.test(trimmed) ||
      /^(?:not )?ok \d+/.test(trimmed) ||
      /^# (?:tests|pass|fail|skipped|todo)\b/.test(trimmed) ||
      /^failureType:/.test(trimmed) ||
      /^code:/.test(trimmed) ||
      /^PostgreSQL integration target rejected:/.test(trimmed)
    );
  });

  const errorIndex = lines.findIndex((line) => /^\s*error:/.test(line));
  const errorBlock =
    errorIndex < 0
      ? []
      : [lines[errorIndex]!, ...lines.slice(errorIndex + 1, errorIndex + 20)];
  const errorType = errorBlock
    .map(
      (line) =>
        line.match(/\b([A-Za-z][A-Za-z0-9]*(?:Error|Exception))\b/)?.[1],
    )
    .find((type) => type !== undefined);
  if (errorType) summary.push(`Integration error type: ${errorType}`);

  const sourceLocation = [...lines, ...errorBlock]
    .map((line) =>
      line.match(/at .*database-flow\.test\.ts:(\d+):(\d+)/)?.slice(1),
    )
    .find((location) => location !== undefined);
  if (sourceLocation) {
    summary.push(
      `Integration source location: database-flow.test.ts:${sourceLocation[0]}:${sourceLocation[1]}`,
    );
  }

  return [...new Set(summary)];
}

function redactIntegrationOutput(output: string): string {
  let redacted = output;
  for (const secret of [
    process.env.AUTH_TEST_DATABASE_URL,
    process.env.AUTH_TEST_POSTGRES_PASSWORD,
  ]) {
    if (secret) redacted = redacted.replaceAll(secret, "[redacted]");
  }
  return redacted
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted database URL]")
    .replace(/\$argon2(?:id|i|d)\$[^\s"']+/gi, "[redacted password hash]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted opaque value]")
    .replace(/\bsynthetic(?:-[A-Za-z0-9_-]+)+\b/gi, "[synthetic fixture]")
    .replace(/[A-Za-z0-9._%+-]+@example\.invalid/gi, "[synthetic email]");
}

function runNode(args: string[], environment: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: environment,
    maxBuffer: 5 * 1024 * 1024,
    windowsHide: true,
  });
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.test.local" });

  const target = await verifyAuthTestTarget({
    requireEmpty: true,
    allowCleanMigratedSchema: true,
  });
  const testEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    AUTH_TEST_DATABASE_URL: target.connectionString,
  };
  delete testEnvironment.DATABASE_URL;
  const migrationEnvironment = {
    ...testEnvironment,
    DATABASE_URL: target.connectionString,
  };
  const prismaCli = resolve("node_modules", "prisma", "build", "index.js");
  const migration = runNode(
    [prismaCli, "migrate", "deploy"],
    migrationEnvironment,
  );

  if (migration.error || migration.status !== 0) {
    throw new Error(
      "Prisma migrations failed on the verified ephemeral test target; details withheld.",
    );
  }

  const repeatMigration = runNode(
    [prismaCli, "migrate", "deploy"],
    migrationEnvironment,
  );
  if (repeatMigration.error || repeatMigration.status !== 0) {
    throw new Error(
      "Repeat migration check failed on the verified ephemeral test target; details withheld.",
    );
  }

  console.log(
    "Prisma migrations applied and safely repeated on the verified ephemeral test target.",
  );

  const integrationTests = runNode(
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--test",
      "tests/auth/database-flow.test.ts",
    ],
    testEnvironment,
  );

  if (integrationTests.error || integrationTests.status !== 0) {
    const output = redactIntegrationOutput(
      `${integrationTests.stdout ?? ""}\n${integrationTests.stderr ?? ""}`,
    );
    const summary = safeTestSummary(output);
    if (summary.length > 0) {
      for (const line of summary) console.error(line);
    }
    for (const line of output.split(/\r?\n/).filter(Boolean).slice(-30)) {
      console.error(line);
    }
    throw new Error(
      `PostgreSQL integration tests failed (exit ${integrationTests.status ?? "unknown"}); assertion details withheld.`,
    );
  }

  const output = integrationTests.stdout?.trim();
  if (output) console.log(output);
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error &&
    error.message.startsWith("PostgreSQL integration target rejected:")
      ? error.message
      : error instanceof Error &&
          error.message.startsWith("Prisma migrations failed")
        ? error.message
        : error instanceof Error &&
            error.message.startsWith("PostgreSQL integration tests failed")
          ? error.message
          : "PostgreSQL integration verification failed; details withheld.";
  console.error(message);
  process.exitCode = 1;
});
