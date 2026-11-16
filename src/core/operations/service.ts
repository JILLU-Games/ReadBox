import {
  defaultCheckStorageAccess,
  evaluateIngestionHeartbeat,
  type OverviewHealthItem,
} from "@/core/admin/overview";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import {
  recalculateAllMailboxCounters,
  type CounterPrismaClient,
} from "@/core/ingestion/counters";
import {
  runMessageBodyRepairBatch,
  type BodyRepairBatchSummary,
  type RepairPrismaClient,
} from "@/core/ingestion/repair";
import {
  ingestUnindexedMaildirFiles,
  type IngestionPrismaClient,
  type IngestionRunSummary,
  type IngestionRuntimeConfig,
} from "@/core/ingestion/service";
import { createMaildirTree, ProvisioningError } from "@/core/mailboxes/provisioning";
import {
  isValidUuid,
  validateDomain,
  validateLocalPart,
} from "@/core/mailboxes/validators";
import {
  createPrismaSqlExecutor,
  ensureMailserverDomain,
  listMailserverMailboxes,
  MailServerContractError,
  verifyMailserverContract,
  type PrismaRawQueryable,
  type SqlQueryExecutor,
} from "@/core/mailserver/pg-adapter";
import {
  purgeExpiredMessagesForRetention,
  type RetentionPurgeSummary,
} from "@/core/messages/service";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import "server-only";

export interface OperationsAuditContext {
  readonly actorId: bigint;
  readonly authSource?: "admin_table" | "user_table";
  readonly actorUsername?: string;
  readonly headers?: Pick<Headers, "get">;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly trustProxyHeaders?: boolean;
}

export interface OperationsRuntimeConfig extends IngestionRuntimeConfig {
  readonly mailboxProvisionLockRoot: string;
  readonly ingestionStaleAfterSeconds: number;
}

export interface OperationsMailboxOption {
  readonly uuid: string;
  readonly emailAddress: string;
  readonly status: string;
}

export interface OperationsOverviewData {
  readonly databaseConfigured: boolean;
  readonly databaseConnected: boolean;
  readonly health: {
    readonly ingestion: OverviewHealthItem;
    readonly mailStorage: { readonly ok: boolean; readonly detail: string };
    readonly attachmentStorage: { readonly ok: boolean; readonly detail: string };
    readonly lockStorage: { readonly ok: boolean; readonly detail: string };
  };
  readonly postfixContract: {
    readonly verified: boolean;
    readonly domains: number;
    readonly mailboxes: number;
    readonly postfixRows: number;
    readonly error: string | null;
  };
  readonly syncDrift: {
    readonly appMailboxes: number;
    readonly mailserverMailboxes: number;
    readonly missingInApp: number;
    readonly missingInMailserver: number;
    readonly statusMismatches: number;
  };
  readonly indexingStats: {
    readonly totalMailboxes: number;
    readonly totalMessages: number;
    readonly totalUnread: number;
    readonly warningMessages: number;
    readonly oversizedMessages: number;
    readonly failedMessages: number;
  };
  readonly mailboxes: readonly OperationsMailboxOption[];
}

export interface MaildirProvisionSummary {
  readonly scanned: number;
  readonly verifiedOrCreated: number;
  readonly errors: number;
  readonly issueSamples: readonly string[];
}

export interface MailserverSyncSummary {
  readonly dryRun: boolean;
  readonly strict: boolean;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly errors: number;
  readonly errorSamples: readonly string[];
}

export type OperationsActionResult<T = unknown> =
  | { readonly ok: true; readonly data: T; readonly message: string }
  | {
      readonly ok: false;
      readonly code:
        | "validation"
        | "conflict"
        | "mailserver"
        | "filesystem"
        | "unavailable";
      readonly error: string;
    };

