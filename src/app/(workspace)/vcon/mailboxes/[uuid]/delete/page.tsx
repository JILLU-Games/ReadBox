import { purgeMailboxAction } from "@/app/(workspace)/vcon/mailboxes/actions";
import { AlertBanner } from "@/components/ui";
import { MailboxPurgeConfirm } from "@/components/vcon/mailbox-purge-confirm";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  getMailboxForPurge,
  type MailboxPurgePreview,
} from "@/core/mailboxes/service";
import { logger } from "@/core/server/logger";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPurgeMailboxPage({
  params,
}: {
  readonly params: Promise<{ uuid: string }>;
}) {
  await requireAdminUser();
  const { uuid } = await params;

  if (!env.databaseUrl) {
    return (
      <AlertBanner variant="warning" role="status">
        Database is not configured in this local environment. Configure
        DATABASE_URL to manage persistent mailboxes.
      </AlertBanner>
    );
  }

  let mailbox: MailboxPurgePreview | null = null;
  let loadFailed = false;

  try {
    mailbox = await getMailboxForPurge(getPrismaClient(), uuid);
  } catch {
    loadFailed = true;
    logger.error("admin_mailbox_purge_load_failed");
  }

  if (loadFailed) {
    return (
      <AlertBanner variant="error">
        Unable to load mailbox details right now.
      </AlertBanner>
    );
  }

  if (!mailbox) {
    notFound();
  }

  return (
    <MailboxPurgeConfirm
      mailbox={mailbox}
      onPurge={purgeMailboxAction}
    />
  );
}
