export type BackupJobState = "queued" | "running" | "completed" | "failed" | "interrupted";
export type BackupJobKind = "backup" | "verify" | "r2_upload" | "restore";
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
  readonly remoteState?: "remote_verified";
  readonly remoteVerifiedAt?: string;
  readonly localState?: "deleted";
}
export interface BackupJob {
  readonly id: string;
  readonly kind: BackupJobKind;
  readonly state: BackupJobState;
  readonly backupId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly BackupEvent[];
  readonly result?: BackupRecord | { readonly backupId: string; readonly verified: true; readonly level: "V2" } | { readonly backupId: string; readonly remoteVerified: true; readonly bytes: number } | { readonly backupId: string; readonly restored: true; readonly rollbackAvailable: true; readonly rollbackId: string } | { readonly errorCode: string };
}
export interface R2Public {
  readonly configured: boolean;
  readonly bucket: string | null;
  readonly accountIdLast4: string | null;
  readonly accessKeyLast4: string | null;
  readonly prefix: string;
}
export interface SchedulePublic {
  readonly enabled: boolean;
  readonly intervalHours: 6 | 12 | 24;
  readonly autoUpload: boolean;
  readonly retentionDays: number;
  readonly keepLocal: number;
  readonly nextRunAt: number | null;
  readonly lastRunAt: string | null;
  readonly timeZone: "UTC";
}
export interface RemoteBackupRecord {
  readonly backupId: string;
  readonly bytes: number;
  readonly key: string;
  readonly state: "remote_object_present";
}
export interface R2Credentials {
  readonly accountId: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}
export interface RestoreReadiness {
  readonly enabled: boolean;
  readonly operatorReviewRequired: boolean;
}
export interface RestorePreflight {
  readonly backupId: string;
  readonly verified: true;
  readonly includesQueue: boolean;
  readonly format: "age-r05-v1";
  readonly rollbackRequired: true;
  readonly rollbackAvailable: false;
  readonly productionAuthorized: boolean;
}
export interface RestorePermit {
  readonly permitId: string;
  readonly token: string;
  readonly expiresAt: number;
}
export interface BackupDashboard {
  readonly connected: boolean;
  readonly jobs: readonly BackupJob[];
  readonly backups: readonly BackupRecord[];
  readonly r2?: R2Public;
  readonly schedule?: SchedulePublic;
  readonly restore?: RestoreReadiness;
}
export interface BackupActionResult {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly job?: BackupJob;
  readonly r2?: R2Public;
  readonly schedule?: SchedulePublic;
  readonly remote?: readonly RemoteBackupRecord[];
  readonly restore?: RestoreReadiness;
  readonly preflight?: RestorePreflight;
  readonly permit?: RestorePermit;
}
export const UNAVAILABLE_BACKUP_DASHBOARD: BackupDashboard = {
  connected: false,
  jobs: [],
  backups: [],
};
