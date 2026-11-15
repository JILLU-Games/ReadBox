import { getAdminOverviewData } from "@/core/admin/overview";
import { requireAdminUser } from "@/core/auth/route-guards";
import { AdminOverview } from "@/vcon/overview-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminUser();
  const overview = await getAdminOverviewData();

  return <AdminOverview data={overview} />;
}