export type OperationsPrismaClient = PrismaRawQueryable &
  AuditWriteClient &
  CounterPrismaClient &
  Omit<IngestionPrismaClient, "$transaction"> &
  Omit<RepairPrismaClient, "$transaction"> & {
    $queryRaw: PrismaClient["$queryRaw"];
    domain: {
      findFirst(args: {
        where: Record<string, unknown>;
        select: {
          id: true;
          name: true;
          status: true;
          verificationStatus: true;
        };
      }): Promise<{
        id: bigint;
        name: string;
        status: string;
        verificationStatus: string;
      } | null>;
      create(args: {
        data: Record<string, unknown>;
        select: {
          id: true;
          name: true;
          status: true;
          verificationStatus: true;
        };
      }): Promise<{
        id: bigint;
        name: string;
        status: string;
        verificationStatus: string;
      }>;
    };
    mailbox: CounterPrismaClient["mailbox"] &
      IngestionPrismaClient["mailbox"] & {
        findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
        findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
        create(args: { data: Record<string, unknown> }): Promise<unknown>;
        update(args: {
          where: { id: bigint };
          data: Record<string, unknown>;
        }): Promise<unknown>;
        count(args?: { where?: Record<string, unknown> }): Promise<number>;
      };
    message: {
      count(args?: { where?: Record<string, unknown> }): Promise<number>;
      aggregate(args: {
        where: Record<string, unknown>;
        _max: { receivedAt: true };
      }): Promise<{ _max: { receivedAt: Date | null } }>;
      findUnique: IngestionPrismaClient["message"]["findUnique"] &
        RepairPrismaClient["message"]["findUnique"];
      findMany: RepairPrismaClient["message"]["findMany"];
      create: IngestionPrismaClient["message"]["create"];
      update: IngestionPrismaClient["message"]["update"] &
        RepairPrismaClient["message"]["update"];
    };
    serviceHeartbeat: {
      findUnique(args: {
        where: { serviceName: string };
        select: { status: true; lastSeenAt: true };
      }): Promise<{ status: string; lastSeenAt: Date } | null>;
      upsert: IngestionPrismaClient["serviceHeartbeat"]["upsert"];
    };
    user: {
      findUnique(args: {
        where: { id: bigint };
        select: { id: true };
      }): Promise<{ id: bigint } | null>;
    };
    $transaction<T>(fn: (tx: OperationsPrismaClient) => Promise<T>): Promise<T>;
  };

class StrictSyncAbortError extends Error {
  readonly summary: MailserverSyncSummary;
  constructor(summary: MailserverSyncSummary) {
    super("Mail-server synchronization found invalid source rows.");
    this.summary = summary;
  }
}

async function resolveActorId(
  prisma: Pick<OperationsPrismaClient, "user">,
  actorId: bigint,
  authSource?: "admin_table" | "user_table",
): Promise<bigint | null> {
  if (authSource === "admin_table") return null;
  if (actorId <= BigInt(0)) return null;
  const found = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true },
  });
  return found?.id ?? null;
}

