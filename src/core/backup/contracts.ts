export type BackupJobState = "queued" | "running" | "completed" | "failed" | "interrupted";
export type BackupJobKind = "backup" | "verify";
export interface BackupEvent {
  readonly at: string;
  readonly level: "info" | "success" | "warning" | "error";
  readonly message: string;
}
export interface BackupRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly state: "verified" | "needs_review";
  readonly bytes: number;
  readonly sha256: string;
  readonly format: "age-r05-v1";
  readonly level: "V1" | "V2";
  readonly includesQueue: boolean;
  readonly includesHostSecrets: false;
}
export interface BackupJob {
  readonly id: string;
  readonly kind: BackupJobKind;
  readonly state: BackupJobState;
  readonly backupId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly BackupEvent[];
  readonly result?: BackupRecord | { readonly backupId: string; readonly verified: true; readonly level: "V2" } | { readonly errorCode: string };
}
export interface BackupDashboard {
  readonly connected: boolean;
  readonly jobs: readonly BackupJob[];
  readonly backups: readonly BackupRecord[];
}
export interface BackupActionResult {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly job?: BackupJob;
}
export const UNAVAILABLE_BACKUP_DASHBOARD: BackupDashboard = {
  connected: false,
  jobs: [],
  backups: [],
};
