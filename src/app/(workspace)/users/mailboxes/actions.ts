"use server";

import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import type {
  MailboxActionResult,
  MailboxPrismaClient,
} from "@/core/mailboxes/service";
import {
  bulkDeleteDemoMailboxes,
  createDemoMailbox,
  deleteDemoMailbox,
  isDemoPreviewWorkspaceActive,
} from "@/core/messages/demo-workspace";
import {
  bulkDeleteUserMailboxes,
  createUserSelfMailbox,
  deleteUserMailbox,
} from "@/core/messages/service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

function getRuntimeConfig() {
  return {
    mailDomain: env.mailDomain,
    mailStorageRoot: env.mailStorageRoot,
    attachmentStorageRoot: env.attachmentStorageRoot,
    mailboxProvisionLockRoot: env.mailboxProvisionLockRoot,
    defaultQuotaBytes: env.mailboxDefaultQuotaBytes,
  };
}

function revalidateUsersWorkspace() {
  revalidatePath("/users", "layout");
  revalidatePath("/users");
  revalidatePath("/users/mailboxes");
}

export async function createUserMailboxAction(input: {
  readonly localPart: string;
  readonly domainUuid?: string;
}): Promise<
  MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
> {
  const user = await requireWorkspaceUser();
  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const demoResult = createDemoMailbox(input, {
        isAdministrator: user.isAdministrator,
        userId: user.id,
      });
      if (demoResult.ok) {
        revalidateUsersWorkspace();
      }
      return demoResult;
    }
    return {
      ok: false,
      code: "unavailable",
      error: "Database is not configured in this environment.",
    };
  }

  const reqHeaders = await headers();
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  const result = await createUserSelfMailbox(
    getPrismaClient() as unknown as MailboxPrismaClient,
    {
      userId,
      username: user.username,
      isAdministrator: user.isAdministrator,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    input,
    getRuntimeConfig(),
  );

  if (result.ok) {
    revalidateUsersWorkspace();
  }

  return result;
}

export async function deleteUserMailboxAction(input: {
  readonly mailboxUuid: string;
  readonly confirmationEmail: string;
}): Promise<MailboxActionResult<{ emailAddress: string }>> {
  const user = await requireWorkspaceUser();
  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const demoResult = deleteDemoMailbox(
        input.mailboxUuid,
        input.confirmationEmail,
        {
          isAdministrator: user.isAdministrator,
          userId: user.id,
        },
      );
      if (demoResult.ok) {
        revalidateUsersWorkspace();
      }
      return demoResult;
    }
    return {
      ok: false,
      code: "unavailable",
      error: "Database is not configured in this environment.",
    };
  }

  const reqHeaders = await headers();
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  const result = await deleteUserMailbox(
    getPrismaClient() as unknown as MailboxPrismaClient,
    {
      userId,
      username: user.username,
      isAdministrator: user.isAdministrator,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    input.mailboxUuid,
    input.confirmationEmail,
    getRuntimeConfig(),
  );

  if (result.ok) {
    revalidateUsersWorkspace();
  }

  return result;
}

export async function bulkDeleteUserMailboxesAction(input: {
  readonly mailboxUuids: readonly string[];
  readonly confirmed: boolean;
}): Promise<
  MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }>
> {
  const user = await requireWorkspaceUser();
  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const demoResult = bulkDeleteDemoMailboxes(
        input.mailboxUuids,
        input.confirmed,
        {
          isAdministrator: user.isAdministrator,
          userId: user.id,
        },
      );
      if (demoResult.ok) {
        revalidateUsersWorkspace();
      }
      return demoResult;
    }
    return {
      ok: false,
      code: "unavailable",
      error: "Database is not configured in this environment.",
    };
  }

  const reqHeaders = await headers();
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  const result = await bulkDeleteUserMailboxes(
    getPrismaClient() as unknown as MailboxPrismaClient,
    {
      userId,
      username: user.username,
      isAdministrator: user.isAdministrator,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    input.mailboxUuids,
    input.confirmed,
    getRuntimeConfig(),
  );

  if (result.ok) {
    revalidateUsersWorkspace();
  }

  return result;
}
