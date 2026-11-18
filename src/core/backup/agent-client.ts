import type { BackupDashboard, BackupJob, R2Public, SchedulePublic, RemoteBackupRecord } from "@/core/backup/contracts";
import { UNAVAILABLE_BACKUP_DASHBOARD } from "@/core/backup/contracts";
import { type AgentAction, validateAgentPayload } from "@/core/backup/validation";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import "server-only";

const SOCKET = "/run/readbox-backup-agent/agent.sock";
const SECRET = "/run/readbox-backup-agent/access.token";
const MAX_RESPONSE_BYTES = 96 * 1024;

export class BackupAgentError extends Error {
  constructor(readonly code: string) {
    super("Backup agent unavailable or operation refused");
    this.name = "BackupAgentError";
  }
}

interface AgentReply {
  readonly connected?: boolean;
  readonly escrow?: "verified" | "verified_existing";
  readonly jobs?: readonly BackupJob[];
  readonly backups?: BackupDashboard["backups"];
  readonly job?: BackupJob;
  readonly error?: string;
  readonly r2?: R2Public;
  readonly schedule?: SchedulePublic;
  readonly remote?: readonly RemoteBackupRecord[];
  readonly test?: { readonly verified: boolean; readonly at: string };
}

export async function callBackupAgent(
  action: AgentAction,
  payload: Readonly<Record<string, unknown>> = {},
): Promise<AgentReply> {
  if (!validateAgentPayload(action, payload)) {
    throw new BackupAgentError("BACKUP_INPUT_INVALID");
  }
  let secret: string;
  try {
    secret = (await readFile(SECRET, "utf8")).trim();
  } catch {
    throw new BackupAgentError("BACKUP_AGENT_UNAVAILABLE");
  }
  if (!/^[a-f0-9]{64}$/.test(secret)) {
    throw new BackupAgentError("BACKUP_AGENT_UNAVAILABLE");
  }

  const body = JSON.stringify({ action, ...payload });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const contentDigest = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update([timestamp, nonce, contentDigest].join("."))
    .digest("hex");

  return new Promise<AgentReply>((resolve, reject) => {
    let resolved = false;
    const fail = (code: string) => {
      if (resolved) return;
      resolved = true;
      reject(new BackupAgentError(code));
    };
    const req = request(
      {
        socketPath: SOCKET,
        method: "POST",
        path: "/rpc",
        timeout: action === "dkim.escrow" ? 110_000 : 15_000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-ReadBox-Timestamp": timestamp,
          "X-ReadBox-Nonce": nonce,
          "X-ReadBox-Signature": signature,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            req.destroy();
            fail("BACKUP_AGENT_UNAVAILABLE");
          } else {
            chunks.push(chunk);
          }
        });
        res.on("end", () => {
          if (resolved) return;
          try {
            const reply = JSON.parse(Buffer.concat(chunks).toString("utf8")) as AgentReply;
            if ((res.statusCode ?? 500) >= 400) {
              const safeCodes = new Set([
                "JOB_CONFLICT", "BACKUP_NOT_FOUND", "JOB_NOT_FOUND",
                "INVALID_JOB_ID", "ACTION_NOT_ALLOWED", "FORBIDDEN",
                "R2_NOT_CONFIGURED", "R2_CONFIG_INVALID", "R2_CONNECTION_FAILED",
                "R2_PROBE_UNVERIFIED", "R2_PROBE_CLEANUP_FAILED",
                "R2_BACKUP_NOT_V2_VERIFIED", "R2_REMOTE_OBJECT_CONFLICT",
                "R2_REMOTE_OBJECT_UNVERIFIED", "R2_UPLOAD_FAILED",
                "SCHEDULE_INVALID", "R2_LOCAL_ARCHIVE_UNAVAILABLE",
                "DKIM_DOMAIN_INVALID", "DKIM_ESCROW_REFUSED",
                "DKIM_ESCROW_HELPER_MISSING", "DKIM_ESCROW_UNAVAILABLE",
                "DKIM_ESCROW_UNVERIFIED",
              ]);
              return fail(safeCodes.has(reply.error ?? "") ? reply.error! : "BACKUP_AGENT_UNAVAILABLE");
            }
            resolved = true;
            resolve(reply);
          } catch {
            fail("BACKUP_AGENT_UNAVAILABLE");
          }
        });
        res.on("error", () => fail("BACKUP_AGENT_UNAVAILABLE"));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => fail("BACKUP_AGENT_UNAVAILABLE"));
    req.end(body);
  });
}

export async function readBackupDashboard(): Promise<BackupDashboard> {
  try {
    const result = await callBackupAgent("status");
    if (result.connected !== true || !Array.isArray(result.jobs) || !Array.isArray(result.backups)) {
      return UNAVAILABLE_BACKUP_DASHBOARD;
    }
    return { connected: true, jobs: result.jobs, backups: result.backups,
      r2: result.r2, schedule: result.schedule };
  } catch {
    return UNAVAILABLE_BACKUP_DASHBOARD;
  }
}

export async function getBackupJob(id: string): Promise<BackupJob | null> {
  const result = await callBackupAgent("job.get", { jobId: id });
  return result.job ?? null;
}
