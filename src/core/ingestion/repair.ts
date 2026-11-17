import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { parseEmailMessage, sha256Bytes } from "@/core/ingestion/parser";
import { confinedPath, PathConfinementError } from "@/core/mailboxes/paths";
import { isValidUuid } from "@/core/mailboxes/validators";
import { logger } from "@/core/server/logger";
import { lstat, readFile } from "node:fs/promises";
import "server-only";

export type RepairErrorCode =
  | "unsafe_key"
  | "source_missing"
  | "source_too_large"
  | "source_mismatch"
  | "db_changed";

export class BodyRepairError extends Error {
  readonly code: RepairErrorCode;

  constructor(code: RepairErrorCode, message: string) {
    super(message);
    this.name = "BodyRepairError";
    this.code = code;
  }
}

export interface RepairTargetMessage {
  readonly id: bigint;
  readonly uuid: string;
  readonly sourceFileKey: string;
  readonly sourceSha256: string;
  readonly textBody: string;
  readonly sanitizedHtmlBody: string;
  readonly mailbox: {
    readonly localPart: string;
    readonly emailAddress: string;
    readonly domain: { readonly name: string };
  };
}

export interface RepairRuntimeConfig {
  readonly mailStorageRoot: string;
  readonly maxMessageSizeMb: number;
  readonly maxAttachmentsPerMessage: number;
}

export interface BodyRepairSingleResult {
  readonly status: "unchanged" | "would_update" | "updated";
  readonly warningCount: number;
}

export interface BodyRepairBatchSummary {
  readonly dryRun: boolean;
  readonly scanned: number;
  readonly updated: number;
  readonly wouldUpdate: number;
  readonly unchanged: number;
  readonly missing: number;
  readonly mismatched: number;
  readonly oversized: number;
  readonly errors: number;
  readonly issueSamples: readonly string[];
}

export interface RepairTxClient {
  message: {
    findUnique(args: {
      where: { id: bigint };
      select: { id: true; sourceFileKey: true; sourceSha256: true };
    }): Promise<{
      id: bigint;
      sourceFileKey: string;
      sourceSha256: string;
    } | null>;
    update(args: {
      where: { id: bigint };
      data: { textBody: string; sanitizedHtmlBody: string };
    }): Promise<unknown>;
  };
}

export type RepairPrismaClient = RepairTxClient &
  AuditWriteClient & {
    message: RepairTxClient["message"] & {
      findMany(args: {
        where: Record<string, unknown>;
        orderBy: Array<Record<string, "asc" | "desc">>;
        take: number;
        select: {
          id: true;
          uuid: true;
          sourceFileKey: true;
          sourceSha256: true;
          textBody: true;
          sanitizedHtmlBody: true;
          mailbox: {
            select: {
              localPart: true;
              emailAddress: true;
              domain: { select: { name: true } };
            };
          };
        };
      }): Promise<RepairTargetMessage[]>;
    };
    $transaction<T>(fn: (tx: RepairTxClient) => Promise<T>): Promise<T>;
  };

export function sourcePathForMessage(
  mailStorageRoot: string,
  domainName: string,
  localPart: string,
  sourceFileKey: string,
): string {
  const trimmed = (sourceFileKey ?? "").trim();
  if (!trimmed || trimmed.startsWith("/") || trimmed.includes("\\")) {
    throw new BodyRepairError("unsafe_key", "Unsafe source_file_key.");
  }

  const parts = trimmed.split("/");
  if (
    parts.length < 2 ||
    (parts[0] !== "new" && parts[0] !== "cur") ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new BodyRepairError("unsafe_key", "Unsafe source_file_key.");
  }

  try {
    return confinedPath(
      mailStorageRoot,
      domainName,
      localPart,
      "Maildir",
      ...parts,
    );
  } catch (error) {
    if (error instanceof PathConfinementError) {
      throw new BodyRepairError("unsafe_key", error.message);
    }
    throw new BodyRepairError("unsafe_key", "Unsafe Maildir source path.");
  }
}

export async function repairMessageBodies(
  prisma: RepairPrismaClient,
  message: RepairTargetMessage,
  config: RepairRuntimeConfig,
  options: { readonly dryRun?: boolean } = {},
): Promise<BodyRepairSingleResult> {
  const dryRun = options.dryRun === true;
  const sourcePath = sourcePathForMessage(
    config.mailStorageRoot,
    message.mailbox.domain.name,
    message.mailbox.localPart,
    message.sourceFileKey,
  );

  let stat;
  try {
    stat = await lstat(sourcePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new BodyRepairError(
        "source_missing",
        "Original Maildir source file is missing.",
      );
    }
    throw error;
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new BodyRepairError(
      "unsafe_key",
      "Original Maildir source is not a regular file.",
    );
  }

  const maxBytes = config.maxMessageSizeMb * 1024 * 1024;
  if (stat.size > maxBytes) {
    throw new BodyRepairError(
      "source_too_large",
      "Source exceeds configured maximum message size.",
    );
  }

  const raw = await readFile(sourcePath);
  if (sha256Bytes(raw) !== message.sourceSha256) {
    throw new BodyRepairError(
      "source_mismatch",
      "Maildir source SHA-256 does not match the indexed message.",
    );
  }

  const parsed = await parseEmailMessage(raw, {
    maxAttachmentsPerMessage: config.maxAttachmentsPerMessage,
  });

  const changed =
    parsed.textBody !== message.textBody ||
    parsed.sanitizedHtmlBody !== message.sanitizedHtmlBody;

  if (!changed) {
    return { status: "unchanged", warningCount: parsed.warnings.length };
  }

  if (dryRun) {
    return { status: "would_update", warningCount: parsed.warnings.length };
  }

  await prisma.$transaction(async (tx) => {
    const locked = await tx.message.findUnique({
      where: { id: message.id },
      select: { id: true, sourceFileKey: true, sourceSha256: true },
    });
    if (
      !locked ||
      locked.sourceFileKey !== message.sourceFileKey ||
      locked.sourceSha256 !== message.sourceSha256
    ) {
      throw new BodyRepairError(
        "db_changed",
        "Indexed source identity changed during repair.",
      );
    }

    await tx.message.update({
      where: { id: locked.id },
      data: {
        textBody: parsed.textBody,
        sanitizedHtmlBody: parsed.sanitizedHtmlBody,
      },
    });
  });

  logger.info("message_body_repaired", {
    messageUuid: message.uuid,
    mailbox: message.mailbox.emailAddress,
  });

  return { status: "updated", warningCount: parsed.warnings.length };
}

