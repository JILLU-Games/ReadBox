import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { Client } from "pg";

const TEST_DATABASE_PATTERN = /^readbox_auth_test_[a-f0-9]{32}$/;
const TEST_DATABASE_USER = "readbox_test";
const TEST_DATABASE_PORT = "55432";
const TEST_COMPOSE_PROJECT = "readbox-auth-test";
const TEST_COMPOSE_SERVICE = "postgres-test";
const TEST_CONTAINER_LABEL = "com.readbox.integration-test";
const TEST_CONTAINER_VALUE = "ephemeral-postgres";
const TEST_PGDATA = "/var/lib/postgresql/data";

export interface AuthTestTarget {
  readonly connectionString: string;
  readonly databaseName: string;
}

export interface PostgresContainerEvidence {
  readonly id: string;
  readonly running: boolean;
  readonly image: string;
  readonly integrationLabel: string;
  readonly project: string;
  readonly service: string;
  readonly workingDirectory: string;
  readonly configFiles: readonly string[];
  readonly configuredDatabase: string;
  readonly configuredUser: string;
  readonly passwordMatches: boolean;
  readonly expectedDatabase: string;
  readonly portBindings: Record<
    string,
    readonly { HostIp: string; HostPort: string }[] | undefined
  > | null;
  readonly tmpfs: Record<string, string> | null;
  readonly mounts: readonly { Type: string; Destination: string }[] | null;
}

function reject(reason: string): never {
  throw new Error(`PostgreSQL integration target rejected: ${reason}`);
}

function databaseNameFromUrl(url: URL): string {
  try {
    return decodeURIComponent(url.pathname.slice(1));
  } catch {
    return reject("the database name is invalid");
  }
}

export function parseAuthTestTarget(
  environment: Readonly<Record<string, string | undefined>>,
): AuthTestTarget {
  const connectionString = environment.AUTH_TEST_DATABASE_URL;
  const configuredName = environment.AUTH_TEST_DATABASE_NAME;
  const configuredPassword = environment.AUTH_TEST_POSTGRES_PASSWORD;

  if (!connectionString || !configuredName || !configuredPassword) {
    return reject(
      "set AUTH_TEST_DATABASE_URL, AUTH_TEST_DATABASE_NAME, and AUTH_TEST_POSTGRES_PASSWORD in .env.test.local",
    );
  }
  if (!/^[A-Za-z0-9_-]{32,}$/.test(configuredPassword)) {
    return reject(
      "AUTH_TEST_POSTGRES_PASSWORD must be at least 32 URL-safe characters",
    );
  }
  if (environment.NODE_ENV === "production") {
    return reject("NODE_ENV=production is not allowed");
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(connectionString);
  } catch {
    return reject("AUTH_TEST_DATABASE_URL is invalid");
  }

  const databaseName = databaseNameFromUrl(targetUrl);
  let decodedPassword: string;
  try {
    decodedPassword = decodeURIComponent(targetUrl.password);
  } catch {
    return reject("AUTH_TEST_DATABASE_URL credentials are invalid");
  }

  if (
    !["postgres:", "postgresql:"].includes(targetUrl.protocol) ||
    targetUrl.hostname !== "127.0.0.1" ||
    targetUrl.port !== TEST_DATABASE_PORT ||
    targetUrl.searchParams.size !== 1 ||
    targetUrl.searchParams.get("schema") !== "public" ||
    targetUrl.username !== TEST_DATABASE_USER ||
    decodedPassword !== configuredPassword ||
    !TEST_DATABASE_PATTERN.test(databaseName) ||
    configuredName !== databaseName ||
    databaseName === "mailstack_dev"
  ) {
    return reject(
      "configuration does not match the approved local test target",
    );
  }

  const ordinaryUrlValue = environment.DATABASE_URL;
  if (ordinaryUrlValue) {
    try {
      const ordinaryUrl = new URL(ordinaryUrlValue);
      if (
        ["postgres:", "postgresql:"].includes(ordinaryUrl.protocol) &&
        ordinaryUrl.hostname === targetUrl.hostname &&
        (ordinaryUrl.port || "5432") === targetUrl.port &&
        databaseNameFromUrl(ordinaryUrl) === databaseName
      ) {
        return reject("the integration target must differ from DATABASE_URL");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("PostgreSQL integration target rejected:")
      ) {
        throw error;
      }
      return reject("DATABASE_URL is invalid; refusing to reuse it");
    }
  }

  if (targetUrl.hash) return reject("URL fragments are not allowed");

  return { connectionString, databaseName };
}