export async function getOperationsOverview(
  prisma: OperationsPrismaClient | null,
  config: OperationsRuntimeConfig,
  deps: {
    readonly hasDatabaseUrl?: boolean;
    readonly sqlExecutor?: SqlQueryExecutor;
    readonly checkStorage?: typeof defaultCheckStorageAccess;
    readonly now?: Date;
  } = {},
): Promise<OperationsOverviewData> {
  const hasDatabaseUrl = deps.hasDatabaseUrl ?? Boolean(prisma);
  const checkStorage = deps.checkStorage ?? defaultCheckStorageAccess;
  const now = deps.now ?? new Date();

  const [mailStorage, attachmentStorage, lockStorage] = await Promise.all([
    checkStorage(config.mailStorageRoot),
    checkStorage(config.attachmentStorageRoot),
    checkStorage(config.mailboxProvisionLockRoot),
  ]);

  const emptyOverview = (connected: boolean): OperationsOverviewData => ({
    databaseConfigured: hasDatabaseUrl,
    databaseConnected: connected,
    health: {
      ingestion: {
        label: "Ingestion service",
        state: "warn",
        detail: "No heartbeat yet",
        meta: null,
      },
      mailStorage,
      attachmentStorage,
      lockStorage,
    },
    postfixContract: {
      verified: false,
      domains: 0,
      mailboxes: 0,
      postfixRows: 0,
      error: hasDatabaseUrl
        ? "Database is unavailable."
        : "DATABASE_URL is not configured.",
    },
    syncDrift: {
      appMailboxes: 0,
      mailserverMailboxes: 0,
      missingInApp: 0,
      missingInMailserver: 0,
      statusMismatches: 0,
    },
    indexingStats: {
      totalMailboxes: 0,
      totalMessages: 0,
      totalUnread: 0,
      warningMessages: 0,
      oversizedMessages: 0,
      failedMessages: 0,
    },
    mailboxes: [],
  });

  if (!hasDatabaseUrl || !prisma) {
    return emptyOverview(false);
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    const executor = deps.sqlExecutor ?? createPrismaSqlExecutor(prisma);

    const [
      heartbeat,
      appMailboxRows,
      totalMessages,
      totalUnread,
      warningMessages,
      oversizedMessages,
      failedMessages,
    ] = await Promise.all([
      prisma.serviceHeartbeat.findUnique({
        where: { serviceName: "maildir_ingestion" },
        select: { status: true, lastSeenAt: true },
      }),
      prisma.mailbox.findMany({
        where: { deletedAt: null },
        orderBy: { emailAddress: "asc" },
        select: {
          uuid: true,
          emailAddress: true,
          status: true,
        },
      }) as Promise<
        Array<{ uuid: string; emailAddress: string; status: string }>
      >,
      prisma.message.count({
        where: { deletedAt: null, mailbox: { deletedAt: null } },
      }),
      prisma.message.count({
        where: { deletedAt: null, isRead: false, mailbox: { deletedAt: null } },
      }),
      prisma.message.count({
        where: {
          deletedAt: null,
          parseStatus: "warning",
          mailbox: { deletedAt: null },
        },
      }),
      prisma.message.count({
        where: {
          deletedAt: null,
          parseStatus: "oversized",
          mailbox: { deletedAt: null },
        },
      }),
      prisma.message.count({
        where: {
          deletedAt: null,
          parseStatus: { in: ["error", "failed"] },
          mailbox: { deletedAt: null },
        },
      }),
    ]);

    let postfixContract: OperationsOverviewData["postfixContract"];
    try {
      const stats = await verifyMailserverContract(executor);
      postfixContract = {
        verified: true,
        domains: stats.domains,
        mailboxes: stats.mailboxes,
        postfixRows: stats.postfixRows,
        error: null,
      };
    } catch (error) {
      postfixContract = {
        verified: false,
        domains: 0,
        mailboxes: 0,
        postfixRows: 0,
        error:
          error instanceof MailServerContractError
            ? error.message
            : "Unable to verify Postfix contract.",
      };
    }

    let mailserverRows: readonly { email: string; active: boolean }[] = [];
    try {
      mailserverRows = await listMailserverMailboxes(executor);
    } catch {
      mailserverRows = [];
    }

    const appByEmail = new Map(
      appMailboxRows.map((row) => [
        row.emailAddress.toLowerCase(),
        row.status === "active",
      ]),
    );
    const msByEmail = new Map(
      mailserverRows.map((row) => [row.email.toLowerCase(), row.active]),
    );

    let missingInApp = 0;
    let missingInMailserver = 0;
    let statusMismatches = 0;

    for (const [email, msActive] of msByEmail) {
      if (!appByEmail.has(email)) {
        missingInApp += 1;
      } else if (appByEmail.get(email) !== msActive) {
        statusMismatches += 1;
      }
    }
    for (const email of appByEmail.keys()) {
      if (!msByEmail.has(email)) {
        missingInMailserver += 1;
      }
    }

    return {
      databaseConfigured: true,
      databaseConnected: true,
      health: {
        ingestion: evaluateIngestionHeartbeat(
          heartbeat,
          config.ingestionStaleAfterSeconds,
          now,
        ),
        mailStorage,
        attachmentStorage,
        lockStorage,
      },
      postfixContract,
      syncDrift: {
        appMailboxes: appMailboxRows.length,
        mailserverMailboxes: mailserverRows.length,
        missingInApp,
        missingInMailserver,
        statusMismatches,
      },
      indexingStats: {
        totalMailboxes: appMailboxRows.length,
        totalMessages,
        totalUnread,
        warningMessages,
        oversizedMessages,
        failedMessages,
      },
      mailboxes: appMailboxRows,
    };
  } catch {
    logger.error("admin_operations_overview_failed");
    return emptyOverview(false);
  }
}

