import {
  markMessageUnreadAction,
  softDeleteMessageAction,
} from "@/app/(workspace)/users/inbox/[mailboxUuid]/[messageUuid]/actions";
import { MailboxInboxView } from "@/components/users/mailbox-inbox-view";
import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  getDemoMessageDetail,
  isDemoPreviewWorkspaceActive,
  listDemoMailboxMessages,
} from "@/core/messages/demo-workspace";
import {
  getMessageDetailForUser,
  listMailboxMessagesForUser,
} from "@/core/messages/service";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function UserMessageDetailPage(props: {
  params: Promise<{ mailboxUuid: string; messageUuid: string }>;
  searchParams: Promise<{
    q?: string;
    read?: string;
    unread?: string;
    attachments?: string;
    page?: string;
  }>;
}) {
  const user = await requireWorkspaceUser();
  const demoActive = isDemoPreviewWorkspaceActive();
  if (!env.databaseUrl && !demoActive) {
    notFound();
  }

  const [{ mailboxUuid, messageUuid }, searchParams, reqHeaders] =
    await Promise.all([props.params, props.searchParams, headers()]);

  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  const readParam =
    searchParams.read ?? (searchParams.unread === "1" ? "unread" : undefined);
  const filters = {
    query: searchParams.q,
    read: readParam,
    attachments: searchParams.attachments,
    page: Number(searchParams.page) || 1,
  };

  const actor = {
    userId,
    authSource: user.authSource,
    username: user.username,
    isAdministrator: user.isAdministrator,
    headers: reqHeaders,
    trustProxyHeaders: env.trustProxyHeaders,
  };

  // Resolve message detail first so read-state updates reflect in the inbox list & counters
  const message = env.databaseUrl
    ? await getMessageDetailForUser(
        getPrismaClient(),
        actor,
        mailboxUuid,
        messageUuid,
      )
    : getDemoMessageDetail(mailboxUuid, messageUuid, {
        isAdministrator: user.isAdministrator,
        userId: user.id,
      });

  if (!message) {
    notFound();
  }

  const inboxResult = env.databaseUrl
    ? await listMailboxMessagesForUser(
        getPrismaClient(),
        actor,
        mailboxUuid,
        filters,
      )
    : listDemoMailboxMessages(
        mailboxUuid,
        filters,
        user.isAdministrator,
        user.id,
      );

  if (!inboxResult) {
    notFound();
  }

  return (
    <MailboxInboxView
      inboxResult={inboxResult}
      activeMessage={message}
      markUnreadAction={markMessageUnreadAction}
      deleteMessageAction={softDeleteMessageAction}
    />
  );
}