export function assertDisposablePostgresContainer(
  evidence: PostgresContainerEvidence,
): void {
  const portBindings = evidence.portBindings?.["5432/tcp"] ?? [];
  const pgDataMounts = evidence.mounts ?? [];
  const tmpfs = evidence.tmpfs ?? {};

  if (
    !/^[a-f0-9]{64}$/i.test(evidence.id) ||
    !evidence.running ||
    evidence.image !== "postgres:16.14-alpine" ||
    evidence.integrationLabel !== TEST_CONTAINER_VALUE ||
    evidence.project !== TEST_COMPOSE_PROJECT ||
    evidence.service !== TEST_COMPOSE_SERVICE ||
    resolve(evidence.workingDirectory) !== resolve(process.cwd()) ||
    evidence.configFiles.length !== 1 ||
    resolve(evidence.configFiles[0] ?? "") !==
      resolve(process.cwd(), "compose.yaml") ||
    evidence.configuredDatabase !== evidence.expectedDatabase ||
    evidence.configuredUser !== TEST_DATABASE_USER ||
    !evidence.passwordMatches ||
    portBindings.length !== 1 ||
    portBindings[0]?.HostIp !== "127.0.0.1" ||
    portBindings[0]?.HostPort !== TEST_DATABASE_PORT ||
    !Object.hasOwn(tmpfs, TEST_PGDATA) ||
    pgDataMounts.some(
      (mount) => mount.Type !== "tmpfs" || mount.Destination !== TEST_PGDATA,
    )
  ) {
    reject(
      "the running container is not the expected ephemeral Compose service",
    );
  }
}

function dockerOutput(args: string[]): string {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
  } catch {
    return reject("Docker could not verify the isolated test container");
  }
}

function parseJsonField<T>(value: string | undefined): T {
  try {
    return JSON.parse(value ?? "");
  } catch {
    return reject("Docker returned incomplete container evidence");
  }
}

function inspectTestContainer(
  target: AuthTestTarget,
): PostgresContainerEvidence {
  const ids = dockerOutput([
    "ps",
    "--no-trunc",
    "--filter",
    `label=${TEST_CONTAINER_LABEL}=${TEST_CONTAINER_VALUE}`,
    "--filter",
    `label=com.docker.compose.project=${TEST_COMPOSE_PROJECT}`,
    "--filter",
    `label=com.docker.compose.service=${TEST_COMPOSE_SERVICE}`,
    "--format",
    "{{.ID}}",
  ])
    .split(/\r?\n/)
    .filter(Boolean);

  if (ids.length !== 1) {
    return reject("exactly one running isolated test container is required");
  }

  const format = [
    "{{.Id}}",
    "{{.State.Running}}",
    "{{.Config.Image}}",
    `{{index .Config.Labels "${TEST_CONTAINER_LABEL}"}}`,
    `{{index .Config.Labels "com.docker.compose.project"}}`,
    `{{index .Config.Labels "com.docker.compose.service"}}`,
    `{{index .Config.Labels "com.docker.compose.project.working_dir"}}`,
    `{{index .Config.Labels "com.docker.compose.project.config_files"}}`,
    "{{json .Config.Env}}",
    "{{json .HostConfig.PortBindings}}",
    "{{json .HostConfig.Tmpfs}}",
    "{{json .Mounts}}",
  ].join("\n");
  const fields = dockerOutput(["inspect", "--format", format, ids[0]!]).split(
    /\r?\n/,
  );

  if (fields.length < 12)
    return reject("Docker returned incomplete container evidence");

  const environment = parseJsonField<string[]>(fields[8]);
  const configuredDatabase = environment
    .find((entry) => entry.startsWith("POSTGRES_DB="))
    ?.slice("POSTGRES_DB=".length);
  const configuredUser = environment
    .find((entry) => entry.startsWith("POSTGRES_USER="))
    ?.slice("POSTGRES_USER=".length);
  const configuredPassword = environment
    .find((entry) => entry.startsWith("POSTGRES_PASSWORD="))
    ?.slice("POSTGRES_PASSWORD=".length);
  let targetPassword = "";
  try {
    targetPassword = decodeURIComponent(
      new URL(target.connectionString).password,
    );
  } catch {
    return reject("AUTH_TEST_DATABASE_URL credentials are invalid");
  }

  const evidence: PostgresContainerEvidence = {
    id: fields[0]!,
    running: fields[1] === "true",
    image: fields[2]!,
    integrationLabel: fields[3]!,
    project: fields[4]!,
    service: fields[5]!,
    workingDirectory: fields[6]!,
    configFiles: fields[7]!.split(",").map((file) => file.trim()),
    configuredDatabase: configuredDatabase ?? "",
    configuredUser: configuredUser ?? "",
    passwordMatches: configuredPassword === targetPassword,
    expectedDatabase: target.databaseName,
    portBindings: parseJsonField(fields[9]),
    tmpfs: parseJsonField(fields[10]),
    mounts: parseJsonField(fields[11]),
  };
  assertDisposablePostgresContainer(evidence);
  return evidence;
}

