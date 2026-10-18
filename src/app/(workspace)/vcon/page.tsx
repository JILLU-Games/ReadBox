import { requireAdminUser } from "@/core/auth/route-guards";
import { AdminOverview } from "@/vcon/overview-panel";

export default async function AdminPage() {
  await requireAdminUser();

  return <AdminOverview />;
}
