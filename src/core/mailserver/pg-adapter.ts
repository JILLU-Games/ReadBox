import {
  normalizeDomain,
  normalizeLocalPart,
} from "@/core/mailboxes/validators";
import type {
  LookupResult,
  ReadAdapterErrorCode,
  ReadOnlyMailServerAdapter,
  ReadOperationOptions,
} from "@/core/postfix/read-adapter";
import { randomBytes } from "node:crypto";

export class MailServerContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailServerContractError";
  }
}

export interface MailServerSchemaConfig {
  readonly schema: string;
  readonly domainTable: string;
  readonly mailboxTable: string;
  readonly aliasTable: string;
  readonly postfixDomainView: string;
  readonly postfixMailboxView: string;
  readonly postfixAliasView: string;
}

export const MAILSERVER_SCHEMA_CONFIG_DEFAULT: MailServerSchemaConfig =
  Object.freeze({
    schema: "mailserver",
    domainTable: "mail_domains",
    mailboxTable: "mailboxes",
    aliasTable: "mail_aliases",
    postfixDomainView: "postfix_virtual_domains",
    postfixMailboxView: "postfix_virtual_mailboxes",
    postfixAliasView: "postfix_virtual_aliases",
  });

const SAFE_SQL_IDENTIFIER = /^[a-z0-9_]+$/;

export function quoteSqlIdentifier(value: string, settingName: string): string {
  if (!SAFE_SQL_IDENTIFIER.test(value)) {
    throw new MailServerContractError(
      `Unsafe SQL identifier configured for ${settingName}`,
    );
  }
  return `"${value}"`;
}

export function resolveQualifiedMailserverNames(
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
) {
  const schema = quoteSqlIdentifier(config.schema, "schema");
  return {
    domains: `${schema}.${quoteSqlIdentifier(config.domainTable, "domainTable")}`,
    mailboxes: `${schema}.${quoteSqlIdentifier(config.mailboxTable, "mailboxTable")}`,
    aliases: `${schema}.${quoteSqlIdentifier(config.aliasTable, "aliasTable")}`,
    postfixDomains: `${schema}.${quoteSqlIdentifier(config.postfixDomainView, "postfixDomainView")}`,
    postfixMailboxes: `${schema}.${quoteSqlIdentifier(config.postfixMailboxView, "postfixMailboxView")}`,
    postfixAliases: `${schema}.${quoteSqlIdentifier(config.postfixAliasView, "postfixAliasView")}`,
  };
}

export interface SqlQueryResult<TRow = Record<string, unknown>> {
  readonly rows: readonly TRow[];
  readonly rowCount: number | null;
}

export interface SqlQueryExecutor {
  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    signal?: AbortSignal,
  ): Promise<SqlQueryResult<TRow>>;
}

export interface PrismaRawQueryable {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export function createPrismaSqlExecutor(
  prisma: PrismaRawQueryable,
): SqlQueryExecutor {
  return {
    async query<TRow = Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = [],
      signal?: AbortSignal,
    ): Promise<SqlQueryResult<TRow>> {
      if (signal?.aborted) {
        const abortError = new Error("Operation cancelled");
        abortError.name = "AbortError";
        throw abortError;
      }

      const trimmed = sql.trimStart().toUpperCase();
      if (trimmed.startsWith("SELECT") || trimmed.includes("RETURNING")) {
        const rows = (await prisma.$queryRawUnsafe<TRow[]>(
          sql,
          ...params,
        )) as TRow[];
        return {
          rows: Array.isArray(rows) ? rows : [],
          rowCount: Array.isArray(rows) ? rows.length : 0,
        };
      }

      const rowCount = await prisma.$executeRawUnsafe(sql, ...params);
      return {
        rows: [],
        rowCount: typeof rowCount === "number" ? rowCount : 0,
      };
    },
  };
}

export interface PostfixDomainQuery {
  readonly name: string;
}

export interface PostfixDomainRecord {
  readonly name: string;
}

export interface PostfixMailboxQuery {
  readonly email: string;
}

export interface PostfixMailboxRecord {
  readonly email: string;
  readonly maildir: string;
}

export interface PostfixAliasQuery {
  readonly source: string;
}

export interface PostfixAliasRecord {
  readonly source: string;
  readonly destination: string;
}

