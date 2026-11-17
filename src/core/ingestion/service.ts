import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { storeConfinedAttachment, AttachmentTooLargeError } from "@/core/ingestion/attachments";
import { recalculateMailboxCounters, type CounterPrismaClient } from "@/core/ingestion/counters";
import { parseEmailMessage, sha256Bytes } from "@/core/ingestion/parser";
import { confinedPath, PathConfinementError } from "@/core/mailboxes/paths";
import { removeConfinedStoredAttachment } from "@/core/mailboxes/provisioning";
import { logger } from "@/core/server/logger";
import { createHash } from "node:crypto";
import { createReadStream, realpathSync } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, readFile } from "node:fs/promises";
import { basename, dirname, relative, sep } from "node:path";
import lockfile from "proper-lockfile";
import "server-only";

export interface IngestionRuntimeConfig {
  readonly mailStorageRoot: string;
  readonly attachmentStorageRoot: string;
  readonly ingestionLockFile: string;
  readonly maxMessageSizeMb: number;
  readonly maxAttachmentSizeMb: number;
  readonly maxAttachmentsPerMessage: number;
}

export interface IngestionMailboxTarget {
  readonly id: bigint;
  readonly uuid: string;
  readonly localPart: string;
  readonly emailAddress: string;
  readonly domain: { readonly name: string };
}

export interface IngestionResultCounts {
  scanned: number;
  created: number;
  duplicates: number;
  oversized: number;
  skippedMissing: number;
  errors: number;
}

export interface IngestionRunSummary extends IngestionResultCounts {
  readonly status: "healthy" | "degraded" | "lock_busy";
  readonly dryRun: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly errorSamples: readonly string[];
}

export type IngestFileOutcome =
  | "created"
  | "duplicate"
  | "oversized"
  | "skipped_missing";

export type IngestionTransactionClient = Pick<
  CounterPrismaClient,
  "mailbox" | "message"
