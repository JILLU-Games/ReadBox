"use server";

import { callBackupAgent, BackupAgentError } from "@/core/backup/agent-client";
import type { BackupActionResult, R2Credentials, SchedulePublic } from "@/core/backup/contracts";
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

export async function configureR2Action(config: R2Credentials): Promise<BackupActionResult> {
  await requireBackupAdmin();
  try {
    const reply = await callBackupAgent("r2.configure", { config });
    return { ok: true, code: "R2_SAVED", message: "R2 credentials verified and encrypted on host.", r2: reply.r2 };
  } catch (error) {
    return failure(error);
  }
}

export async function testR2Action(): Promise<BackupActionResult> {
  await requireBackupAdmin();
  try {
    await callBackupAgent("r2.test");
    return { ok: true, code: "R2_TEST_PASS", message: "R2 read/write/list/delete connection check passed." };
  } catch (error) {
    return failure(error);
  }
}

export async function listR2Action(): Promise<BackupActionResult> {
  await requireBackupAdmin();
  try {
    const reply = await callBackupAgent("r2.list");
    return { ok: true, code: "R2_LIST_OK", message: "Remote owned-prefix history refreshed.", remote: reply.remote ?? [] };
  } catch (error) {
    return failure(error);
  }
}

export async function uploadR2Action(backupId: string): Promise<BackupActionResult> {
  await requireBackupAdmin();
  if (!isBackupOpaqueId(backupId)) {
    return { ok: false, code: "BACKUP_INPUT_INVALID", message: "Invalid backup selection." };
  }
  try {
    const reply = await callBackupAgent("r2.upload", { backupId });
    if (!reply.job) return failure(null);
    return { ok: true, code: "QUEUED", message: "Verified encrypted backup upload queued.", job: reply.job };
  } catch (error) {
    return failure(error);
  }
}

export async function configureScheduleAction(
  schedule: Pick<SchedulePublic, "enabled" | "intervalHours" | "autoUpload" | "retentionDays" | "keepLocal">,
): Promise<BackupActionResult> {
  await requireBackupAdmin();
  try {
    const reply = await callBackupAgent("schedule.configure", { schedule });
    return { ok: true, code: "SCHEDULE_SAVED", message: schedule.enabled
      ? "UTC backup schedule enabled; no missed runs replayed."
      : "Automatic backup schedule disabled.", schedule: reply.schedule };
  } catch (error) {
    return failure(error);
  }
}
