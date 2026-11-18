import { createBackupAction, verifyBackupAction, testRestoreAction, prepareRestoreAction, commitRestoreAction } from "@/app/(workspace)/vcon/backup/actions";
import { BackupConsole } from "@/components/vcon/backup-console";
import { readBackupDashboard } from "@/core/backup/agent-client";
import { requireAdminUser } from "@/core/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function AdminBackupPage() {
  await requireAdminUser();
  const dashboard = await readBackupDashboard();
  return (
    <BackupConsole
      initialDashboard={dashboard}
      onCreateBackup={createBackupAction}
      onVerifyBackup={verifyBackupAction}
      onTestRestore={testRestoreAction}
      onPrepareRestore={prepareRestoreAction}
      onCommitRestore={commitRestoreAction}
    />
  );
}
