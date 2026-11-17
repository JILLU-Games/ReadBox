"use server";

import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  bulkPurgeMailboxes,
  createSystemMailbox,
  provisionMailbox,
  purgeMailbox,
  setMailboxActive,
  type MailboxActionResult,
  type MailboxPrismaClient,
  type MailboxRuntimeConfig,
} from "@/core/mailboxes/service";
import type { SystemMailboxLocalPart } from "@/core/mailboxes/validators";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

function mailboxRuntimeConfig(): MailboxRuntimeConfig {
  return {
    mailDomain: env.mailDomain,
    mailStorageRoot: env.mailStorageRoot,
    attachmentStorageRoot: env.attachmentStorageRoot,
    mailboxProvisionLockRoot: env.mailboxProvisionLockRoot,
    defaultQuotaBytes: env.mailboxDefaultQuotaBytes,
  };
}

function databaseUnavailableResult(): MailboxActionResult<never> {
  return {
    ok: false,
    code: "unavailable",
    error:
      "Database is not connected in this local environment. Configure DATABASE_URL to provision and manage mailboxes.",
  };
}

function revalidateMailboxPaths() {
  revalidatePath("/vcon/mailboxes");
  revalidatePath("/vcon");
  revalidatePath("/vcon/users");
  revalidatePath("/vcon/audit");
}

export async function provisionMailboxAction(input: {
  readonly localPart: string;
  readonly domainUuid?: string;
  readonly assignedUserIds: readonly string[];
}): Promise<
  MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await provisionMailbox(
    getPrismaClient() as unknown as MailboxPrismaClient,
    input,
    mailboxRuntimeConfig(),
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateMailboxPaths();
  }

  return result;
}

export async function setMailboxActiveAction(
  uuid: string,
  active: boolean,
): Promise<MailboxActionResult<{ uuid: string; status: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await setMailboxActive(
    getPrismaClient() as unknown as MailboxPrismaClient,
    uuid,
    active,
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateMailboxPaths();
  }

  return result;
}

export async function purgeMailboxAction(
  uuid: string,
  confirmationEmail: string,
): Promise<MailboxActionResult<{ emailAddress: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await purgeMailbox(
    getPrismaClient() as unknown as MailboxPrismaClient,
    uuid,
    confirmationEmail,
    mailboxRuntimeConfig(),
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateMailboxPaths();
  }

  return result;
}

export async function bulkPurgeMailboxesAction(
  mailboxUuids: readonly string[],
  confirmed: boolean,
): Promise<MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await bulkPurgeMailboxes(
    getPrismaClient() as unknown as MailboxPrismaClient,
    mailboxUuids,
    confirmed,
    mailboxRuntimeConfig(),
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateMailboxPaths();
  }

  return result;
}

export async function createSystemMailboxAction(input: {
  readonly localPart: SystemMailboxLocalPart;
  readonly domainUuid?: string;
  readonly confirm: boolean;
}): Promise<
  MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await createSystemMailbox(
    getPrismaClient() as unknown as MailboxPrismaClient,
    input,
    mailboxRuntimeConfig(),
    {
      actorId: actor.id,
      authSource: actor.authSource,
      actorUsername: actor.username,
      headers: requestHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
  );

  if (result.ok) {
    revalidateMailboxPaths();
  }

  return result;
}
