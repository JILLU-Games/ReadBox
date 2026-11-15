import {
  checkDomainDnsAction,
  deleteDomainAction,
  setDefaultDomainAction,
  toggleDomainStatusAction,
} from "@/app/(workspace)/vcon/domains/actions";
import { DomainsDirectory } from "@/components/vcon/domains-directory";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { listDomains, type ManagedDomainItem } from "@/core/domains/service";
import { logger } from "@/core/server/logger";

export const dynamic = "force-dynamic";

export default async function AdminDomainsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminUser();
  const resolved = await searchParams;
  const query = typeof resolved.q === "string" ? resolved.q.trim() : "";

  let domains: readonly ManagedDomainItem[] = [];
  let databaseConnected = false;

  if (env.databaseUrl) {
    try {
      domains = await listDomains(getPrismaClient(), { query });
      databaseConnected = true;
    } catch {
      logger.error("admin_domains_list_failed");
    }
  }

  return (
    <DomainsDirectory
      domains={domains}
      query={query}
      configuredMailDomain={env.mailDomain}
      databaseConfigured={Boolean(env.databaseUrl)}
      databaseConnected={databaseConnected}
      onCheckDns={checkDomainDnsAction}
      onToggleStatus={toggleDomainStatusAction}
      onMakeDefault={setDefaultDomainAction}
      onDeleteDomain={deleteDomainAction}
    />
  );
}
