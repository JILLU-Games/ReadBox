import { createBackupAction, verifyBackupAction, testRestoreAction, prepareRestoreAction, commitRestoreAction } from "@/app/(workspace)/vcon/backup/actions";
import { BackupConsole } from "@/components/vcon/backup-console";
import { readBackupDashboard, callBackupAgent } from "@/core/backup/agent-client";
import type { RestoreReadiness } from "@/core/backup/contracts";
import { requireAdminUser } from "@/core/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function AdminBackupPage() {
  await requireAdminUser();
  const dashboard = await readBackupDashboard();
  let readiness: RestoreReadiness | undefined;
  if (dashboard.connected) {
    try {
      const status = await callBackupAgent("status") as unknown as { restore?: RestoreReadiness };
      readiness = status.restore;
    } catch {
      // A second status failure never enables destructive controls.
    }
  }
  return (
    <BackupConsole
      initialDashboard={{ ...dashboard, restore: readiness }}
      onCreateBackup={createBackupAction}
      onVerifyBackup={verifyBackupAction}
      onTestRestore={testRestoreAction}
      onPrepareRestore={prepareRestoreAction}
      onCommitRestore={commitRestoreAction}
    />
  );
}
