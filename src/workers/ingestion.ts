import { env } from "@/config/env";
import { getPrismaClient } from "@/core/database/client";
import {
  ingestUnindexedMaildirFiles,
  type IngestionPrismaClient,
  type IngestionRunSummary,
  type IngestionRuntimeConfig,
} from "@/core/ingestion/service";
import {
  purgeExpiredMessagesForRetention,
  type RetentionPurgeSummary,
} from "@/core/messages/service";
import { logger } from "@/core/server/logger";
import "server-only";

export const DEFAULT_RETENTION_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export interface WorkerCliOptions {
  readonly once: boolean;
  readonly intervalSeconds: number;
  readonly mailboxLocalPart?: string;
  readonly dryRun: boolean;
}

export function parseWorkerArgs(
  argv: readonly string[],
  defaultIntervalSeconds: number,
): WorkerCliOptions {
  let once = false;
  let watch = false;
  let intervalSeconds = defaultIntervalSeconds;
  let mailboxLocalPart: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--once") {
      once = true;
    } else if (arg === "--watch") {
      watch = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--interval") {
      const next = argv[i + 1];
      if (!next || !/^\d+$/.test(next)) {
        throw new Error("--interval must be a positive integer (seconds)");
      }
      const parsed = Number.parseInt(next, 10);
      if (parsed < 1 || parsed > 3600) {
        throw new Error("--interval must be between 1 and 3600 seconds");
      }
      intervalSeconds = parsed;
      i += 1;
    } else if (arg === "--mailbox") {
      const next = argv[i + 1];
      if (!next || !next.trim()) {
        throw new Error("--mailbox requires a mailbox local part");
      }
      mailboxLocalPart = next.trim().toLowerCase();
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      // Handled by caller or no-op
    } else {
      throw new Error(`Unknown worker flag: ${arg}`);
    }
  }

  return {
    once: once || !watch,
    intervalSeconds,
    mailboxLocalPart,
    dryRun,
  };
}

function defaultRuntimeConfig(): IngestionRuntimeConfig {
  return {
    mailStorageRoot: env.mailStorageRoot,
    attachmentStorageRoot: env.attachmentStorageRoot,
    ingestionLockFile: env.ingestionLockFile,
    maxMessageSizeMb: env.maxMessageSizeMb,
    maxAttachmentSizeMb: env.maxAttachmentSizeMb,
    maxAttachmentsPerMessage: env.maxAttachmentsPerMessage,
  };
}

export async function runIngestionPass(
  options: {
    readonly mailboxLocalPart?: string;
    readonly dryRun?: boolean;
  } = {},
): Promise<IngestionRunSummary> {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL must be set to run Maildir ingestion.");
  }

  const prisma = getPrismaClient() as unknown as IngestionPrismaClient;
  return ingestUnindexedMaildirFiles(prisma, defaultRuntimeConfig(), {
    mailboxLocalPart: options.mailboxLocalPart,
    dryRun: options.dryRun === true,
  });
}

export async function runWorkerRetentionPurgePass(
  options: {
    readonly dryRun?: boolean;
    readonly mailboxLocalPart?: string;
  } = {},
): Promise<RetentionPurgeSummary> {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL must be set to run retention purge.");
  }

  const prisma = getPrismaClient();
  let mailboxUuid: string | undefined;

  if (options.mailboxLocalPart?.trim()) {
    const matched = await prisma.mailbox.findFirst({
      where: {
        deletedAt: null,
        localPart: options.mailboxLocalPart.trim().toLowerCase(),
      },
      select: { uuid: true },
    });
    if (!matched) {
      return {
        dryRun: options.dryRun === true,
        retentionDays: 0,
        cutoffIso: null,
        scannedMailboxes: 0,
        affectedMailboxes: 0,
        purgedMessages: 0,
        errors: 0,
      };
    }
    mailboxUuid = matched.uuid;
  }

  return purgeExpiredMessagesForRetention(
    prisma as unknown as Parameters<typeof purgeExpiredMessagesForRetention>[0],
    {
      dryRun: options.dryRun === true,
      mailboxUuid,
      actor: {
        username: "system-retention-worker",
      },
    },
  );
}