> & {
  message: CounterPrismaClient["message"] & {
    findUnique(args: {
      where: {
        mailboxId_sourceFileKey: { mailboxId: bigint; sourceFileKey: string };
      };
      select: { id: true };
    }): Promise<{ id: bigint } | null>;
    create(args: {
      data: Record<string, unknown>;
      select?: { id: true; uuid: true };
    }): Promise<{ id: bigint; uuid: string }>;
    update(args: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  attachment: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type IngestionPrismaClient = IngestionTransactionClient &
  AuditWriteClient & {
    mailbox: CounterPrismaClient["mailbox"] & {
      findMany(args: {
        where: Record<string, unknown>;
        select: {
          id: true;
          uuid: true;
          localPart: true;
          emailAddress: true;
          domain: { select: { name: true } };
        };
        orderBy: { id: "asc" | "desc" };
      }): Promise<IngestionMailboxTarget[]>;
    };
    serviceHeartbeat: {
      upsert(args: {
        where: { serviceName: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }): Promise<unknown>;
    };
    $transaction<T>(
      fn: (tx: IngestionTransactionClient) => Promise<T>,
    ): Promise<T>;
  };

function isUniqueConstraintError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === "P2002";
}

function sha256FileStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function resolveMaildirSourceKey(
  mailStorageRoot: string,
  domainName: string,
  localPart: string,
  sourcePath: string,
): string {
  const maildirRoot = confinedPath(
    mailStorageRoot,
    domainName,
    localPart,
    "Maildir",
  );

  let resolvedTarget: string;
  try {
    const stat = realpathSync(sourcePath);
    resolvedTarget = stat;
  } catch {
    throw new PathConfinementError("Source message file is inaccessible.");
  }

  let resolvedMaildir: string;
  try {
    resolvedMaildir = realpathSync(maildirRoot);
  } catch {
    resolvedMaildir = maildirRoot;
  }

  const rel = relative(resolvedMaildir, resolvedTarget);
  if (!rel || rel.startsWith(`..${sep}`) || rel === "..") {
    throw new PathConfinementError("Source file is outside mailbox Maildir.");
  }

  const posixParts = rel.split(sep).filter(Boolean);
  if (
    posixParts.length < 2 ||
    (posixParts[0] !== "new" && posixParts[0] !== "cur") ||
    posixParts.some((part) => part === "." || part === ".." || part.includes("\0"))
  ) {
    throw new PathConfinementError(
      "Source file must be located inside Maildir/new or Maildir/cur.",
    );
  }

  return posixParts.join("/");
}

export async function iterMaildirFiles(
  mailStorageRoot: string,
  domainName: string,
  localPart: string,
): Promise<Array<{ readonly sourceFileKey: string; readonly fullPath: string }>> {
  const discovered: Array<{ readonly sourceFileKey: string; readonly fullPath: string }> = [];

  for (const folderName of ["new", "cur"] as const) {
    let folderPath: string;
    try {
      folderPath = confinedPath(
        mailStorageRoot,
        domainName,
        localPart,
        "Maildir",
        folderName,
      );
    } catch (error) {
      if (error instanceof PathConfinementError) {
        throw error;
      }
      continue;
    }

    let folderStat;
    try {
      folderStat = await lstat(folderPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    if (folderStat.isSymbolicLink() || !folderStat.isDirectory()) {
      throw new PathConfinementError(
        `Maildir ${folderName} directory is unsafe.`,
      );
    }

    const entries = await readdir(folderPath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isFile()) {
        continue;
      }
      const fullPath = confinedPath(
        mailStorageRoot,
        domainName,
        localPart,
        "Maildir",
        folderName,
        entry.name,
      );
      const fileStat = await lstat(fullPath);
      if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
        continue;
      }
      discovered.push({
        sourceFileKey: `${folderName}/${entry.name}`,
        fullPath,
      });
    }
  }

  return discovered;
}

export async function ingestMaildirFile(
  prisma: IngestionPrismaClient,
  mailbox: IngestionMailboxTarget,
  sourcePath: string,
  config: IngestionRuntimeConfig,
  options: { readonly dryRun?: boolean } = {},
): Promise<IngestFileOutcome> {
  const dryRun = options.dryRun === true;
  const key = resolveMaildirSourceKey(
    config.mailStorageRoot,
    mailbox.domain.name,
    mailbox.localPart,
    sourcePath,
  );

  const existing = await prisma.message.findUnique({
    where: {
      mailboxId_sourceFileKey: {
        mailboxId: mailbox.id,
        sourceFileKey: key,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return "duplicate";
  }

  let fileStat;
  try {
    fileStat = await lstat(sourcePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return "skipped_missing";
    }
    throw error;
  }

  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    throw new PathConfinementError("Maildir message must be a regular file.");
  }

  const sourceReceivedAt = new Date(
    Number.isFinite(fileStat.mtimeMs) ? fileStat.mtimeMs : Date.now(),
  );
  const maxMessageBytes = config.maxMessageSizeMb * 1024 * 1024;

  if (fileStat.size > maxMessageBytes) {
    const digest = await sha256FileStream(sourcePath);
    if (!dryRun) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.message.create({
            data: {
              mailboxId: mailbox.id,
              sourceFileKey: key,
              sourceSha256: digest,
              subject: "(Oversized message not indexed)",
              receivedAt: sourceReceivedAt,
              parsedAt: new Date(),
              sizeBytes: BigInt(fileStat.size),
              parseStatus: "oversized",
              parseWarning: `Message exceeds ${config.maxMessageSizeMb} MB`,
            },
            select: { id: true, uuid: true },
          });
          await recalculateMailboxCounters(tx, mailbox.id);
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return "duplicate";
        }
        throw error;
      }
    }

    logger.warn("oversized_message", {
      mailbox: mailbox.emailAddress,
      sourceFileKey: key,
      sizeBytes: fileStat.size,
    });
    return "oversized";
  }

  let raw: Uint8Array;
  try {
    raw = await readFile(sourcePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return "skipped_missing";
    }
    throw error;
  }

  const digest = sha256Bytes(raw);
  const parsed = await parseEmailMessage(raw, {
    maxAttachmentsPerMessage: config.maxAttachmentsPerMessage,
  });

  if (dryRun) {
    return "created";
  }

  const storedAttachments: Array<{
    readonly storageRelativePath: string;
    readonly storedFilename: string;
    readonly safeFilename: string;
    readonly detectedMimeType: string;
    readonly sizeBytes: number;
    readonly sha256: string;
    readonly originalFilename: string;
    readonly declaredMimeType: string;
    readonly isInline: boolean;
    readonly contentId: string;
  }> = [];

  const warnings = [...parsed.warnings];

  try {
    for (const item of parsed.attachments) {
      try {
        const stored = await storeConfinedAttachment(
          item.content,
          item.originalFilename,
          {
            attachmentStorageRoot: config.attachmentStorageRoot,
            maxAttachmentSizeMb: config.maxAttachmentSizeMb,
            declaredMimeType: item.declaredMimeType,
          },
        );
        storedAttachments.push({
          ...stored,
          originalFilename: item.originalFilename.slice(0, 1000),
          declaredMimeType: item.declaredMimeType.slice(0, 255),
          isInline: item.isInline,
          contentId: item.contentId.slice(0, 998),
        });
      } catch (error) {
        if (error instanceof AttachmentTooLargeError) {
          warnings.push(`Attachment skipped: ${error.message}`);
          continue;
        }
        throw error;
      }
    }

    const parseStatus = parsed.parseFailed
      ? "error"
      : warnings.length > 0
        ? "warning"
        : "ok";
    const parseWarning = warnings.join("; ").slice(0, 4000);

    const createdRecord = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          mailboxId: mailbox.id,
          sourceFileKey: key,
          sourceSha256: digest,
          messageIdHeader: parsed.messageIdHeader,
          senderName: parsed.senderName,
          senderAddress: parsed.senderAddress,
          recipientAddresses: [...parsed.recipientAddresses],
          ccAddresses: [...parsed.ccAddresses],
          subject: parsed.subject,
          receivedAt: parsed.receivedAt ?? sourceReceivedAt,
          parsedAt: new Date(),
          textBody: parsed.textBody,
          sanitizedHtmlBody: parsed.sanitizedHtmlBody,
          sizeBytes: BigInt(raw.byteLength),
          hasAttachments: storedAttachments.length > 0,
          parseStatus,
          parseWarning,
        },
        select: { id: true, uuid: true },
      });

      for (const att of storedAttachments) {
        await tx.attachment.create({
          data: {
            messageId: created.id,
            originalFilename: att.originalFilename,
            safeFilename: att.safeFilename,
            storedFilename: att.storedFilename,
            declaredMimeType: att.declaredMimeType,
            detectedMimeType: att.detectedMimeType,
            sizeBytes: BigInt(att.sizeBytes),
            sha256: att.sha256,
            storageRelativePath: att.storageRelativePath,
            isInline: att.isInline,
            contentId: att.contentId,
          },
        });
      }

      await recalculateMailboxCounters(tx, mailbox.id);
      return created;
    });

    logger.info("message_ingested", {
      mailbox: mailbox.emailAddress,
      sourceFileKey: key,
      messageUuid: createdRecord.uuid,
      parseStatus,
    });
    return "created";
  } catch (error) {
    for (const att of storedAttachments) {
      await removeConfinedStoredAttachment(
        config.attachmentStorageRoot,
        att.storageRelativePath,
      ).catch(() => undefined);
    }

    if (isUniqueConstraintError(error)) {
      return "duplicate";
    }

    const errorType = error instanceof Error ? error.name : "IngestionError";
    await recordAudit(prisma, {
      action: "ingestion_error",
      targetType: "mailbox",
      targetIdentifier: mailbox.emailAddress,
      details: {
        source_file_key: key,
        error_type: errorType,
      },
    });
    logger.error("message_ingestion_failed", {
      mailbox: mailbox.emailAddress,
      sourceFileKey: key,
      errorType,
    });
    throw error;
  }
}

