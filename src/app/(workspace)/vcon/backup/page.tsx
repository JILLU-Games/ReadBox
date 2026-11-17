import { BackupConsole } from "@/components/vcon/backup-console";
import { requireAdminUser } from "@/core/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function AdminBackupPage() {
  await requireAdminUser();
  return <BackupConsole />;
}