export async function recordWorkerDegradedHeartbeat(
  reason: string,
  details?: Record<string, unknown>,
  prismaClient?: {
    readonly serviceHeartbeat?: {
      upsert(args: {
        where: { serviceName: string };
        create: {
          serviceName: string;
          status: string;
          details: Record<string, unknown>;
          lastSeenAt: Date;
        };
        update: {
          status: string;
          details: Record<string, unknown>;
          lastSeenAt: Date;
        };
      }): Promise<unknown>;
    };
  } | null,
): Promise<void> {
  try {
    const client =
      prismaClient !== undefined
        ? prismaClient
        : env.databaseUrl
          ? (getPrismaClient() as unknown as {
              readonly serviceHeartbeat?: {
                upsert(args: unknown): Promise<unknown>;
              };
            })
          : null;
    if (!client?.serviceHeartbeat) return;
    const now = new Date();
    const payload = {
      reason,
      ...details,
    };
    await client.serviceHeartbeat.upsert({
      where: { serviceName: "maildir_ingestion" },
      create: {
        serviceName: "maildir_ingestion",
        status: "degraded",
        details: payload,
        lastSeenAt: now,
      },
      update: {
        status: "degraded",
        details: payload,
        lastSeenAt: now,
      },
    });
  } catch {
    // Best-effort heartbeat update
  }
}

export async function runIngestionWorkerLoop(
  options: WorkerCliOptions,
  signal?: AbortSignal,
): Promise<IngestionRunSummary> {
  let lastSummary: IngestionRunSummary;
  try {
    lastSummary = await runIngestionPass({
      mailboxLocalPart: options.mailboxLocalPart,
      dryRun: options.dryRun,
    });
  } catch (error) {
    await recordWorkerDegradedHeartbeat("initial_ingestion_pass_failed", {
      errorType: error instanceof Error ? error.name : "WorkerError",
    });
    throw error;
  }

  logger.info("ingestion_pass_completed", {
    status: lastSummary.status,
    scanned: lastSummary.scanned,
    created: lastSummary.created,
    duplicates: lastSummary.duplicates,
    oversized: lastSummary.oversized,
    errors: lastSummary.errors,
    dryRun: lastSummary.dryRun,
  });

  let lastRetentionPurgeAt = 0;

  async function maybeRunRetentionPurge() {
    const nowMs = Date.now();
    if (
      lastRetentionPurgeAt !== 0 &&
      nowMs - lastRetentionPurgeAt < DEFAULT_RETENTION_PURGE_INTERVAL_MS
    ) {
      return;
    }

    lastRetentionPurgeAt = nowMs;
    try {
      const purgeSummary = await runWorkerRetentionPurgePass({
        dryRun: options.dryRun,
        mailboxLocalPart: options.mailboxLocalPart,
      });
      logger.info("worker_retention_purge_completed", {
        dryRun: purgeSummary.dryRun,
        scannedMailboxes: purgeSummary.scannedMailboxes,
        affectedMailboxes: purgeSummary.affectedMailboxes,
        purgedMessages: purgeSummary.purgedMessages,
        errors: purgeSummary.errors ?? 0,
      });
      if ((purgeSummary.errors ?? 0) > 0) {
        await recordWorkerDegradedHeartbeat("retention_purge_partial_errors", {
          retentionErrors: purgeSummary.errors,
        });
      }
    } catch (error) {
      const errorType = error instanceof Error ? error.name : "RetentionError";
      logger.error("worker_retention_purge_failed", { errorType });
      await recordWorkerDegradedHeartbeat("retention_purge_failed", {
        errorType,
      });
    }
  }

  if (options.once) {
    return lastSummary;
  }

  await maybeRunRetentionPurge();

  while (!signal?.aborted) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, options.intervalSeconds * 1000);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });

    if (signal?.aborted) break;

    try {
      lastSummary = await runIngestionPass({
        mailboxLocalPart: options.mailboxLocalPart,
        dryRun: options.dryRun,
      });
      logger.info("ingestion_pass_completed", {
        status: lastSummary.status,
        scanned: lastSummary.scanned,
        created: lastSummary.created,
        duplicates: lastSummary.duplicates,
        oversized: lastSummary.oversized,
        errors: lastSummary.errors,
      });
    } catch (error) {
      const errorType = error instanceof Error ? error.name : "WorkerError";
      logger.error("ingestion_worker_pass_failed", { errorType });
      await recordWorkerDegradedHeartbeat("ingestion_pass_failed", {
        errorType,
      });
    }

    await maybeRunRetentionPurge();
  }

  return lastSummary;
}
