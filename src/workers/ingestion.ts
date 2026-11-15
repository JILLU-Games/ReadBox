import { env } from "@/config/env";
import { getPrismaClient } from "@/core/database/client";
import {
  ingestUnindexedMaildirFiles,
  type IngestionPrismaClient,
  type IngestionRunSummary,
  type IngestionRuntimeConfig,
} from "@/core/ingestion/service";
import { logger } from "@/core/server/logger";
import "server-only";

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

export async function runIngestionWorkerLoop(
  options: WorkerCliOptions,
  signal?: AbortSignal,
): Promise<IngestionRunSummary> {
  let lastSummary = await runIngestionPass({
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
    dryRun: lastSummary.dryRun,
  });

  if (options.once) {
    return lastSummary;
  }

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
    }
  }

  return lastSummary;
}
