"use server";

import { callBackupAgent, BackupAgentError } from "@/core/backup/agent-client";
import type { BackupActionResult } from "@/core/backup/contracts";
import { requireBackupAdmin } from "@/core/backup/permissions";
import { isBackupOpaqueId } from "@/core/backup/validation";

function failure(error: unknown): BackupActionResult {
  const code = error instanceof BackupAgentError ? error.code : "BACKUP_AGENT_UNAVAILABLE";
  return {
    ok: false,
    code,
    message: code === "JOB_CONFLICT"
      ? "A backup or verification job is already in progress."
      : code === "BACKUP_NOT_FOUND"
        ? "This backup is not available for verification."
        : "Backup service unavailable. Existing ReadBox data is unchanged.",
  };
}

export async function createBackupAction(): Promise<BackupActionResult> {
  await requireBackupAdmin();
  try {
    const result = await callBackupAgent("backup.create");
    if (!result.job) return failure(null);
    return { ok: true, code: "QUEUED", message: "Encrypted backup queued.", job: result.job };
  } catch (error) {
    return failure(error);
  }
}

export async function verifyBackupAction(backupId: string): Promise<BackupActionResult> {
  await requireBackupAdmin();
  if (!isBackupOpaqueId(backupId)) {
    return { ok: false, code: "BACKUP_INPUT_INVALID", message: "Invalid backup selection." };
  }
  try {
    const result = await callBackupAgent("backup.verify", { backupId });
    if (!result.job) return failure(null);
    return { ok: true, code: "QUEUED", message: "Backup verification queued.", job: result.job };
  } catch (error) {
    return failure(error);
  }
}
