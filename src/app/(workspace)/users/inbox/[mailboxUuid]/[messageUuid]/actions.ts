"use server";

import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  isDemoPreviewWorkspaceActive,
  markDemoMessageUnread,
  softDeleteDemoMessage,
} from "@/core/messages/demo-workspace";
import {
  markMessageUnreadForUser,
  softDeleteMessageForUser,
  type MessageActionResult,
} from "@/core/messages/service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

function revalidateMailboxPaths(mailboxUuid: string) {
  revalidatePath("/users", "layout");
  revalidatePath("/users");
  revalidatePath("/users/mailboxes");
  revalidatePath(`/users/inbox/${mailboxUuid}`);
}

export async function markMessageUnreadAction(input: {
  readonly mailboxUuid: string;
  readonly messageUuid: string;
}): Promise<MessageActionResult<{ uuid: string; isRead: boolean }>> {
  const user = await requireWorkspaceUser();
  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const demoResult = markDemoMessageUnread(
        input.mailboxUuid,
        input.messageUuid,
      );
      if (demoResult.ok) {
        revalidateMailboxPaths(input.mailboxUuid);
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

  const result = await markMessageUnreadForUser(
    getPrismaClient(),
    {
      userId,
      username: user.username,
      isAdministrator: user.isAdministrator,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    input.mailboxUuid,
    input.messageUuid,
  );

  if (result.ok) {
    revalidateMailboxPaths(input.mailboxUuid);
  }

  return result;
}

export async function softDeleteMessageAction(input: {
  readonly mailboxUuid: string;
  readonly messageUuid: string;
}): Promise<MessageActionResult<{ uuid: string }>> {
  const user = await requireWorkspaceUser();
  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const demoResult = softDeleteDemoMessage(
        input.mailboxUuid,
        input.messageUuid,
      );
      if (demoResult.ok) {
        revalidateMailboxPaths(input.mailboxUuid);
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

  const result = await softDeleteMessageForUser(
    getPrismaClient(),
    {
      userId,
      username: user.username,
      isAdministrator: user.isAdministrator,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    input.mailboxUuid,
    input.messageUuid,
  );

  if (result.ok) {
    revalidateMailboxPaths(input.mailboxUuid);
  }

  return result;
}
