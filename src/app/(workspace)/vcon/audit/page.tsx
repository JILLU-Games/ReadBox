import { AuditConsole } from "@/components/vcon/audit-console";
import { getAuditMonitorBundle } from "@/core/audit/queries";
import { requireAdminUser } from "@/core/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  await requireAdminUser();
  const resolved = await searchParams;
  const action = typeof resolved.action === "string" ? resolved.action : "";
  const query = typeof resolved.q === "string" ? resolved.q : "";
  const page = Number.parseInt(resolved.page ?? "1", 10) || 1;

  const bundle = await getAuditMonitorBundle({
    action,
    query,
    page,
  });

  return <AuditConsole bundle={bundle} />;
}
