import {
  checkDomainDnsAction,
  deleteDomainAction,
  setDefaultDomainAction,
  updateDomainStatusAction,
} from "@/app/(workspace)/vcon/domains/actions";
import { DomainForm } from "@/components/vcon/domain-form";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import type { ExpectedDnsRecord } from "@/core/dns/records";
import { getExpectedDnsRecordsForDomain } from "@/core/dns/resolver";
import { getDomainByUuid, type ManagedDomainItem } from "@/core/domains/service";
import { logger } from "@/core/server/logger";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminEditDomainPage({
  params,
}: {
  readonly params: Promise<{ uuid: string }>;
}) {
  await requireAdminUser();
  const { uuid } = await params;

  if (!env.databaseUrl) {
    return (
      <DomainForm
        mode="edit"
        databaseConfigured={false}
        configuredMailDomain={env.mailDomain}
      />
    );
  }

  let domain: ManagedDomainItem | null = null;
  let initialRecords: readonly ExpectedDnsRecord[] = [];
  let loadFailed = false;

  try {
    domain = await getDomainByUuid(getPrismaClient(), uuid);
    if (domain) {
      initialRecords = await getExpectedDnsRecordsForDomain(domain.name, {
        mailHostname: env.mailHostname,
        serverIp: env.serverIp,
        opendkimKeysRoot: env.opendkimKeysRoot,
      });
    }
  } catch {
    loadFailed = true;
    logger.error("admin_domain_edit_load_failed");
  }

  if (loadFailed) {
    return (
      <section
        className="rounded-lg border border-destructive/40 bg-destructive-bg p-4 text-sm text-destructive-muted"
        role="alert"
      >
        Unable to load this domain record from PostgreSQL right now.
      </section>
    );
  }

  if (!domain) {
    notFound();
  }

  return (
    <DomainForm
      mode="edit"
      databaseConfigured
      configuredMailDomain={env.mailDomain}
      initialDomain={domain}
      initialRecords={initialRecords}
      onUpdateStatus={updateDomainStatusAction}
      onCheckDns={checkDomainDnsAction}
      onMakeDefault={setDefaultDomainAction}
      onDelete={deleteDomainAction}
    />
  );
}
