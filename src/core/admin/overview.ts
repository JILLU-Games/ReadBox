import { env } from "@/config/env";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import { access, constants, stat } from "node:fs/promises";
import "server-only";

export type OverviewHealthState = "ok" | "warn" | "bad" | "unconfigured";

export interface OverviewHealthItem {
  readonly label: string;
  readonly state: OverviewHealthState;
  readonly detail: string;
  readonly meta?: string | null;
}

export interface OverviewKpis {
  readonly totalMailboxes: number;
  readonly activeMailboxes: number;
  readonly disabledMailboxes: number;
  readonly totalMessages: number;
  readonly totalUnread: number;
  readonly lastReceivedAt: string | null;
}

export interface OverviewRecentMessage {
  readonly uuid: string;
  readonly mailboxUuid: string;
  readonly mailboxEmail: string;
  readonly subject: string;
  readonly senderAddress: string;
  readonly senderName: string;
  readonly receivedAt: string | null;
  readonly isRead: boolean;
}

export interface OverviewRecentMailbox {
  readonly uuid: string;
  readonly emailAddress: string;
  readonly status: string;
  readonly totalMessages: string;
}

export interface AdminOverviewData {
  readonly databaseConfigured: boolean;
  readonly databaseConnected: boolean;
  readonly kpis: OverviewKpis;
  readonly health: {
    readonly database: OverviewHealthItem;
    readonly ingestion: OverviewHealthItem;
    readonly mailStorage: OverviewHealthItem;
  };
  readonly recentMessages: readonly OverviewRecentMessage[];
  readonly recentMailboxes: readonly OverviewRecentMailbox[];
}

export interface OverviewPrismaClient {
  $queryRaw: PrismaClient["$queryRaw"];
  mailbox: Pick<PrismaClient["mailbox"], "count" | "findMany">;
  message: Pick<PrismaClient["message"], "count" | "findFirst" | "findMany">;
  serviceHeartbeat: Pick<PrismaClient["serviceHeartbeat"], "findUnique">;
}

export interface AdminOverviewDeps {
  readonly prisma?: OverviewPrismaClient;
  readonly hasDatabaseUrl?: boolean;
  readonly mailStorageRoot?: string;
  readonly ingestionStaleAfterSeconds?: number;
  readonly now?: Date;
  readonly checkStorageAccess?: (
    path: string,
  ) => Promise<{ ok: boolean; detail: string }>;
}

const EMPTY_KPIS: OverviewKpis = {
  totalMailboxes: 0,
  activeMailboxes: 0,
  disabledMailboxes: 0,
  totalMessages: 0,
  totalUnread: 0,
  lastReceivedAt: null,
};

export async function defaultCheckStorageAccess(
  path: string,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) {
      return { ok: false, detail: "Unavailable" };
    }
    await access(path, constants.R_OK | constants.W_OK | constants.X_OK);
    return { ok: true, detail: "Accessible" };
  } catch {
    return { ok: false, detail: "Unavailable" };
  }
}

export function evaluateIngestionHeartbeat(
  heartbeat: {
    readonly status: string;
    readonly lastSeenAt: Date;
  } | null,
  staleAfterSeconds: number,
  now: Date,
): OverviewHealthItem {
  if (!heartbeat) {
    return {
      label: "Ingestion service",
      state: "warn",
      detail: "No heartbeat yet",
      meta: null,
    };
  }

  const normalizedStatus = heartbeat.status.trim().toLowerCase();
  const ageMs = now.getTime() - heartbeat.lastSeenAt.getTime();
  const staleLimitMs = Math.max(15, staleAfterSeconds) * 1000;
  const isoTimestamp = heartbeat.lastSeenAt.toISOString();

  if (
    normalizedStatus === "bad" ||
    normalizedStatus === "error" ||
    normalizedStatus === "unhealthy"
  ) {
    return {
      label: "Ingestion service",
      state: "bad",
      detail: "Error reported",
      meta: isoTimestamp,
    };
  }

  if (ageMs > staleLimitMs) {
    return {
      label: "Ingestion service",
      state: "warn",
      detail: "Stale heartbeat",
      meta: isoTimestamp,
    };
  }

  if (normalizedStatus === "healthy" || normalizedStatus === "ok") {
    return {
      label: "Ingestion service",
      state: "ok",
      detail: "Healthy",
      meta: isoTimestamp,
    };
  }

  return {
    label: "Ingestion service",
    state: "warn",
    detail: heartbeat.status || "Degraded",
    meta: isoTimestamp,
  };
}

