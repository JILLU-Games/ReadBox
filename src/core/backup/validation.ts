import "server-only";

const OPAQUE_ID = /^[0-9a-f]{32}$/;
export function isBackupOpaqueId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}
export type AgentAction =
  | "status" | "job.get" | "backup.create" | "backup.verify"
  | "r2.configure" | "r2.test" | "r2.list" | "r2.upload"
  | "schedule.configure"
  | "restore.test" | "restore.prepare" | "restore.commit" | "dkim.escrow";
export function validateAgentPayload(
  action: AgentAction,
  payload: Readonly<Record<string, unknown>>,
): boolean {
  if (action === "status" || action === "backup.create" ||
      action === "r2.test" || action === "r2.list") {
    return Object.keys(payload).length === 0;
  }
  if (action === "dkim.escrow") {
    return Object.keys(payload).length === 1 &&
      typeof payload.domain === "string" && payload.domain.length <= 253 &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(payload.domain);
  }
  if (action === "job.get") {
    return Object.keys(payload).length === 1 && isBackupOpaqueId(payload.jobId);
  }
  if (action === "backup.verify" || action === "r2.upload") {
    return Object.keys(payload).length === 1 && isBackupOpaqueId(payload.backupId);
  }
  if (action === "restore.test") {
    return Object.keys(payload).length === 1 && isBackupOpaqueId(payload.backupId);
  }
  if (action === "restore.prepare") {
    return Object.keys(payload).sort().join(",") === "actor,backupId" &&
      isBackupOpaqueId(payload.backupId) &&
      typeof payload.actor === "string" && /^[1-9][0-9]{0,18}$/.test(payload.actor);
  }
  if (action === "restore.commit") {
    return Object.keys(payload).sort().join(",") ===
      "actor,backupId,confirmation,permitId,token" &&
      isBackupOpaqueId(payload.backupId) &&
      isBackupOpaqueId(payload.permitId) &&
      typeof payload.token === "string" && /^[a-f0-9]{64}$/.test(payload.token) &&
      typeof payload.actor === "string" && /^[1-9][0-9]{0,18}$/.test(payload.actor) &&
      typeof payload.confirmation === "string" &&
      payload.confirmation === "RESTORE " + payload.backupId;
  }
  if (action === "r2.configure") {
    const value = payload.config;
    if (Object.keys(payload).length !== 1 || !value || typeof value !== "object" ||
        Array.isArray(value)) return false;
    const config = value as Record<string, unknown>;
    return Object.keys(config).sort().join(",") ===
        "accessKeyId,accountId,bucket,secretAccessKey" &&
      typeof config.accountId === "string" && /^[a-f0-9]{32}$/.test(config.accountId) &&
      typeof config.bucket === "string" &&
      /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(config.bucket) &&
      typeof config.accessKeyId === "string" &&
      /^[A-Za-z0-9]{12,80}$/.test(config.accessKeyId) &&
      typeof config.secretAccessKey === "string" &&
      /^[A-Za-z0-9/+_=.-]{32,128}$/.test(config.secretAccessKey);
  }
  if (action === "schedule.configure") {
    const item = payload.schedule;
    if (Object.keys(payload).length !== 1 || !item || typeof item !== "object" ||
        Array.isArray(item)) return false;
    const schedule = item as Record<string, unknown>;
    return Object.keys(schedule).sort().join(",") ===
      "autoUpload,enabled,intervalHours,keepLocal,retentionDays" &&
      typeof schedule.enabled === "boolean" &&
      typeof schedule.autoUpload === "boolean" &&
      [6, 12, 24].includes(schedule.intervalHours as number) &&
      [0, 7, 14, 30, 60, 90, 180, 365].includes(schedule.retentionDays as number) &&
      Number.isInteger(schedule.keepLocal) &&
      (schedule.keepLocal as number) >= 3 && (schedule.keepLocal as number) <= 30;
  }
  return false;
}
