import { env } from "@/config/env";
import type {
  AuditDetails,
  AuditJsonValue,
  AuditWriteClient,
  RecordAuditInput,
} from "@/core/audit/types";
import { extractClientIp } from "@/core/auth/proxy-request";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import { isIP } from "node:net";
import "server-only";

const SENSITIVE_AUDIT_KEY_PARTS = [
  "password",
  "secret",
  "token",
  "cookie",
  "session",
  "authorization",
  "credential",
  "private_key",
  "privatekey",
  "message_body",
  "attachment_content",
  "contact_message",
] as const;

export function isSensitiveAuditKey(key: string): boolean {
  const normalized = key.trim().toLowerCase().replaceAll("-", "_");
  return SENSITIVE_AUDIT_KEY_PARTS.some((part) => normalized.includes(part));
}

export function sanitizeAuditValue(
  value: unknown,
  key = "",
  seen = new WeakSet<object>(),
): AuditJsonValue {
  if (key && isSensitiveAuditKey(key)) {
    return "[REDACTED]";
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value === "number" && !Number.isFinite(value) ? null : value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value.map((item) => sanitizeAuditValue(item, "", seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const entries: [string, AuditJsonValue][] = [];
    for (const [childKey, childValue] of Object.entries(value)) {
      if (childValue === undefined) continue;
      entries.push([
        childKey,
        sanitizeAuditValue(childValue, childKey, seen),
      ]);
    }
    return Object.fromEntries(entries);
  }
  return String(value);
}

export function sanitizeAuditDetails(
  details: AuditDetails | undefined,
): Record<string, AuditJsonValue> {
  if (!details) return {};
  const sanitized = sanitizeAuditValue(details);
  if (sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)) {
    return sanitized;
  }
  return {};
}

function normalizeActorId(
  actorId: bigint | string | null | undefined,
): bigint | null {
  if (typeof actorId === "bigint") {
    return actorId > BigInt(0) ? actorId : null;
  }
  if (typeof actorId === "string" && /^[1-9]\d*$/.test(actorId.trim())) {
    return BigInt(actorId.trim());
  }
  return null;
}

function resolveAuditIp(input: RecordAuditInput): string | null {
  if (typeof input.clientIp === "string") {
    const trimmed = input.clientIp.trim().toLowerCase();
    return trimmed && isIP(trimmed) !== 0 ? trimmed : null;
  }
  if (input.headers) {
    return extractClientIp(input.headers, {
      trustProxyHeaders: input.trustProxyHeaders === true,
    });
  }
  return null;
}

function resolveUserAgent(input: RecordAuditInput): string {
  const raw =
    input.userAgent ?? input.headers?.get("user-agent") ?? "";
  return raw.trim().slice(0, 500);
}

function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

export async function recordAudit<TResult = unknown>(
  prisma: AuditWriteClient,
  input: RecordAuditInput,
): Promise<TResult | null> {
  const action = input.action.trim().slice(0, 80);
  if (!action) return null;

  const normalizedActorId = normalizeActorId(input.actorId);
  const isAdminTableActor = input.authSource === "admin_table";
  const dbActorId = isAdminTableActor ? null : normalizedActorId;

  const rawDetails: AuditDetails = {
    ...(input.details ?? {}),
    ...(isAdminTableActor && normalizedActorId !== null
      ? {
          actor_source: "admin_table",
          admin_actor_id: normalizedActorId.toString(),
        }
      : {}),
    ...(input.actorUsername && input.actorUsername.trim()
      ? { actor_username: input.actorUsername.trim() }
      : {}),
  };

  const payload = {
    actorId: dbActorId,
    action,
    targetType: (input.targetType ?? "").trim().slice(0, 80),
    targetIdentifier: (input.targetIdentifier ?? "").trim().slice(0, 255),
    ipAddress: resolveAuditIp(input),
    userAgent: resolveUserAgent(input),
    details: sanitizeAuditDetails(
      Object.keys(rawDetails).length > 0 ? rawDetails : input.details,
    ),
  };

  try {
    const record = await prisma.auditLog.create({
      data: payload,
    });
    return record as TResult;
  } catch (error) {
    if (payload.actorId !== null && isForeignKeyConstraintError(error)) {
      try {
        const fallbackRecord = await prisma.auditLog.create({
          data: {
            ...payload,
            actorId: null,
            details: sanitizeAuditDetails({
              ...rawDetails,
              unlinked_actor_id: payload.actorId.toString(),
            }),
          },
        });
        return fallbackRecord as TResult;
      } catch {
        // Fall through to standard audit persistence error logging
      }
    }
    logger.error("audit_persistence_failed", { auditAction: action });
    return null;
  }
}

export function recordAppAudit(input: RecordAuditInput) {
  return recordAudit(getPrismaClient(), {
    ...input,
    trustProxyHeaders: input.trustProxyHeaders ?? env.trustProxyHeaders,
  });
}