export async function getAdminOverviewData(
  deps: AdminOverviewDeps = {},
): Promise<AdminOverviewData> {
  const hasDatabaseUrl = deps.hasDatabaseUrl ?? Boolean(env.databaseUrl);
  const mailStorageRoot = deps.mailStorageRoot ?? env.mailStorageRoot;
  const ingestionStaleAfterSeconds =
    deps.ingestionStaleAfterSeconds ?? env.ingestionStaleAfterSeconds;
  const now = deps.now ?? new Date();
  const checkStorage = deps.checkStorageAccess ?? defaultCheckStorageAccess;

  const storageResult = await checkStorage(mailStorageRoot);
  const mailStorageHealth: OverviewHealthItem = {
    label: "Mail storage",
    state: storageResult.ok ? "ok" : "bad",
    detail: storageResult.detail,
  };

  if (!hasDatabaseUrl) {
    return {
      databaseConfigured: false,
      databaseConnected: false,
      kpis: EMPTY_KPIS,
      health: {
        database: {
          label: "Database",
          state: "unconfigured",
          detail: "Not configured",
        },
        ingestion: {
          label: "Ingestion service",
          state: "warn",
          detail: "No heartbeat yet",
        },
        mailStorage: mailStorageHealth,
      },
      recentMessages: [],
      recentMailboxes: [],
    };
  }

  const prisma = deps.prisma ?? (getPrismaClient() as OverviewPrismaClient);

  try {
    await prisma.$queryRaw`SELECT 1`;

    const [
      totalMailboxes,
      activeMailboxes,
      disabledMailboxes,
      totalMessages,
      totalUnread,
      latestMessage,
      heartbeat,
      recentMessageRows,
      recentMailboxRows,
    ] = await Promise.all([
      prisma.mailbox.count({ where: { deletedAt: null } }),
      prisma.mailbox.count({ where: { deletedAt: null, status: "active" } }),
      prisma.mailbox.count({ where: { deletedAt: null, status: "disabled" } }),
      prisma.message.count({
        where: { deletedAt: null, mailbox: { deletedAt: null } },
      }),
      prisma.message.count({
        where: {
          deletedAt: null,
          isRead: false,
          mailbox: { deletedAt: null },
        },
      }),
      prisma.message.findFirst({
        where: {
          deletedAt: null,
          mailbox: { deletedAt: null },
          receivedAt: { not: null },
        },
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        select: { receivedAt: true },
      }),
      prisma.serviceHeartbeat.findUnique({
        where: { serviceName: "maildir_ingestion" },
        select: { status: true, lastSeenAt: true },
      }),
      prisma.message.findMany({
        where: { deletedAt: null, mailbox: { deletedAt: null } },
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          uuid: true,
          subject: true,
          senderAddress: true,
          senderName: true,
          receivedAt: true,
          isRead: true,
          mailbox: {
            select: {
              uuid: true,
              emailAddress: true,
            },
          },
        },
      }),
      prisma.mailbox.findMany({
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          uuid: true,
          emailAddress: true,
          status: true,
          totalMessages: true,
        },
      }),
    ]);

    return {
      databaseConfigured: true,
      databaseConnected: true,
      kpis: {
        totalMailboxes,
        activeMailboxes,
        disabledMailboxes,
        totalMessages,
        totalUnread,
        lastReceivedAt: latestMessage?.receivedAt
          ? latestMessage.receivedAt.toISOString()
          : null,
      },
      health: {
        database: {
          label: "Database",
          state: "ok",
          detail: "Connected",
        },
        ingestion: evaluateIngestionHeartbeat(
          heartbeat,
          ingestionStaleAfterSeconds,
          now,
        ),
        mailStorage: mailStorageHealth,
      },
      recentMessages: recentMessageRows.map((row) => ({
        uuid: row.uuid,
        mailboxUuid: row.mailbox.uuid,
        mailboxEmail: row.mailbox.emailAddress,
        subject: row.subject,
        senderAddress: row.senderAddress,
        senderName: row.senderName,
        receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
        isRead: row.isRead,
      })),
      recentMailboxes: recentMailboxRows.map((row) => ({
        uuid: row.uuid,
        emailAddress: row.emailAddress,
        status: row.status,
        totalMessages: row.totalMessages.toString(),
      })),
    };
  } catch {
    logger.error("admin_overview_query_failed");
    return {
      databaseConfigured: true,
      databaseConnected: false,
      kpis: EMPTY_KPIS,
      health: {
        database: {
          label: "Database",
          state: "bad",
          detail: "Unavailable",
        },
        ingestion: {
          label: "Ingestion service",
          state: "warn",
          detail: "Unavailable",
        },
        mailStorage: mailStorageHealth,
      },
      recentMessages: [],
      recentMailboxes: [],
    };
  }
}