export async function runVerifyPostfixContract(
  prisma: OperationsPrismaClient,
  ctx: OperationsAuditContext,
  options: { readonly sqlExecutor?: SqlQueryExecutor } = {},
): Promise<
  OperationsActionResult<{
    readonly domains: number;
    readonly mailboxes: number;
    readonly postfixRows: number;
  }>
> {
  const executor = options.sqlExecutor ?? createPrismaSqlExecutor(prisma);
  const actorId = await resolveActorId(prisma, ctx.actorId, ctx.authSource);

  try {
    const stats = await verifyMailserverContract(executor);
    await recordAudit(prisma, {
      actorId: actorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: "operations_verify_postfix_contract",
      targetType: "mailserver",
      targetIdentifier: "postfix_contract",
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: {
        domains: stats.domains,
        mailboxes: stats.mailboxes,
        postfix_rows: stats.postfixRows,
      },
    });
    return {
      ok: true,
      data: stats,
      message: `Postfix contract verified (${stats.domains} active domain(s), ${stats.mailboxes} mailbox(es), ${stats.postfixRows} routing row(s)).`,
    };
  } catch (error) {
    const message =
      error instanceof MailServerContractError
        ? error.message
        : "Postfix PostgreSQL contract check failed.";
    return { ok: false, code: "mailserver", error: message };
  }
}