async function acquireIngestionLock(
  lockFilePath: string,
): Promise<(() => Promise<void>) | null> {
  const lockDir = dirname(lockFilePath);
  const lockName = basename(lockFilePath) || "readbox-ingestion.lock";
  await mkdir(lockDir, { recursive: true, mode: 0o700 });
  const dirStat = await lstat(lockDir);
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
    throw new PathConfinementError("Ingestion lock directory is unsafe.");
  }
  await chmod(lockDir, 0o700);

  const safeTarget = confinedPath(lockDir, lockName);
  const safeLockDir = confinedPath(lockDir, `${lockName}.lock`);
  const handle = await open(safeTarget, "a", 0o600);
  await handle.close();

  try {
    return await lockfile.lock(safeTarget, {
      lockfilePath: safeLockDir,
      stale: 60_000,
      retries: {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 400,
      },
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ELOCKED") {
      return null;
    }
    throw error;
  }
}

async function upsertHeartbeat(
  prisma: IngestionPrismaClient,
  status: "running" | "healthy" | "degraded",
  details: Record<string, unknown>,
): Promise<void> {
  const now = new Date();
  await prisma.serviceHeartbeat.upsert({
    where: { serviceName: "maildir_ingestion" },
    create: {
      serviceName: "maildir_ingestion",
      status,
      details,
      lastSeenAt: now,
    },
    update: {
      status,
      details,
      lastSeenAt: now,
    },
  });
}

