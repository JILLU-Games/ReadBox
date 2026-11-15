import {
  markMessageUnreadAction,
  softDeleteMessageAction,
} from "@/app/(workspace)/users/inbox/[mailboxUuid]/[messageUuid]/actions";
import { MessageReaderView } from "@/components/users/message-reader-view";
import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { getMessageDetailForUser } from "@/core/messages/service";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function UserMessageDetailPage(props: {
  params: Promise<{ mailboxUuid: string; messageUuid: string }>;
}) {
  const user = await requireWorkspaceUser();
  if (!env.databaseUrl) {
    notFound();
  }

  const [{ mailboxUuid, messageUuid }, reqHeaders] = await Promise.all([
    props.params,
    headers(),
  ]);

  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  const message = await getMessageDetailForUser(
    getPrismaClient(),
    {
      userId,
      username: user.username,
      isAdministrator: user.isAdministrator,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    mailboxUuid,
    messageUuid,
  );

  if (!message) {
    notFound();
  }

  return (
    <MessageReaderView
      message={message}
      markUnreadAction={markMessageUnreadAction}
      deleteMessageAction={softDeleteMessageAction}
    />
  );
}
