import { createDomainAction } from "@/app/(workspace)/vcon/domains/actions";
import { DomainForm } from "@/components/vcon/domain-form";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function AdminNewDomainPage() {
  await requireAdminUser();

  return (
    <DomainForm
      mode="create"
      databaseConfigured={Boolean(env.databaseUrl)}
      configuredMailDomain={env.mailDomain}
      onCreate={createDomainAction}
    />
  );
}