export async function runSyncMailserverMailboxes(
  prisma: OperationsPrismaClient,
  input: { readonly dryRun?: boolean; readonly strict?: boolean },
  ctx: OperationsAuditContext,
  options: { readonly sqlExecutor?: SqlQueryExecutor } = {},
): Promise<OperationsActionResult<MailserverSyncSummary>> {
  const dryRun = input.dryRun === true;
  const strict = input.strict === true;
  const executor = options.sqlExecutor ?? createPrismaSqlExecutor(prisma);
  const actorId = await resolveActorId(prisma, ctx.actorId, ctx.authSource);

  let sourceRows;
  try {
    sourceRows = await listMailserverMailboxes(executor);
  } catch (error) {
    const message =
      error instanceof MailServerContractError
        ? error.message
        : "Unable to query mailserver mailboxes.";
    return { ok: false, code: "mailserver", error: message };
  }

  try {
    const summary = await prisma.$transaction(async (tx) => {
      const txExecutor = options.sqlExecutor ?? createPrismaSqlExecutor(tx);
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      const errorSamples: string[] = [];

      for (const source of sourceRows) {
        try {
          const localPart = validateLocalPart(source.localPart, {
            allowReserved: true,
          });
          const domainPart = source.email.split("@").pop() ?? "";
          const domainName = validateDomain(domainPart);

          const expectedEmail = `${localPart}@${domainName}`;
          const expectedMaildir = `${domainName}/${localPart}/Maildir/`;
          if (
            source.email.toLowerCase() !== expectedEmail ||
            source.maildir !== expectedMaildir
          ) {
            throw new Error(
              "email or Maildir path violates the ReadBox contract",
            );
          }

          let domain = await tx.domain.findFirst({
            where: { name: { equals: domainName, mode: "insensitive" } },
            select: {
              id: true,
              name: true,
              status: true,
              verificationStatus: true,
            },
          });

          if (!domain) {
            if (!dryRun) {
              domain = await tx.domain.create({
                data: {
                  name: domainName,
                  status: "disabled",
                  verificationStatus: "pending",
                  verificationDetails: { source: "mailserver-sync" },
                },
                select: {
                  id: true,
                  name: true,
                  status: true,
                  verificationStatus: true,
                },
              });
            } else {
              domain = {
                id: BigInt(-1),
                name: domainName,
                status: "disabled",
                verificationStatus: "pending",
              };
            }
          }

          const domainReady =
            domain.status === "active" &&
            domain.verificationStatus === "verified";

          if (!dryRun) {
            await ensureMailserverDomain(txExecutor, {
              domainName: domain.name,
              active: domainReady,
            });
          }

          const targetStatus =
            source.active && domainReady ? "active" : "disabled";

          const existingMailbox =
            domain.id > BigInt(0)
              ? ((await tx.mailbox.findFirst({
                  where: {
                    domainId: domain.id,
                    localPart: { equals: localPart, mode: "insensitive" },
                  },
                  select: {
                    id: true,
                    emailAddress: true,
                    maildirRelativePath: true,
                    status: true,
                    deletedAt: true,
                  },
                })) as {
                  id: bigint;
                  emailAddress: string;
                  maildirRelativePath: string;
                  status: string;
                  deletedAt: Date | null;
                } | null)
              : null;

          if (!existingMailbox) {
            if (!dryRun) {
              await tx.mailbox.create({
                data: {
                  domainId: domain.id,
                  localPart,
                  emailAddress: expectedEmail,
                  maildirRelativePath: expectedMaildir,
                  status: targetStatus,
                },
              });
            }
            created += 1;
            continue;
          }

          if (existingMailbox.deletedAt) {
            throw new Error(
              "existing app mailbox is marked deleted pending purge",
            );
          }

          const needsUpdate =
            existingMailbox.emailAddress !== expectedEmail ||
            existingMailbox.maildirRelativePath !== expectedMaildir ||
            existingMailbox.status !== targetStatus;

          if (needsUpdate) {
            if (!dryRun) {
              await tx.mailbox.update({
                where: { id: existingMailbox.id },
                data: {
                  emailAddress: expectedEmail,
                  maildirRelativePath: expectedMaildir,
                  status: targetStatus,
                },
              });
            }
            updated += 1;
          } else {
            unchanged += 1;
          }
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : "Invalid mailserver row";
          errorSamples.push(`${source.email}: ${reason}`);
        }
      }

      const resultSummary: MailserverSyncSummary = {
        dryRun,
        strict,
        created,
        updated,
        unchanged,
        errors: errorSamples.length,
        errorSamples: errorSamples.slice(0, 25),
      };

      if (strict && errorSamples.length > 0 && !dryRun) {
        throw new StrictSyncAbortError(resultSummary);
      }

      if (!dryRun) {
        await recordAudit(tx, {
          actorId: actorId ?? ctx.actorId,
          authSource: ctx.authSource,
          actorUsername: ctx.actorUsername,
          action: "operations_mailserver_sync",
          targetType: "mailserver",
          targetIdentifier: "mailboxes",
          headers: ctx.headers,
          clientIp: ctx.clientIp,
          userAgent: ctx.userAgent,
          trustProxyHeaders: ctx.trustProxyHeaders,
          details: {
            strict,
            created,
            updated,
            unchanged,
            errors: errorSamples.length,
          },
        });
      }

      return resultSummary;
    });

    if (strict && summary.errors > 0) {
      return {
        ok: false,
        code: "validation",
        error: `Strict sync aborted: ${summary.errors} invalid source row(s) (${summary.errorSamples[0] ?? "check contract"}).`,
      };
    }

    return {
      ok: true,
      data: summary,
      message: dryRun
        ? `Dry-run sync: ${summary.created} create, ${summary.updated} update, ${summary.unchanged} unchanged, ${summary.errors} error(s).`
        : `Mail-server sync completed: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.errors} error(s).`,
    };
  } catch (error) {
    if (error instanceof StrictSyncAbortError) {
      return {
        ok: false,
        code: "validation",
        error: `Strict sync rolled back due to ${error.summary.errors} invalid row(s): ${error.summary.errorSamples[0] ?? "contract violation"}.`,
      };
    }
    return {
      ok: false,
      code: "unavailable",
      error: "Unable to synchronize mail-server mailboxes right now.",
    };
  }
}