function classifyAdapterError(error: unknown): ReadAdapterErrorCode {
  if (error instanceof MailServerContractError) {
    return "unavailable";
  }
  const err = error as { name?: string; code?: string; message?: string };
  const code = (err?.code ?? "").toUpperCase();
  const message = (err?.message ?? "").toLowerCase();

  if (err?.name === "AbortError" || message.includes("abort")) {
    return "cancelled";
  }
  if (code === "ETIMEDOUT" || code === "57014" || message.includes("timeout")) {
    return "timeout";
  }
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "P1001" ||
    code === "42P01" ||
    code === "42501"
  ) {
    return "unavailable";
  }
  return "query_failed";
}

export function createPgReadOnlyMailServerAdapter(
  executor: SqlQueryExecutor,
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): ReadOnlyMailServerAdapter<
  PostfixDomainQuery,
  PostfixDomainRecord,
  PostfixMailboxQuery,
  PostfixMailboxRecord,
  PostfixAliasQuery,
  PostfixAliasRecord
> {
  return {
    async lookupDomains(
      query: PostfixDomainQuery,
      options?: ReadOperationOptions,
    ): Promise<LookupResult<PostfixDomainRecord>> {
      if (options?.signal?.aborted) {
        return { kind: "error", code: "cancelled" };
      }
      const normalized = normalizeDomain(query.name);
      if (!normalized || normalized.length > 253) {
        return { kind: "error", code: "invalid_input" };
      }
      try {
        const names = resolveQualifiedMailserverNames(config);
        const result = await executor.query<PostfixDomainRecord>(
          `SELECT "name" FROM ${names.postfixDomains} WHERE "name" = $1`,
          [normalized],
          options?.signal,
        );
        if (result.rows.length === 0) return { kind: "not_found" };
        if (result.rows.length > 1) {
          return { kind: "ambiguous", matchCount: result.rows.length };
        }
        return { kind: "records", records: result.rows };
      } catch (error) {
        return { kind: "error", code: classifyAdapterError(error) };
      }
    },

    async lookupMailboxes(
      query: PostfixMailboxQuery,
      options?: ReadOperationOptions,
    ): Promise<LookupResult<PostfixMailboxRecord>> {
      if (options?.signal?.aborted) {
        return { kind: "error", code: "cancelled" };
      }
      const normalized = (query.email ?? "").trim().toLowerCase();
      if (!normalized || !normalized.includes("@") || normalized.length > 320) {
        return { kind: "error", code: "invalid_input" };
      }
      try {
        const names = resolveQualifiedMailserverNames(config);
        const result = await executor.query<PostfixMailboxRecord>(
          `SELECT "email", "maildir" FROM ${names.postfixMailboxes} WHERE "email" = $1`,
          [normalized],
          options?.signal,
        );
        if (result.rows.length === 0) return { kind: "not_found" };
        if (result.rows.length > 1) {
          return { kind: "ambiguous", matchCount: result.rows.length };
        }
        return { kind: "records", records: result.rows };
      } catch (error) {
        return { kind: "error", code: classifyAdapterError(error) };
      }
    },

    async lookupAliases(
      query: PostfixAliasQuery,
      options?: ReadOperationOptions,
    ): Promise<LookupResult<PostfixAliasRecord>> {
      if (options?.signal?.aborted) {
        return { kind: "error", code: "cancelled" };
      }
      const normalized = (query.source ?? "").trim().toLowerCase();
      if (!normalized || !normalized.includes("@") || normalized.length > 320) {
        return { kind: "error", code: "invalid_input" };
      }
      try {
        const names = resolveQualifiedMailserverNames(config);
        const result = await executor.query<PostfixAliasRecord>(
          `SELECT "source", "destination" FROM ${names.postfixAliases} WHERE "source" = $1 ORDER BY "destination" ASC`,
          [normalized],
          options?.signal,
        );
        if (result.rows.length === 0) return { kind: "not_found" };
        return { kind: "records", records: result.rows };
      } catch (error) {
        return { kind: "error", code: classifyAdapterError(error) };
      }
    },
  };
}

export interface MailServerMailboxRow {
  readonly localPart: string;
  readonly email: string;
  readonly maildir: string;
  readonly active: boolean;
}

export function generateDisabledMailboxPasswordHash(): string {
  return `!READBOX-READ-ONLY!${randomBytes(36).toString("base64url")}`;
}

