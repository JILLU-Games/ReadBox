import { provisionMailboxAction } from "@/app/(workspace)/vcon/mailboxes/actions";
import { MailboxForm } from "@/components/vcon/mailbox-form";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  listMailboxCreationOptions,
  type MailboxCreationOptions,
} from "@/core/mailboxes/service";
import { logger } from "@/core/server/logger";

export const dynamic = "force-dynamic";

export default async function AdminNewMailboxPage() {
  await requireAdminUser();

  let options: MailboxCreationOptions = { domains: [], users: [] };
  if (env.databaseUrl) {
    try {
      options = await listMailboxCreationOptions(getPrismaClient());
    } catch {
      logger.error("admin_mailbox_options_failed");
    }
  }

  return (
    <MailboxForm
      domains={options.domains}
      users={options.users}
      databaseConfigured={Boolean(env.databaseUrl)}
      onCreate={provisionMailboxAction}
    />
  );
}
