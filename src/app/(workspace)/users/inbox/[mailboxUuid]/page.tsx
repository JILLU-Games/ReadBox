import { MailboxInboxView } from "@/components/users/mailbox-inbox-view";
import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { listMailboxMessagesForUser } from "@/core/messages/service";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function UserMailboxInboxPage(props: {
  params: Promise<{ mailboxUuid: string }>;
  searchParams: Promise<{
    q?: string;
    read?: string;
    unread?: string;
    attachments?: string;
    page?: string;
  }>;
}) {
  const user = await requireWorkspaceUser();
  if (!env.databaseUrl) {
    notFound();
  }

  const [{ mailboxUuid }, searchParams, reqHeaders] = await Promise.all([
    props.params,
    props.searchParams,
    headers(),
  ]);

  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  const readParam =
    searchParams.read ?? (searchParams.unread === "1" ? "unread" : undefined);

  const inboxResult = await listMailboxMessagesForUser(
    getPrismaClient(),
    {
      userId,
      username: user.username,
      isAdministrator: user.isAdministrator,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    mailboxUuid,
    {
      query: searchParams.q,
      read: readParam,
      attachments: searchParams.attachments,
      page: Number(searchParams.page) || 1,
    },
  );

  if (!inboxResult) {
    notFound();
  }

  return <MailboxInboxView inboxResult={inboxResult} />;
}
