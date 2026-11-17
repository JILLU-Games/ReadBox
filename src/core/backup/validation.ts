import "server-only";

const OPAQUE_ID = /^[0-9a-f]{32}$/;
export function isBackupOpaqueId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}
export type AgentAction = "status" | "job.get" | "backup.create" | "backup.verify";
export function validateAgentPayload(
  action: AgentAction,
  payload: Readonly<Record<string, unknown>>,
): boolean {
  if (action === "status" || action === "backup.create") {
    return Object.keys(payload).length === 0;
  }
  if (action === "job.get") {
    return Object.keys(payload).length === 1 && isBackupOpaqueId(payload.jobId);
  }
  return Object.keys(payload).length === 1 && isBackupOpaqueId(payload.backupId);
}
