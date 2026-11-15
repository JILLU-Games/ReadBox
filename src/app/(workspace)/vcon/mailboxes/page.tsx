import {
  bulkPurgeMailboxesAction,
  createSystemMailboxAction,
  setMailboxActiveAction,
} from "@/app/(workspace)/vcon/mailboxes/actions";
import { MailboxesDirectory } from "@/components/vcon/mailboxes-directory";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  listMailboxCreationOptions,
  listMailboxesForAdmin,
  type AdminMailboxListResult,
  type MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import { logger } from "@/core/server/logger";

export const dynamic = "force-dynamic";

export default async function AdminMailboxesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    q?: string;
    status?: string;
    domain?: string;
    page?: string;
  }>;
}) {
  await requireAdminUser();
  const resolved = await searchParams;
  const query = typeof resolved.q === "string" ? resolved.q : "";
  const status = typeof resolved.status === "string" ? resolved.status : "all";
  const domainUuid =
    typeof resolved.domain === "string" ? resolved.domain : "";
  const page = Number.parseInt(resolved.page ?? "1", 10) || 1;

  let list: AdminMailboxListResult = {
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    query: query.trim(),
    statusFilter:
      status === "active" || status === "disabled" ? status : "all",
    domainUuidFilter: "",
    availableDomains: [],
  };
  let verifiedDomains: readonly MailboxCreationDomainOption[] = [];
  let databaseConnected = false;

  if (env.databaseUrl) {
    try {
      const prisma = getPrismaClient();
      const [mailboxList, options] = await Promise.all([
        listMailboxesForAdmin(prisma, {
          query,
          status,
          domainUuid,
          page,
        }),
        listMailboxCreationOptions(prisma),
      ]);
      list = mailboxList;
      verifiedDomains = options.domains;
      databaseConnected = true;
    } catch {
      logger.error("admin_mailboxes_list_failed");
    }
  }

  return (
    <MailboxesDirectory
      list={list}
      verifiedDomains={verifiedDomains}
      databaseConfigured={Boolean(env.databaseUrl)}
      databaseConnected={databaseConnected}
      onToggleActive={setMailboxActiveAction}
      onBulkPurge={bulkPurgeMailboxesAction}
      onCreateSystemMailbox={createSystemMailboxAction}
    />
  );
}
