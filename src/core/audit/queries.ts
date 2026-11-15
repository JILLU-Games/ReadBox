import { env } from "@/config/env";
import { sanitizeAuditDetails } from "@/core/audit/record";
import type { AuditJsonValue } from "@/core/audit/types";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import { isIP } from "node:net";
import "server-only";

export const STANDARD_AUDIT_ACTIONS = [
  "login_success",
  "login_failure",
  "logout",
  "user_created",
  "user_updated",
  "user_deleted",
  "user_activated",
  "user_deactivated",
  "user_delete_permissions_changed",
  "mailbox_assignment_added",
  "mailbox_assignment_removed",
] as const;

export interface AuditLogListItem {
  readonly uuid: string;
  readonly action: string;
  readonly actorUsername: string | null;
  readonly targetType: string;
  readonly targetIdentifier: string;
  readonly ipAddress: string | null;
  readonly userAgent: string;
  readonly details: Record<string, AuditJsonValue>;
  readonly createdAt: string;
}

export interface AuditLogQueryResult {
  readonly items: readonly AuditLogListItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly actionFilter: string;
  readonly query: string;
  readonly availableActions: readonly string[];
}

export interface ActiveLoginLockout {
  readonly usernameNormalized: string;
  readonly ipAddress: string | null;
  readonly failureCount: number;
  readonly latestFailureAt: string;
  readonly lockedUntil: string;
  readonly remainingSeconds: number;
}

export interface RecentLoginAttemptItem {
  readonly id: string;
  readonly usernameNormalized: string;
  readonly ipAddress: string | null;
  readonly succeeded: boolean;
  readonly createdAt: string;
}

export interface LoginSecurityMonitorResult {
  readonly activeLockouts: readonly ActiveLoginLockout[];
  readonly recentAttempts: readonly RecentLoginAttemptItem[];
  readonly recentFailureCount: number;
}

export interface AuditMonitorBundle {
  readonly databaseConfigured: boolean;
  readonly databaseConnected: boolean;
  readonly logs: AuditLogQueryResult;
  readonly security: LoginSecurityMonitorResult;
}

export type AuditQueryPrismaClient = Pick<
  PrismaClient,
  "auditLog" | "loginAttempt"
>;

