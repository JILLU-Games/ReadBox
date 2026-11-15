"use server";

import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import type { BodyRepairBatchSummary } from "@/core/ingestion/repair";
import type { IngestionRunSummary } from "@/core/ingestion/service";
import {
  runProvisionMaildirs,
  runRebuildMailIndex,
  runRepairMessageBodies,
  runSyncMailserverMailboxes,
  runUpdateMailboxCounters,
  runVerifyPostfixContract,
  type MaildirProvisionSummary,
  type MailserverSyncSummary,
  type OperationsActionResult,
  type OperationsPrismaClient,
  type OperationsRuntimeConfig,
} from "@/core/operations/service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

function operationsConfig(): OperationsRuntimeConfig {
  return {
    mailStorageRoot: env.mailStorageRoot,
    attachmentStorageRoot: env.attachmentStorageRoot,
    ingestionLockFile: env.ingestionLockFile,
    mailboxProvisionLockRoot: env.mailboxProvisionLockRoot,
    ingestionStaleAfterSeconds: env.ingestionStaleAfterSeconds,
    maxMessageSizeMb: env.maxMessageSizeMb,
    maxAttachmentSizeMb: env.maxAttachmentSizeMb,
    maxAttachmentsPerMessage: env.maxAttachmentsPerMessage,
  };
}

function databaseUnavailableResult(): OperationsActionResult<never> {
  return {
    ok: false,
    code: "unavailable",
    error:
      "Database is not connected in this local environment. Configure DATABASE_URL to run operations.",
  };
}

function revalidateOperationsPaths() {
  revalidatePath("/vcon/operations");
  revalidatePath("/vcon");
  revalidatePath("/vcon/mailboxes");
  revalidatePath("/vcon/domains");
  revalidatePath("/vcon/audit");
}

export async function verifyPostfixContractAction(): Promise<
  OperationsActionResult<{
    readonly domains: number;
    readonly mailboxes: number;
    readonly postfixRows: number;
  }>
> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) return databaseUnavailableResult();

  const requestHeaders = await headers();
  const result = await runVerifyPostfixContract(
    getPrismaClient() as unknown as OperationsPrismaClient,
    {
      actorId: actor.id,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );
  if (result.ok) revalidateOperationsPaths();
  return result;
}

export async function syncMailserverMailboxesAction(input: {
  readonly dryRun: boolean;
  readonly strict: boolean;
}): Promise<OperationsActionResult<MailserverSyncSummary>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) return databaseUnavailableResult();

  const requestHeaders = await headers();
  const result = await runSyncMailserverMailboxes(
    getPrismaClient() as unknown as OperationsPrismaClient,
    input,
    {
      actorId: actor.id,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );
  if (result.ok && !input.dryRun) revalidateOperationsPaths();
  return result;
}

export async function provisionMaildirsAction(input: {
  readonly mailboxUuid?: string;
}): Promise<OperationsActionResult<MaildirProvisionSummary>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) return databaseUnavailableResult();

  const requestHeaders = await headers();
  const result = await runProvisionMaildirs(
    getPrismaClient() as unknown as OperationsPrismaClient,
    operationsConfig(),
    input,
    {
      actorId: actor.id,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );
  if (result.ok) revalidateOperationsPaths();
  return result;
}

export async function rebuildMailIndexAction(input: {
  readonly dryRun: boolean;
  readonly mailboxUuid?: string;
}): Promise<OperationsActionResult<IngestionRunSummary>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) return databaseUnavailableResult();

  const requestHeaders = await headers();
  const result = await runRebuildMailIndex(
    getPrismaClient() as unknown as OperationsPrismaClient,
    operationsConfig(),
    input,
    {
      actorId: actor.id,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );
  if (result.ok && !input.dryRun) revalidateOperationsPaths();
  return result;
}

export async function recalculateCountersAction(input: {
  readonly mailboxUuid?: string;
}): Promise<OperationsActionResult<{ readonly updatedCount: number }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) return databaseUnavailableResult();

  const requestHeaders = await headers();
  const result = await runUpdateMailboxCounters(
    getPrismaClient() as unknown as OperationsPrismaClient,
    input,
    {
      actorId: actor.id,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );
  if (result.ok) revalidateOperationsPaths();
  return result;
}

export async function repairMessageBodiesAction(input: {
  readonly dryRun: boolean;
  readonly confirmRepair: boolean;
  readonly limit: number;
  readonly mailboxUuid?: string;
}): Promise<OperationsActionResult<BodyRepairBatchSummary>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) return databaseUnavailableResult();

  const requestHeaders = await headers();
  const result = await runRepairMessageBodies(
    getPrismaClient() as unknown as OperationsPrismaClient,
    operationsConfig(),
    input,
    {
      actorId: actor.id,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );
  if (result.ok && !input.dryRun) revalidateOperationsPaths();
  return result;
}