export async function ingestUnindexedMaildirFiles(
  prisma: IngestionPrismaClient,
  config: IngestionRuntimeConfig,
  options: {
    readonly mailboxUuid?: string;
    readonly mailboxLocalPart?: string;
    readonly dryRun?: boolean;
    readonly bypassLock?: boolean;
  } = {},
): Promise<IngestionRunSummary> {
  const startedAt = new Date().toISOString();
  const dryRun = options.dryRun === true;
  const counts: IngestionResultCounts = {
    scanned: 0,
    created: 0,
    duplicates: 0,
    oversized: 0,
    skippedMissing: 0,
    errors: 0,
  };
  const errorSamples: string[] = [];

  let releaseLock: (() => Promise<void>) | null = null;
  if (!dryRun && !options.bypassLock) {
    releaseLock = await acquireIngestionLock(config.ingestionLockFile);
    if (!releaseLock) {
      logger.warn("ingestion_lock_busy");
      return {
        ...counts,
        status: "lock_busy",
        dryRun,
        startedAt,
        finishedAt: new Date().toISOString(),
        errorSamples: ["Ingestion lock is currently held by another run."],
      };
    }
  }

  try {
    if (!dryRun) {
      await upsertHeartbeat(prisma, "running", {
        dryRun,
        mailboxUuid: options.mailboxUuid ?? null,
        mailboxLocalPart: options.mailboxLocalPart ?? null,
      });
    }

    const where: Record<string, unknown> = { deletedAt: null };
    if (options.mailboxUuid) {
      where.uuid = options.mailboxUuid.trim();
    } else if (options.mailboxLocalPart) {
      where.localPart = {
        equals: options.mailboxLocalPart.trim().toLowerCase(),
        mode: "insensitive",
      };
    }

    const mailboxes = await prisma.mailbox.findMany({
      where,
      select: {
        id: true,
        uuid: true,
        localPart: true,
        emailAddress: true,
        domain: { select: { name: true } },
      },
      orderBy: { id: "asc" },
    });

    for (const mailbox of mailboxes) {
      let files: Array<{ readonly sourceFileKey: string; readonly fullPath: string }>;
      try {
        files = await iterMaildirFiles(
          config.mailStorageRoot,
          mailbox.domain.name,
          mailbox.localPart,
        );
      } catch (error) {
        counts.errors += 1;
        if (errorSamples.length < 25) {
          const reason =
            error instanceof PathConfinementError
              ? error.message
              : "Unable to scan Maildir directory safely";
          errorSamples.push(`${mailbox.emailAddress}: ${reason}`);
        }
        continue;
      }

      for (const item of files) {
        counts.scanned += 1;
        try {
          const outcome = await ingestMaildirFile(
            prisma,
            mailbox,
            item.fullPath,
            config,
            { dryRun },
          );
          if (outcome === "created") counts.created += 1;
          else if (outcome === "duplicate") counts.duplicates += 1;
          else if (outcome === "oversized") counts.oversized += 1;
          else if (outcome === "skipped_missing") counts.skippedMissing += 1;
        } catch (error) {
          counts.errors += 1;
          if (errorSamples.length < 25) {
            const label =
              error instanceof Error ? error.name : "IngestionError";
            errorSamples.push(
              `${mailbox.emailAddress} (${item.sourceFileKey}): ${label}`,
            );
          }
        }
      }
    }

    const status = counts.errors === 0 ? "healthy" : "degraded";
    if (!dryRun) {
      await upsertHeartbeat(prisma, status, {
        ...counts,
        dryRun,
      });
    }

    return {
      ...counts,
      status,
      dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      errorSamples,
    };
  } finally {
    if (releaseLock) {
      await releaseLock().catch(() => undefined);
    }
  }
}