export async function ensureMailserverDomain(
  executor: SqlQueryExecutor,
  input: { readonly domainName: string; readonly active: boolean },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<{ readonly created: boolean }> {
  const names = resolveQualifiedMailserverNames(config);
  const domainName = normalizeDomain(input.domainName);
  const existing = await executor.query<{ id: unknown }>(
    `SELECT "id" FROM ${names.domains} WHERE lower("name") = $1 LIMIT 1`,
    [domainName],
  );

  if (existing.rows.length === 0) {
    await executor.query(
      `INSERT INTO ${names.domains} ("name", "active") VALUES ($1, $2)`,
      [domainName, input.active],
    );
    return { created: true };
  }

  await executor.query(
    `UPDATE ${names.domains} SET "active" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2`,
    [input.active, existing.rows[0].id],
  );
  return { created: false };
}

export async function setMailserverDomainActive(
  executor: SqlQueryExecutor,
  input: { readonly domainName: string; readonly active: boolean },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<void> {
  const names = resolveQualifiedMailserverNames(config);
  const domainName = normalizeDomain(input.domainName);
  const result = await executor.query(
    `UPDATE ${names.domains} SET "active" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE lower("name") = $2`,
    [input.active, domainName],
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new MailServerContractError(
      `Mail-server domain ${domainName} is missing`,
    );
  }
}

export async function deleteMailserverDomain(
  executor: SqlQueryExecutor,
  input: { readonly domainName: string },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<void> {
  const names = resolveQualifiedMailserverNames(config);
  const domainName = normalizeDomain(input.domainName);
  const domainRows = await executor.query<{ id: unknown }>(
    `SELECT "id" FROM ${names.domains} WHERE lower("name") = $1 LIMIT 1`,
    [domainName],
  );
  if (domainRows.rows.length === 0) {
    return;
  }

  const domainId = domainRows.rows[0].id;
  const mailboxRows = await executor.query(
    `SELECT 1 FROM ${names.mailboxes} WHERE "domain_id" = $1 LIMIT 1`,
    [domainId],
  );
  if (mailboxRows.rows.length > 0) {
    throw new MailServerContractError(
      `Mail-server domain ${domainName} still has mailboxes`,
    );
  }

  await executor.query(`DELETE FROM ${names.domains} WHERE "id" = $1`, [
    domainId,
  ]);
}

export async function mailserverMailboxExists(
  executor: SqlQueryExecutor,
  input: { readonly email: string; readonly domainName?: string },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<boolean> {
  const names = resolveQualifiedMailserverNames(config);
  const email = (input.email ?? "").trim().toLowerCase();
  if (input.domainName) {
    const domainName = normalizeDomain(input.domainName);
    const result = await executor.query(
      `SELECT 1 FROM ${names.mailboxes} AS m INNER JOIN ${names.domains} AS d ON d."id" = m."domain_id" WHERE lower(m."email") = $1 AND lower(d."name") = $2 LIMIT 1`,
      [email, domainName],
    );
    return result.rows.length > 0;
  }
  const result = await executor.query(
    `SELECT 1 FROM ${names.mailboxes} WHERE lower("email") = $1 LIMIT 1`,
    [email],
  );
  return result.rows.length > 0;
}

export async function aliasSourceExists(
  executor: SqlQueryExecutor,
  input: { readonly email: string },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<boolean> {
  const names = resolveQualifiedMailserverNames(config);
  const email = (input.email ?? "").trim().toLowerCase();
  const result = await executor.query(
    `SELECT 1 FROM ${names.aliases} WHERE lower("source") = $1 AND "active" = true LIMIT 1`,
    [email],
  );
  return result.rows.length > 0;
}

export async function createMailserverMailbox(
  executor: SqlQueryExecutor,
  input: {
    readonly localPart: string;
    readonly email: string;
    readonly maildir: string;
    readonly domainName: string;
    readonly quotaBytes?: number;
  },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<void> {
  const names = resolveQualifiedMailserverNames(config);
  const domainName = normalizeDomain(input.domainName);
  const localPart = normalizeLocalPart(input.localPart);
  const email = (input.email ?? "").trim().toLowerCase();

  if (await aliasSourceExists(executor, { email }, config)) {
    throw new MailServerContractError(
      `An active mail alias already uses ${email} as its source`,
    );
  }

  const domainRows = await executor.query<{ id: unknown }>(
    `SELECT "id" FROM ${names.domains} WHERE lower("name") = $1 AND "active" = true LIMIT 1`,
    [domainName],
  );
  if (domainRows.rows.length === 0) {
    throw new MailServerContractError(
      `Active mail domain ${domainName} is unavailable`,
    );
  }

  const existing = await executor.query(
    `SELECT 1 FROM ${names.mailboxes} WHERE lower("email") = $1 LIMIT 1`,
    [email],
  );
  if (existing.rows.length > 0) {
    throw new MailServerContractError(
      `Mailbox ${email} already exists in the mail server`,
    );
  }

  const quotaBytes = input.quotaBytes ?? 2_147_483_648;
  const insertResult = await executor.query(
    `INSERT INTO ${names.mailboxes} ("domain_id", "local_part", "email", "password_hash", "maildir", "quota_bytes", "active") VALUES ($1, $2, $3, $4, $5, $6, true)`,
    [
      domainRows.rows[0].id,
      localPart,
      email,
      generateDisabledMailboxPasswordHash(),
      input.maildir,
      quotaBytes,
    ],
  );
  if ((insertResult.rowCount ?? 0) !== 1) {
    throw new MailServerContractError(
      `Failed to create mail-server mailbox ${email}`,
    );
  }
}

export async function setMailserverMailboxActive(
  executor: SqlQueryExecutor,
  input: { readonly email: string; readonly active: boolean },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<void> {
  const names = resolveQualifiedMailserverNames(config);
  const email = (input.email ?? "").trim().toLowerCase();
  const result = await executor.query(
    `UPDATE ${names.mailboxes} SET "active" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE lower("email") = $2`,
    [input.active, email],
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new MailServerContractError(`Mail-server mailbox ${email} is missing`);
  }
}

export async function deleteMailserverMailbox(
  executor: SqlQueryExecutor,
  input: { readonly email: string },
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<void> {
  const names = resolveQualifiedMailserverNames(config);
  const email = (input.email ?? "").trim().toLowerCase();
  const result = await executor.query(
    `DELETE FROM ${names.mailboxes} WHERE lower("email") = $1`,
    [email],
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new MailServerContractError(`Mail-server mailbox ${email} is missing`);
  }
}

export async function listMailserverMailboxes(
  executor: SqlQueryExecutor,
  options: { readonly domainName?: string } = {},
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<readonly MailServerMailboxRow[]> {
  const names = resolveQualifiedMailserverNames(config);
  if (options.domainName) {
    const domainName = normalizeDomain(options.domainName);
    const result = await executor.query<{
      local_part: string;
      email: string;
      maildir: string;
      active: boolean;
    }>(
      `SELECT m."local_part", m."email", m."maildir", m."active" FROM ${names.mailboxes} AS m INNER JOIN ${names.domains} AS d ON d."id" = m."domain_id" WHERE lower(d."name") = $1 ORDER BY m."email" ASC`,
      [domainName],
    );
    return result.rows.map((row) => ({
      localPart: row.local_part,
      email: row.email,
      maildir: row.maildir,
      active: Boolean(row.active),
    }));
  }

  const result = await executor.query<{
    local_part: string;
    email: string;
    maildir: string;
    active: boolean;
  }>(
    `SELECT "local_part", "email", "maildir", "active" FROM ${names.mailboxes} ORDER BY "email" ASC`,
  );
  return result.rows.map((row) => ({
    localPart: row.local_part,
    email: row.email,
    maildir: row.maildir,
    active: Boolean(row.active),
  }));
}

export async function verifyMailserverContract(
  executor: SqlQueryExecutor,
  config: MailServerSchemaConfig = MAILSERVER_SCHEMA_CONFIG_DEFAULT,
): Promise<{
  readonly domains: number;
  readonly mailboxes: number;
  readonly postfixRows: number;
}> {
  const names = resolveQualifiedMailserverNames(config);
  const domainsRes = await executor.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${names.domains} WHERE "active" = true`,
  );
  const activeDomains = Number(domainsRes.rows[0]?.count ?? 0);
  if (activeDomains < 1) {
    throw new MailServerContractError(
      "At least one active mail domain record is required",
    );
  }
  const mailboxesRes = await executor.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${names.mailboxes}`,
  );
  const postfixRes = await executor.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${names.postfixMailboxes}`,
  );
  return {
    domains: activeDomains,
    mailboxes: Number(mailboxesRes.rows[0]?.count ?? 0),
    postfixRows: Number(postfixRes.rows[0]?.count ?? 0),
  };
}