async function verifyDatabase(
  target: AuthTestTarget,
  requireEmpty: boolean,
  allowCleanMigratedSchema: boolean,
): Promise<void> {
  const client = new Client({
    connectionString: target.connectionString,
    connectionTimeoutMillis: 3_000,
  });

  try {
    await client.connect();
    const identity = await client.query<{
      database_name: string;
      database_user: string;
    }>(
      "SELECT current_database() AS database_name, current_user AS database_user",
    );

    if (
      identity.rows[0]?.database_name !== target.databaseName ||
      identity.rows[0]?.database_user !== TEST_DATABASE_USER
    ) {
      reject("the PostgreSQL server identity does not match the test target");
    }

    if (requireEmpty) {
      const relations = await client.query<{ count: string }>(`
        SELECT count(*)::text AS count
        FROM pg_class AS relation
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
          AND namespace.nspname NOT LIKE 'pg_toast%'
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      `);

      if (relations.rows[0]?.count !== "0") {
        if (!allowCleanMigratedSchema) {
          reject(
            "the verified test database is not empty; no migration was run",
          );
        }

        const completedMigrations = await client.query<{
          migration_name: string;
          finished_at: Date | null;
        }>(`
          SELECT migration_name, finished_at
          FROM public."_prisma_migrations"
          WHERE migration_name IN (
            '20261017000000_initial_application_schema',
            '20261017190000_local_auth_reset',
            '20261018120000_administrator_profiles',
            '20261115000000_mailserver_schema_and_roles'
          )
        `);
        if (
          completedMigrations.rows.length !== 4 ||
          completedMigrations.rows.some((migration) => !migration.finished_at)
        ) {
          reject("existing schema is not the complete expected migration set");
        }

        const tables = await client.query<{
          table_schema: string;
          table_name: string;
        }>(`
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_schema IN ('public', 'mailserver') AND table_type = 'BASE TABLE'
        `);
        if (
          !tables.rows.some(
            (table) =>
              table.table_schema === "public" &&
              table.table_name === "_prisma_migrations",
          )
        ) {
          reject("the expected Prisma migration ledger is missing");
        }

        for (const table of tables.rows) {
          if (
            table.table_schema === "public" &&
            table.table_name === "_prisma_migrations"
          ) {
            continue;
          }
          const quotedSchema = table.table_schema.replace(/"/g, '""');
          const quotedTable = table.table_name.replace(/"/g, '""');
          const count = await client.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM "${quotedSchema}"."${quotedTable}"`,
          );
          if (count.rows[0]?.count !== "0") {
            reject("existing test schema contains leftover synthetic records");
          }
        }
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("PostgreSQL integration target rejected:")
    ) {
      throw error;
    }
    reject("the isolated PostgreSQL target could not be verified");
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function verifyAuthTestTarget(options?: {
  requireEmpty?: boolean;
  allowCleanMigratedSchema?: boolean;
}): Promise<AuthTestTarget> {
  const target = parseAuthTestTarget(process.env);
  inspectTestContainer(target);
  await verifyDatabase(
    target,
    options?.requireEmpty === true,
    options?.allowCleanMigratedSchema === true,
  );
  return target;
}