export async function listAuditLogs(
  prisma: Pick<PrismaClient, "auditLog">,
  options: {
    readonly action?: string;
    readonly query?: string;
    readonly page?: number;
    readonly pageSize?: number;
  } = {},
): Promise<AuditLogQueryResult> {
  const actionFilter = (options.action ?? "").trim();
  const query = (options.query ?? "").trim();
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 25));
  const requestedPage = Number.isFinite(options.page)
    ? Math.max(1, Math.floor(options.page ?? 1))
    : 1;

  const conditions: Record<string, unknown>[] = [];
  if (actionFilter && actionFilter !== "all") {
    conditions.push({ action: actionFilter });
  }
  if (query) {
    const orFilters: Record<string, unknown>[] = [
      { action: { contains: query, mode: "insensitive" } },
      { targetType: { contains: query, mode: "insensitive" } },
      { targetIdentifier: { contains: query, mode: "insensitive" } },
      {
        actor: {
          username: { contains: query, mode: "insensitive" },
        },
      },
    ];
    if (isIP(query) !== 0) {
      orFilters.push({ ipAddress: query.toLowerCase() });
    }
    conditions.push({ OR: orFilters });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [totalCount, distinctActions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 50,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      uuid: true,
      action: true,
      targetType: true,
      targetIdentifier: true,
      ipAddress: true,
      userAgent: true,
      details: true,
      createdAt: true,
      actor: {
        select: { username: true },
      },
    },
  });

  const actionSet = new Set<string>(STANDARD_AUDIT_ACTIONS);
  for (const row of distinctActions) {
    if (row.action) actionSet.add(row.action);
  }

  return {
    items: rows.map((row) => ({
      uuid: row.uuid,
      action: row.action,
      actorUsername: row.actor?.username ?? null,
      targetType: row.targetType,
      targetIdentifier: row.targetIdentifier,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      details: sanitizeAuditDetails(
        row.details &&
          typeof row.details === "object" &&
          !Array.isArray(row.details)
          ? (row.details as Record<string, unknown>)
          : undefined,
      ),
      createdAt: row.createdAt.toISOString(),
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    actionFilter,
    query,
    availableActions: Array.from(actionSet).sort(),
  };
}

export async function listLoginSecurityMonitor(
  prisma: Pick<PrismaClient, "loginAttempt">,
  options: {
    readonly failureLimit?: number;
    readonly failureWindowSeconds?: number;
    readonly lockoutSeconds?: number;
    readonly now?: Date;
  } = {},
): Promise<LoginSecurityMonitorResult> {
  const failureLimit = options.failureLimit ?? env.loginFailureLimit;
  const failureWindowMs =
    (options.failureWindowSeconds ?? env.loginFailureWindowSeconds) * 1000;
  const lockoutMs = (options.lockoutSeconds ?? env.loginLockoutSeconds) * 1000;
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const lookupStart = new Date(nowMs - (failureWindowMs + lockoutMs));

  const [recentFailureRows, recentAttemptRows] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: {
        succeeded: false,
        createdAt: { gte: lookupStart },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        usernameNormalized: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
    prisma.loginAttempt.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
      select: {
        id: true,
        usernameNormalized: true,
        ipAddress: true,
        succeeded: true,
        createdAt: true,
      },
    }),
  ]);

  const grouped = new Map<
    string,
    {
      usernameNormalized: string;
      ipAddress: string | null;
      attempts: Date[];
    }
  >();

  for (const row of recentFailureRows) {
    const key = `${row.usernameNormalized}|${row.ipAddress ?? ""}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.attempts.push(row.createdAt);
    } else {
      grouped.set(key, {
        usernameNormalized: row.usernameNormalized,
        ipAddress: row.ipAddress,
        attempts: [row.createdAt],
      });
    }
  }

  const activeLockouts: ActiveLoginLockout[] = [];
  for (const bucket of grouped.values()) {
    const latestFailure = bucket.attempts[0];
    if (!latestFailure) continue;
    const latestFailureMs = latestFailure.getTime();
    const lockedUntilMs = latestFailureMs + lockoutMs;
    if (lockedUntilMs <= nowMs) continue;

    const burstWindowStartMs = latestFailureMs - failureWindowMs;
    const burstCount = bucket.attempts.filter(
      (attempt) => attempt.getTime() >= burstWindowStartMs,
    ).length;

    if (burstCount >= failureLimit) {
      activeLockouts.push({
        usernameNormalized: bucket.usernameNormalized,
        ipAddress: bucket.ipAddress,
        failureCount: burstCount,
        latestFailureAt: latestFailure.toISOString(),
        lockedUntil: new Date(lockedUntilMs).toISOString(),
        remainingSeconds: Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000)),
      });
    }
  }

  activeLockouts.sort((a, b) => b.remainingSeconds - a.remainingSeconds);

  return {
    activeLockouts,
    recentAttempts: recentAttemptRows.map((row) => ({
      id: row.id.toString(),
      usernameNormalized: row.usernameNormalized,
      ipAddress: row.ipAddress,
      succeeded: row.succeeded,
      createdAt: row.createdAt.toISOString(),
    })),
    recentFailureCount: recentFailureRows.length,
  };
}

export async function getAuditMonitorBundle(options: {
  readonly prisma?: AuditQueryPrismaClient;
  readonly hasDatabaseUrl?: boolean;
  readonly action?: string;
  readonly query?: string;
  readonly page?: number;
} = {}): Promise<AuditMonitorBundle> {
  const hasDatabaseUrl = options.hasDatabaseUrl ?? Boolean(env.databaseUrl);
  const emptyLogs: AuditLogQueryResult = {
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    actionFilter: options.action ?? "",
    query: options.query ?? "",
    availableActions: [...STANDARD_AUDIT_ACTIONS].sort(),
  };
  const emptySecurity: LoginSecurityMonitorResult = {
    activeLockouts: [],
    recentAttempts: [],
    recentFailureCount: 0,
  };

  if (!hasDatabaseUrl) {
    return {
      databaseConfigured: false,
      databaseConnected: false,
      logs: emptyLogs,
      security: emptySecurity,
    };
  }

  const prisma = options.prisma ?? (getPrismaClient() as AuditQueryPrismaClient);

  try {
    const [logs, security] = await Promise.all([
      listAuditLogs(prisma, {
        action: options.action,
        query: options.query,
        page: options.page,
      }),
      listLoginSecurityMonitor(prisma),
    ]);

    return {
      databaseConfigured: true,
      databaseConnected: true,
      logs,
      security,
    };
  } catch {
    logger.error("audit_monitor_query_failed");
    return {
      databaseConfigured: true,
      databaseConnected: false,
      logs: emptyLogs,
      security: emptySecurity,
    };
  }
}