export async function runMessageBodyRepairBatch(
  prisma: RepairPrismaClient,
  config: RepairRuntimeConfig,
  input: {
    readonly dryRun?: boolean;
    readonly confirmRepair?: boolean;
    readonly limit?: number;
    readonly mailboxUuid?: string;
  },
  auditCtx?: {
    readonly actorId?: bigint | null;
    readonly authSource?: "admin_table" | "user_table";
    readonly actorUsername?: string;
    readonly headers?: Pick<Headers, "get">;
    readonly trustProxyHeaders?: boolean;
  },
): Promise<
  | { readonly ok: true; readonly data: BodyRepairBatchSummary }
  | { readonly ok: false; readonly code: "validation"; readonly error: string }
> {
  const dryRun = input.dryRun === true;
  if (!dryRun && input.confirmRepair !== true) {
    return {
      ok: false,
      code: "validation",
      error: "Explicit confirmation is required before repairing message bodies.",
    };
  }

  const rawLimit = input.limit ?? 500;
  if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > 5000) {
    return {
      ok: false,
      code: "validation",
      error: "Repair limit must be between 1 and 5000 messages.",
    };
  }
  const limit = Math.floor(rawLimit);

  if (input.mailboxUuid && !isValidUuid(input.mailboxUuid)) {
    return {
      ok: false,
      code: "validation",
      error: "Select a valid mailbox UUID.",
    };
  }

  const where: Record<string, unknown> = {
    deletedAt: null,
    parseStatus: { not: "oversized" },
    mailbox: {
      deletedAt: null,
      ...(input.mailboxUuid ? { uuid: input.mailboxUuid.trim() } : {}),
    },
  };

  const candidates = await prisma.message.findMany({
    where,
    orderBy: [{ id: "asc" }],
    take: limit,
    select: {
      id: true,
      uuid: true,
      sourceFileKey: true,
      sourceSha256: true,
      textBody: true,
      sanitizedHtmlBody: true,
      mailbox: {
        select: {
          localPart: true,
          emailAddress: true,
          domain: { select: { name: true } },
        },
      },
    },
  });

  let updated = 0;
  let wouldUpdate = 0;
  let unchanged = 0;
  let missing = 0;
  let mismatched = 0;
  let oversized = 0;
  let errors = 0;
  const issueSamples: string[] = [];

  for (const msg of candidates) {
    try {
      const outcome = await repairMessageBodies(prisma, msg, config, {
        dryRun,
      });
      if (outcome.status === "updated") updated += 1;
      else if (outcome.status === "would_update") wouldUpdate += 1;
      else unchanged += 1;
    } catch (error) {
      if (error instanceof BodyRepairError) {
        if (error.code === "source_missing") missing += 1;
        else if (
          error.code === "source_mismatch" ||
          error.code === "db_changed"
        ) {
          mismatched += 1;
        } else if (error.code === "source_too_large") {
          oversized += 1;
        } else {
          errors += 1;
        }
        if (issueSamples.length < 20) {
          issueSamples.push(
            `${msg.mailbox.emailAddress} (${msg.uuid}): ${error.code}`,
          );
        }
      } else {
        errors += 1;
        if (issueSamples.length < 20) {
          issueSamples.push(
            `${msg.mailbox.emailAddress} (${msg.uuid}): unexpected_error`,
          );
        }
      }
    }
  }

  const summary: BodyRepairBatchSummary = {
    dryRun,
    scanned: candidates.length,
    updated,
    wouldUpdate,
    unchanged,
    missing,
    mismatched,
    oversized,
    errors,
    issueSamples,
  };

  if (!dryRun && auditCtx) {
    await recordAudit(prisma, {
      actorId: auditCtx.actorId ?? null,
      authSource: auditCtx.authSource,
      actorUsername: auditCtx.actorUsername,
      action: "message_body_repair_run",
      targetType: "mailbox",
      targetIdentifier: input.mailboxUuid?.trim() || "all",
      headers: auditCtx.headers,
      trustProxyHeaders: auditCtx.trustProxyHeaders,
      details: {
        scanned: summary.scanned,
        updated: summary.updated,
        unchanged: summary.unchanged,
        missing: summary.missing,
        mismatched: summary.mismatched,
        oversized: summary.oversized,
        errors: summary.errors,
      },
    });
  }

  return { ok: true, data: summary };
}
