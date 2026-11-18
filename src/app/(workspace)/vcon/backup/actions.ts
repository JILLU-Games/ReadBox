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
      ? "A backup, upload or restore job is already in progress."
      : code === "RESTORE_OPERATOR_GATE_CLOSED"
        ? "Host operator authorization is required before any restore."
        : code === "RESTORE_PERMIT_EXPIRED" || code === "RESTORE_CONFIRMATION_REQUIRED"
          ? "Restore confirmation expired or was refused. Repeat preflight."
          : code === "RESTORE_OPERATOR_REVIEW_REQUIRED" || code === "RESTORE_ROLLBACK_CRITICAL" ||
            code === "RESTORE_FAILED_REVIEW_ROLLBACK"
            ? "Restore safety review is required. Do not restart maintenance until the operator checks the encrypted rollback."
            : code === "RESTORE_BACKUP_NOT_VERIFIED" || code === "RESTORE_PREFLIGHT_FAILED"
              ? "Backup preflight failed. Existing data was not modified."
              : code === "BACKUP_NOT_FOUND"
                ? "This backup is not available for verification."
                : "Backup service unavailable or operation refused. No success was recorded.",
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

export async function testRestoreAction(backupId: string): Promise<BackupActionResult> {
  await requireBackupAdmin();
  if (!isBackupOpaqueId(backupId)) {
    return { ok: false, code: "RESTORE_INPUT_INVALID", message: "Invalid backup selection." };
  }
  try {
    const reply = await callBackupAgent("restore.test", { backupId });
    if (!reply.preflight?.verified) return failure(null);
    return { ok: true, code: "RESTORE_PREFLIGHT_PASS",
      message: "Encrypted age archive and metadata preflight passed. No data was changed.",
      preflight: reply.preflight };
  } catch (error) {
    return failure(error);
  }
}

export async function prepareRestoreAction(backupId: string): Promise<BackupActionResult> {
  const admin = await requireBackupAdmin();
  if (!isBackupOpaqueId(backupId)) {
    return { ok: false, code: "RESTORE_INPUT_INVALID", message: "Invalid backup selection." };
  }
  try {
    const reply = await callBackupAgent("restore.prepare", {
      backupId, actor: String(admin.id),
    });
    if (!reply.permit || !reply.preflight?.verified) return failure(null);
    return { ok: true, code: "RESTORE_CONFIRMATION_READY",
      message: "Preflight verified. Confirm the exact backup ID before the 90-second permit expires.",
      preflight: reply.preflight, permit: reply.permit };
  } catch (error) {
    return failure(error);
  }
}

export async function commitRestoreAction(
  backupId: string, permitId: string, token: string, confirmation: string,
): Promise<BackupActionResult> {
  const admin = await requireBackupAdmin();
  if (!isBackupOpaqueId(backupId) || !isBackupOpaqueId(permitId) ||
      !/^[a-f0-9]{64}$/.test(token) || confirmation !== "RESTORE " + backupId) {
    return { ok: false, code: "RESTORE_CONFIRMATION_REQUIRED",
      message: "Type the exact RESTORE confirmation and restart preflight." };
  }
  try {
    const reply = await callBackupAgent("restore.commit", {
      backupId, actor: String(admin.id), permitId, token, confirmation,
    });
    if (!reply.job) return failure(null);
    return { ok: true, code: "QUEUED",
      message: "Guarded restore queued. A new encrypted rollback archive is required before mutation.",
      job: reply.job };
  } catch (error) {
    return failure(error);
  }
}