export async function runProvisionMaildirs(
  prisma: OperationsPrismaClient,
  config: OperationsRuntimeConfig,
  input: { readonly mailboxUuid?: string },
  ctx: OperationsAuditContext,
): Promise<OperationsActionResult<MaildirProvisionSummary>> {
  if (input.mailboxUuid && !isValidUuid(input.mailboxUuid)) {
    return {
      ok: false,
      code: "validation",
      error: "Select a valid mailbox UUID.",
    };
  }

  const mailboxes = (await prisma.mailbox.findMany({
    where: {
      deletedAt: null,
      ...(input.mailboxUuid ? { uuid: input.mailboxUuid.trim() } : {}),
    },
    select: {
      localPart: true,
      emailAddress: true,
      domain: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  })) as Array<{
    localPart: string;
    emailAddress: string;
    domain: { name: string };
  }>;

  let verifiedOrCreated = 0;
  let errors = 0;
  const issueSamples: string[] = [];

  for (const mailbox of mailboxes) {
    try {
      await createMaildirTree({
        mailStorageRoot: config.mailStorageRoot,
        domainName: mailbox.domain.name,
        localPart: mailbox.localPart,
      });
      verifiedOrCreated += 1;
    } catch (error) {
      errors += 1;
      if (issueSamples.length < 25) {
        const message =
          error instanceof ProvisioningError
            ? error.message
            : "Unable to verify or create Maildir tree.";
        issueSamples.push(`${mailbox.emailAddress}: ${message}`);
      }
    }
  }

  const actorId = await resolveActorId(prisma, ctx.actorId, ctx.authSource);
  await recordAudit(prisma, {
    actorId: actorId ?? ctx.actorId,
    authSource: ctx.authSource,
    actorUsername: ctx.actorUsername,
    action: "operations_provision_maildirs",
    targetType: "mailbox",
    targetIdentifier: input.mailboxUuid?.trim() || "all",
    headers: ctx.headers,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
    trustProxyHeaders: ctx.trustProxyHeaders,
    details: {
      scanned: mailboxes.length,
      verified_or_created: verifiedOrCreated,
      errors,
    },
  });

  return {
    ok: true,
    data: {
      scanned: mailboxes.length,
      verifiedOrCreated,
      errors,
      issueSamples,
    },
    message: `Maildir tree check finished: ${verifiedOrCreated}/${mailboxes.length} ready, ${errors} error(s).`,
  };
}

export async function runRebuildMailIndex(
  prisma: OperationsPrismaClient,
  config: OperationsRuntimeConfig,
  input: { readonly dryRun?: boolean; readonly mailboxUuid?: string },
  ctx: OperationsAuditContext,
): Promise<OperationsActionResult<IngestionRunSummary>> {
  if (input.mailboxUuid && !isValidUuid(input.mailboxUuid)) {
    return {
      ok: false,
      code: "validation",
      error: "Select a valid mailbox UUID.",
    };
  }

  const summary = await ingestUnindexedMaildirFiles(
    prisma as unknown as IngestionPrismaClient,
    config,
    {
      dryRun: input.dryRun === true,
      mailboxUuid: input.mailboxUuid?.trim() || undefined,
    },
  );

  if (summary.status === "lock_busy") {
    return {
      ok: false,
      code: "conflict",
      error: "Ingestion worker lock is currently held by another run; try again shortly.",
    };
  }

  if (!summary.dryRun) {
    const actorId = await resolveActorId(prisma, ctx.actorId, ctx.authSource);
    await recordAudit(prisma, {
      actorId: actorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      action: "operations_rebuild_mail_index",
      targetType: "mailbox",
      targetIdentifier: input.mailboxUuid?.trim() || "all",
      headers: ctx.headers,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      trustProxyHeaders: ctx.trustProxyHeaders,
      details: {
        scanned: summary.scanned,
        created: summary.created,
        duplicates: summary.duplicates,
        oversized: summary.oversized,
        errors: summary.errors,
      },
    });
  }

  return {
    ok: true,
    data: summary,
    message: summary.dryRun
      ? `Dry-run index scan: ${summary.scanned} file(s) scanned, ${summary.created} would index, ${summary.duplicates} already indexed.`
      : `Maildir index pass complete: ${summary.created} indexed, ${summary.duplicates} duplicate(s), ${summary.oversized} oversized, ${summary.errors} error(s).`,
  };
}

export async function runUpdateMailboxCounters(
  prisma: OperationsPrismaClient,
  input: { readonly mailboxUuid?: string },
  ctx: OperationsAuditContext,
): Promise<OperationsActionResult<{ readonly updatedCount: number }>> {
  if (input.mailboxUuid && !isValidUuid(input.mailboxUuid)) {
    return {
      ok: false,
      code: "validation",
      error: "Select a valid mailbox UUID.",
    };
  }

  const result = await recalculateAllMailboxCounters(prisma, {
    mailboxUuid: input.mailboxUuid?.trim() || undefined,
  });

  const actorId = await resolveActorId(prisma, ctx.actorId, ctx.authSource);
  await recordAudit(prisma, {
    actorId: actorId ?? ctx.actorId,
    authSource: ctx.authSource,
    actorUsername: ctx.actorUsername,
    action: "operations_recalculate_counters",
    targetType: "mailbox",
    targetIdentifier: input.mailboxUuid?.trim() || "all",
    headers: ctx.headers,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
    trustProxyHeaders: ctx.trustProxyHeaders,
    details: {
      updated_count: result.updatedCount,
    },
  });

  return {
    ok: true,
    data: result,
    message: `Recalculated message and unread counters for ${result.updatedCount} mailbox(es).`,
  };
}

export async function runRepairMessageBodies(
  prisma: OperationsPrismaClient,
  config: OperationsRuntimeConfig,
  input: {
    readonly dryRun?: boolean;
    readonly confirmRepair?: boolean;
    readonly limit?: number;
    readonly mailboxUuid?: string;
  },
  ctx: OperationsAuditContext,
): Promise<OperationsActionResult<BodyRepairBatchSummary>> {
  const actorId = await resolveActorId(prisma, ctx.actorId, ctx.authSource);
  const res = await runMessageBodyRepairBatch(
    prisma as unknown as RepairPrismaClient,
    config,
    input,
    {
      actorId: actorId ?? ctx.actorId,
      authSource: ctx.authSource,
      actorUsername: ctx.actorUsername,
      headers: ctx.headers,
      trustProxyHeaders: ctx.trustProxyHeaders,
    },
  );

  if (!res.ok) {
    return res;
  }

  return {
    ok: true,
    data: res.data,
    message: res.data.dryRun
      ? `Dry-run body check: ${res.data.scanned} checked, ${res.data.wouldUpdate} would update, ${res.data.mismatched} SHA mismatch(es), ${res.data.missing} missing.`
      : `Body repair finished: ${res.data.updated} updated, ${res.data.unchanged} unchanged, ${res.data.mismatched} SHA mismatch(es), ${res.data.missing} missing.`,
  };
}

export async function runRetentionPurge(
  prisma: OperationsPrismaClient,
  input: {
    readonly dryRun?: boolean;
    readonly retentionDays?: number;
    readonly mailboxUuid?: string;
  },
  ctx: OperationsAuditContext,
): Promise<OperationsActionResult<RetentionPurgeSummary>> {
  if (input.mailboxUuid && !isValidUuid(input.mailboxUuid)) {
    return {
      ok: false,
      code: "validation",
      error: "Select a valid mailbox UUID.",
    };
  }

  const summary = await purgeExpiredMessagesForRetention(
    prisma as unknown as Parameters<typeof purgeExpiredMessagesForRetention>[0],
    {
      dryRun: input.dryRun === true,
      retentionDays: input.retentionDays,
      mailboxUuid: input.mailboxUuid,
      actor: {
        userId: ctx.actorId,
        authSource: ctx.authSource,
        username: ctx.actorUsername,
        headers: ctx.headers,
        clientIp: ctx.clientIp,
        userAgent: ctx.userAgent,
        trustProxyHeaders: ctx.trustProxyHeaders,
      },
    },
  );

  return {
    ok: true,
    data: summary,
    message: summary.dryRun
      ? `Dry-run retention scan: ${summary.purgedMessages} expired message(s) across ${summary.affectedMailboxes} mailbox(es).`
      : `Retention cleanup completed: ${summary.purgedMessages} expired message(s) purged across ${summary.affectedMailboxes} mailbox(es).`,
  };
}
