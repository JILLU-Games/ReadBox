import {
  getUserAccessCapabilities,
  type UserAccessCapabilities,
} from "@/core/accounts/policy";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { recalculateMailboxCounters } from "@/core/ingestion/counters";
import { confinedPath, PathConfinementError } from "@/core/mailboxes/paths";
import type { ProvisionLockOptions } from "@/core/mailboxes/provisioning";
import {
  bulkPurgeMailboxes,
  provisionMailbox,
  purgeMailbox,
  type MailboxActionResult,
  type MailboxCreationDomainOption,
  type MailboxPrismaClient,
  type MailboxRuntimeConfig,
} from "@/core/mailboxes/service";
import { isValidUuid } from "@/core/mailboxes/validators";
import type { SqlQueryExecutor } from "@/core/mailserver/pg-adapter";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import { lstat } from "node:fs/promises";
import "server-only";

export const LIVE_UPDATE_HEADER = "X-MailStack-Live-Request";
export const LIVE_UPDATE_MESSAGE_LIMIT = 20;
export const LIVE_UPDATE_MAILBOX_LIMIT = 50;
export const LIVE_UPDATE_VISIBLE_MAILBOX_LIMIT = 50;

export const SAFE_HTML_CSP_POLICY = [
  "default-src 'none'",
  "img-src data:",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export interface UserWorkspaceActor {
  readonly userId: bigint;
  readonly username?: string;
  readonly isAdministrator: boolean;
  readonly headers?: Pick<Headers, "get">;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly trustProxyHeaders?: boolean;
}

export interface UserMailboxSummaryItem {
  readonly id: string;
  readonly uuid: string;
  readonly localPart: string;
  readonly emailAddress: string;
  readonly domainUuid: string;
  readonly domainName: string;
  readonly status: string;
  readonly totalMessages: string;
  readonly unreadMessages: string;
  readonly lastReceivedAt: string | null;
  readonly createdAt: string;
}

export interface UserRecentMessageItem {
  readonly id: string;
  readonly uuid: string;
  readonly mailboxUuid: string;
  readonly mailboxEmail: string;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly subject: string;
  readonly preview: string;
  readonly receivedAt: string | null;
  readonly isRead: boolean;
  readonly hasAttachments: boolean;
  readonly sizeBytes: string;
}

export interface UserWorkspaceOverviewSnapshot {
  readonly databaseConfigured: boolean;
  readonly totalMailboxes: number;
  readonly activeMailboxes: number;
  readonly disabledMailboxes: number;
  readonly totalMessages: number;
  readonly totalUnread: number;
  readonly lastReceivedAt: string | null;
  readonly recentMessages: readonly UserRecentMessageItem[];
  readonly recentMailboxes: readonly UserMailboxSummaryItem[];
  readonly availableDomains: readonly MailboxCreationDomainOption[];
  readonly capabilities: UserAccessCapabilities;
}

export interface UserMailboxListResult {
  readonly databaseConfigured: boolean;
  readonly items: readonly UserMailboxSummaryItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly query: string;
  readonly statusFilter: "all" | "active" | "disabled";
  readonly availableDomains: readonly MailboxCreationDomainOption[];
  readonly capabilities: UserAccessCapabilities;
}

export type InboxReadFilter = "all" | "unread" | "read";
export type InboxAttachmentFilter = "all" | "yes" | "no";

export interface UserInboxMessageItem {
  readonly id: string;
  readonly uuid: string;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly subject: string;
  readonly preview: string;
  readonly receivedAt: string | null;
  readonly sizeBytes: number;
  readonly isRead: boolean;
  readonly hasAttachments: boolean;
  readonly parseStatus: string;
}

export interface UserInboxMailboxHeader {
  readonly id: string;
  readonly uuid: string;
  readonly localPart: string;
  readonly emailAddress: string;
  readonly domainName: string;
  readonly status: string;
  readonly totalMessages: number;
  readonly unreadMessages: number;
  readonly lastReceivedAt: string | null;
}

export interface UserInboxListResult {
  readonly mailbox: UserInboxMailboxHeader;
  readonly items: readonly UserInboxMessageItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly query: string;
  readonly readFilter: InboxReadFilter;
  readonly attachmentFilter: InboxAttachmentFilter;
  readonly liveUnfilteredFirstPage: boolean;
  readonly canDeleteMailbox: boolean;
}

export interface UserAttachmentItem {
  readonly uuid: string;
  readonly originalFilename: string;
  readonly safeFilename: string;
  readonly declaredMimeType: string;
  readonly detectedMimeType: string;
  readonly sizeBytes: number;
  readonly isInline: boolean;
}

export interface UserMessageDetail {
  readonly id: string;
  readonly uuid: string;
  readonly mailbox: UserInboxMailboxHeader;
  readonly messageIdHeader: string;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly recipientAddresses: readonly string[];
  readonly ccAddresses: readonly string[];
  readonly subject: string;
  readonly receivedAt: string | null;
  readonly parsedAt: string;
  readonly sizeBytes: number;
  readonly isRead: boolean;
  readonly hasAttachments: boolean;
  readonly parseStatus: string;
  readonly parseWarning: string;
  readonly textBody: string;
  readonly hasHtmlBody: boolean;
  readonly attachments: readonly UserAttachmentItem[];
  readonly canDeleteMessage: boolean;
}

export type MessageActionResult<T = unknown> =
  | { readonly ok: true; readonly data: T; readonly message?: string }
  | {
      readonly ok: false;
      readonly code: "not_found" | "forbidden" | "validation" | "unavailable";
      readonly error: string;
    };

export interface LiveUpdateMessageItem {
  readonly id: number;
  readonly uuid: string;
  readonly mailbox_uuid: string;
  readonly mailbox: string;
  readonly sender_name: string;
  readonly sender_address: string;
  readonly subject: string;
  readonly preview: string;
  readonly received_at: string | null;
  readonly size_bytes: number;
  readonly has_attachments: boolean;
  readonly is_read: boolean;
  readonly detail_url: string;
}

export interface LiveUpdateMailboxItem {
  readonly uuid: string;
  readonly email_address: string;
  readonly status: string;
  readonly total_messages: number;
  readonly unread_messages: number;
  readonly last_received_at: string | null;
}

export interface LiveUpdatePayload {
  readonly cursor: number;
  readonly has_more: boolean;
  readonly summary: {
    readonly total_mailboxes: number;
    readonly active_mailboxes: number;
    readonly disabled_mailboxes: number;
    readonly total_messages: number;
    readonly total_unread: number;
    readonly last_received: string | null;
  };
  readonly mailboxes_truncated: boolean;
  readonly mailboxes: readonly LiveUpdateMailboxItem[];
  readonly messages: readonly LiveUpdateMessageItem[];
}

export interface ConfinedAttachmentDownload {
  readonly uuid: string;
  readonly safeFilename: string;
  readonly detectedMimeType: string;
  readonly sizeBytes: number;
  readonly storageRelativePath: string;
  readonly absoluteFilePath: string;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function buildMessagePreview(
  textBody: string,
  sanitizedHtmlBody: string,
  limit = 180,
): string {
  const raw = textBody.trim()
    ? textBody
    : stripHtmlTags(sanitizedHtmlBody || "");
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function parseAddressArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function buildAccessibleMailboxWhere(
  actor: Pick<UserWorkspaceActor, "userId" | "isAdministrator">,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  if (actor.isAdministrator) {
    return {
      deletedAt: null,
      ...extra,
    };
  }
  return {
    deletedAt: null,
    memberships: {
      some: {
        userId: actor.userId,
      },
    },
    ...extra,
  };
}

function buildAccessibleMessageWhere(
  actor: Pick<UserWorkspaceActor, "userId" | "isAdministrator">,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  if (actor.isAdministrator) {
    return {
      deletedAt: null,
      mailbox: {
        deletedAt: null,
      },
      ...extra,
    };
  }
  return {
    deletedAt: null,
    mailbox: {
      deletedAt: null,
      memberships: {
        some: {
          userId: actor.userId,
        },
      },
    },
    ...extra,
  };
}

async function resolveActorCapabilities(
  prisma: Pick<PrismaClient, "userAccessPolicy">,
  actor: Pick<UserWorkspaceActor, "userId" | "isAdministrator">,
): Promise<UserAccessCapabilities> {
  if (actor.isAdministrator) {
    return {
      canDeleteMessages: true,
      canDeleteMailboxes: true,
    };
  }
  return getUserAccessCapabilities(prisma, actor.userId);
}

async function resolveActorIdForDatabase(
  prisma: Pick<PrismaClient, "user">,
  actorId: bigint,
): Promise<bigint | null> {
  try {
    const found = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true },
    });
    return found ? found.id : null;
  } catch {
    return null;
  }
}

export function createUnconfiguredUserWorkspaceOverview(
  actor: Pick<UserWorkspaceActor, "isAdministrator">,
): UserWorkspaceOverviewSnapshot {
  return {
    databaseConfigured: false,
    totalMailboxes: 0,
    activeMailboxes: 0,
    disabledMailboxes: 0,
    totalMessages: 0,
    totalUnread: 0,
    lastReceivedAt: null,
    recentMessages: [],
    recentMailboxes: [],
    availableDomains: [],
    capabilities: {
      canDeleteMessages: actor.isAdministrator,
      canDeleteMailboxes: actor.isAdministrator,
    },
  };
}

export function createUnconfiguredUserMailboxList(
  actor: Pick<UserWorkspaceActor, "isAdministrator">,
): UserMailboxListResult {
  return {
    databaseConfigured: false,
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    query: "",
    statusFilter: "all",
    availableDomains: [],
    capabilities: {
      canDeleteMessages: actor.isAdministrator,
      canDeleteMailboxes: actor.isAdministrator,
    },
  };
}

export async function getUserWorkspaceOverview(
  prisma: Pick<
    PrismaClient,
    "mailbox" | "message" | "domain" | "userAccessPolicy"
  >,
  actor: UserWorkspaceActor,
): Promise<UserWorkspaceOverviewSnapshot> {
  const mailboxWhere = buildAccessibleMailboxWhere(actor);
  const messageWhere = buildAccessibleMessageWhere(actor);

  const [
    totalMailboxes,
    activeMailboxes,
    disabledMailboxes,
    totalMessages,
    totalUnread,
    latestAggregate,
    recentMessages,
    recentMailboxes,
    domains,
    capabilities,
  ] = await Promise.all([
    prisma.mailbox.count({ where: mailboxWhere }),
    prisma.mailbox.count({
      where: { ...mailboxWhere, status: "active" },
    }),
    prisma.mailbox.count({
      where: { ...mailboxWhere, status: "disabled" },
    }),
    prisma.message.count({ where: messageWhere }),
    prisma.message.count({
      where: { ...messageWhere, isRead: false },
    }),
    prisma.message.aggregate({
      where: messageWhere,
      _max: { receivedAt: true },
    }),
    prisma.message.findMany({
      where: messageWhere,
      orderBy: [
        { receivedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 8,
      select: {
        id: true,
        uuid: true,
        senderName: true,
        senderAddress: true,
        subject: true,
        textBody: true,
        sanitizedHtmlBody: true,
        receivedAt: true,
        isRead: true,
        hasAttachments: true,
        sizeBytes: true,
        mailbox: {
          select: {
            uuid: true,
            emailAddress: true,
          },
        },
      },
    }),
    prisma.mailbox.findMany({
      where: mailboxWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        uuid: true,
        localPart: true,
        emailAddress: true,
        status: true,
        totalMessages: true,
        unreadMessages: true,
        lastReceivedAt: true,
        createdAt: true,
        domain: {
          select: {
            uuid: true,
            name: true,
          },
        },
      },
    }),
    prisma.domain.findMany({
      where: { status: "active", verificationStatus: "verified" },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, uuid: true, name: true, isDefault: true },
    }),
    resolveActorCapabilities(prisma, actor),
  ]);

  return {
    databaseConfigured: true,
    totalMailboxes,
    activeMailboxes,
    disabledMailboxes,
    totalMessages,
    totalUnread,
    lastReceivedAt: latestAggregate._max.receivedAt
      ? latestAggregate._max.receivedAt.toISOString()
      : null,
    recentMessages: recentMessages.map((msg) => ({
      id: msg.id.toString(),
      uuid: msg.uuid,
      mailboxUuid: msg.mailbox.uuid,
      mailboxEmail: msg.mailbox.emailAddress,
      senderName: msg.senderName,
      senderAddress: msg.senderAddress,
      subject: msg.subject || "(No subject)",
      preview: buildMessagePreview(msg.textBody, msg.sanitizedHtmlBody),
      receivedAt: msg.receivedAt ? msg.receivedAt.toISOString() : null,
      isRead: msg.isRead,
      hasAttachments: msg.hasAttachments,
      sizeBytes: msg.sizeBytes.toString(),
    })),
    recentMailboxes: recentMailboxes.map((mbx) => ({
      id: mbx.id.toString(),
      uuid: mbx.uuid,
      localPart: mbx.localPart,
      emailAddress: mbx.emailAddress,
      domainUuid: mbx.domain.uuid,
      domainName: mbx.domain.name,
      status: mbx.status,
      totalMessages: mbx.totalMessages.toString(),
      unreadMessages: mbx.unreadMessages.toString(),
      lastReceivedAt: mbx.lastReceivedAt
        ? mbx.lastReceivedAt.toISOString()
        : null,
      createdAt: mbx.createdAt.toISOString(),
    })),
    availableDomains: domains.map((d) => ({
      id: d.id.toString(),
      uuid: d.uuid,
      name: d.name,
      isDefault: d.isDefault,
    })),
    capabilities,
  };
}

export async function listUserMailboxes(
  prisma: Pick<PrismaClient, "mailbox" | "domain" | "userAccessPolicy">,
  actor: UserWorkspaceActor,
  options: {
    readonly query?: string;
    readonly status?: string;
    readonly page?: number;
    readonly pageSize?: number;
  } = {},
): Promise<UserMailboxListResult> {
  const query = (options.query ?? "").trim();
  const statusFilter: "all" | "active" | "disabled" =
    options.status === "active" || options.status === "disabled"
      ? options.status
      : "all";
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
  const requestedPage = Math.max(options.page ?? 1, 1);

  const extraWhere: Record<string, unknown> = {};
  if (statusFilter !== "all") {
    extraWhere.status = statusFilter;
  }
  if (query.length > 0) {
    extraWhere.OR = [
      { localPart: { contains: query, mode: "insensitive" } },
      { emailAddress: { contains: query, mode: "insensitive" } },
    ];
  }

  const where = buildAccessibleMailboxWhere(actor, extraWhere);

  const [totalCount, domains, capabilities] = await Promise.all([
    prisma.mailbox.count({ where }),
    prisma.domain.findMany({
      where: { status: "active", verificationStatus: "verified" },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, uuid: true, name: true, isDefault: true },
    }),
    resolveActorCapabilities(prisma, actor),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const rows = await prisma.mailbox.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      uuid: true,
      localPart: true,
      emailAddress: true,
      status: true,
      totalMessages: true,
      unreadMessages: true,
      lastReceivedAt: true,
      createdAt: true,
      domain: {
        select: {
          uuid: true,
          name: true,
        },
      },
    },
  });

  return {
    databaseConfigured: true,
    items: rows.map((row) => ({
      id: row.id.toString(),
      uuid: row.uuid,
      localPart: row.localPart,
      emailAddress: row.emailAddress,
      domainUuid: row.domain.uuid,
      domainName: row.domain.name,
      status: row.status,
      totalMessages: row.totalMessages.toString(),
      unreadMessages: row.unreadMessages.toString(),
      lastReceivedAt: row.lastReceivedAt
        ? row.lastReceivedAt.toISOString()
        : null,
      createdAt: row.createdAt.toISOString(),
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    query,
    statusFilter,
    availableDomains: domains.map((d) => ({
      id: d.id.toString(),
      uuid: d.uuid,
      name: d.name,
      isDefault: d.isDefault,
    })),
    capabilities,
  };
}

export async function createUserSelfMailbox(
  prisma: MailboxPrismaClient,
  actor: UserWorkspaceActor,
  input: {
    readonly localPart: string;
    readonly domainUuid?: string;
  },
  config: MailboxRuntimeConfig,
  options: {
    readonly sqlExecutor?: SqlQueryExecutor;
    readonly lockOptions?: ProvisionLockOptions;
  } = {},
): Promise<
  MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
> {
  return provisionMailbox(
    prisma,
    {
      localPart: input.localPart,
      domainUuid: input.domainUuid,
      assignedUserIds: actor.isAdministrator ? [] : [actor.userId.toString()],
      allowReserved: false,
    },
    config,
    {
      actorId: actor.userId,
      headers: actor.headers,
      clientIp: actor.clientIp,
      userAgent: actor.userAgent,
      trustProxyHeaders: actor.trustProxyHeaders,
    },
    options,
  );
}

export async function deleteUserMailbox(
  prisma: MailboxPrismaClient,
  actor: UserWorkspaceActor,
  mailboxUuid: string,
  confirmationEmail: string,
  config: Pick<
    MailboxRuntimeConfig,
    "mailStorageRoot" | "attachmentStorageRoot"
  >,
  sqlExecutor?: SqlQueryExecutor,
): Promise<MailboxActionResult<{ emailAddress: string }>> {
  if (!isValidUuid(mailboxUuid)) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  const capabilities = await resolveActorCapabilities(prisma, actor);
  if (!capabilities.canDeleteMailboxes) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  const accessible = await prisma.mailbox.findFirst({
    where: buildAccessibleMailboxWhere(actor, { uuid: mailboxUuid.trim() }),
    select: { uuid: true },
  });
  if (!accessible) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  return purgeMailbox(
    prisma,
    mailboxUuid,
    confirmationEmail,
    config,
    {
      actorId: actor.userId,
      headers: actor.headers,
      clientIp: actor.clientIp,
      userAgent: actor.userAgent,
      trustProxyHeaders: actor.trustProxyHeaders,
    },
    sqlExecutor,
  );
}

export async function bulkDeleteUserMailboxes(
  prisma: MailboxPrismaClient,
  actor: UserWorkspaceActor,
  mailboxUuids: readonly string[],
  confirmed: boolean,
  config: Pick<
    MailboxRuntimeConfig,
    "mailStorageRoot" | "attachmentStorageRoot"
  >,
  sqlExecutor?: SqlQueryExecutor,
): Promise<
  MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }>
> {
  const capabilities = await resolveActorCapabilities(prisma, actor);
  if (!capabilities.canDeleteMailboxes) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  const validUuids = Array.from(
    new Set(mailboxUuids.map((u) => u.trim()).filter(isValidUuid)),
  );
  if (validUuids.length === 0) {
    return {
      ok: false,
      code: "validation",
      error: "Select at least one mailbox to permanently delete.",
    };
  }

  const accessibleRows = await prisma.mailbox.findMany({
    where: buildAccessibleMailboxWhere(actor, { uuid: { in: validUuids } }),
    select: { uuid: true },
  });

  if (accessibleRows.length === 0) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  return bulkPurgeMailboxes(
    prisma,
    accessibleRows.map((row) => row.uuid),
    confirmed,
    config,
    {
      actorId: actor.userId,
      headers: actor.headers,
      clientIp: actor.clientIp,
      userAgent: actor.userAgent,
      trustProxyHeaders: actor.trustProxyHeaders,
    },
    sqlExecutor,
  );
}

export function normalizeReadFilter(value?: string): InboxReadFilter {
  if (value === "unread" || value === "1") return "unread";
  if (value === "read") return "read";
  return "all";
}

export function normalizeAttachmentFilter(
  value?: string,
): InboxAttachmentFilter {
  if (value === "yes" || value === "1") return "yes";
  if (value === "no") return "no";
  return "all";
}

export async function listMailboxMessagesForUser(
  prisma: Pick<
    PrismaClient,
    "mailbox" | "message" | "userAccessPolicy" | "user" | "auditLog"
  >,
  actor: UserWorkspaceActor,
  mailboxUuid: string,
  filter: {
    readonly query?: string;
    readonly read?: string;
    readonly attachments?: string;
    readonly page?: number;
    readonly pageSize?: number;
  } = {},
  options: { readonly recordAccessAudit?: boolean } = {},
): Promise<UserInboxListResult | null> {
  if (!isValidUuid(mailboxUuid)) {
    return null;
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: buildAccessibleMailboxWhere(actor, { uuid: mailboxUuid.trim() }),
    select: {
      id: true,
      uuid: true,
      localPart: true,
      emailAddress: true,
      status: true,
      totalMessages: true,
      unreadMessages: true,
      lastReceivedAt: true,
      domain: { select: { name: true } },
    },
  });

  if (!mailbox) {
    return null;
  }

  const query = (filter.query ?? "").trim();
  const readFilter = normalizeReadFilter(filter.read);
  const attachmentFilter = normalizeAttachmentFilter(filter.attachments);
  const pageSize = Math.min(Math.max(filter.pageSize ?? 30, 1), 100);
  const requestedPage = Math.max(filter.page ?? 1, 1);

  const messageWhere: Record<string, unknown> = {
    mailboxId: mailbox.id,
    deletedAt: null,
  };

  if (query.length > 0) {
    messageWhere.OR = [
      { senderName: { contains: query, mode: "insensitive" } },
      { senderAddress: { contains: query, mode: "insensitive" } },
      { subject: { contains: query, mode: "insensitive" } },
    ];
  }

  if (readFilter === "unread") {
    messageWhere.isRead = false;
  } else if (readFilter === "read") {
    messageWhere.isRead = true;
  }

  if (attachmentFilter === "yes") {
    messageWhere.hasAttachments = true;
  } else if (attachmentFilter === "no") {
    messageWhere.hasAttachments = false;
  }

  const [totalCount, capabilities] = await Promise.all([
    prisma.message.count({ where: messageWhere }),
    resolveActorCapabilities(prisma, actor),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const rows = await prisma.message.findMany({
    where: messageWhere,
    orderBy: [
      { receivedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    skip,
    take: pageSize,
    select: {
      id: true,
      uuid: true,
      senderName: true,
      senderAddress: true,
      subject: true,
      textBody: true,
      sanitizedHtmlBody: true,
      receivedAt: true,
      sizeBytes: true,
      isRead: true,
      hasAttachments: true,
      parseStatus: true,
    },
  });

  if (options.recordAccessAudit !== false) {
    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      actor.userId,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId,
      action: "inbox_access",
      targetType: "mailbox",
      targetIdentifier: mailbox.emailAddress,
      headers: actor.headers,
      clientIp: actor.clientIp,
      userAgent: actor.userAgent,
      trustProxyHeaders: actor.trustProxyHeaders,
    });
  }

  const liveUnfilteredFirstPage =
    query.length === 0 &&
    readFilter === "all" &&
    attachmentFilter === "all" &&
    page === 1;

  return {
    mailbox: {
      id: mailbox.id.toString(),
      uuid: mailbox.uuid,
      localPart: mailbox.localPart,
      emailAddress: mailbox.emailAddress,
      domainName: mailbox.domain.name,
      status: mailbox.status,
      totalMessages: Number(mailbox.totalMessages),
      unreadMessages: Number(mailbox.unreadMessages),
      lastReceivedAt: mailbox.lastReceivedAt
        ? mailbox.lastReceivedAt.toISOString()
        : null,
    },
    items: rows.map((row) => ({
      id: row.id.toString(),
      uuid: row.uuid,
      senderName: row.senderName,
      senderAddress: row.senderAddress,
      subject: row.subject || "(No subject)",
      preview: buildMessagePreview(row.textBody, row.sanitizedHtmlBody),
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      sizeBytes: Number(row.sizeBytes),
      isRead: row.isRead,
      hasAttachments: row.hasAttachments,
      parseStatus: row.parseStatus,
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    query,
    readFilter,
    attachmentFilter,
    liveUnfilteredFirstPage,
    canDeleteMailbox: capabilities.canDeleteMailboxes,
  };
}

export async function getMessageDetailForUser(
  prisma: Pick<
    PrismaClient,
    "mailbox" | "message" | "userAccessPolicy" | "user" | "auditLog"
  >,
  actor: UserWorkspaceActor,
  mailboxUuid: string,
  messageUuid: string,
): Promise<UserMessageDetail | null> {
  if (!isValidUuid(mailboxUuid) || !isValidUuid(messageUuid)) {
    return null;
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: buildAccessibleMailboxWhere(actor, { uuid: mailboxUuid.trim() }),
    select: {
      id: true,
      uuid: true,
      localPart: true,
      emailAddress: true,
      status: true,
      totalMessages: true,
      unreadMessages: true,
      lastReceivedAt: true,
      domain: { select: { name: true } },
    },
  });

  if (!mailbox) {
    return null;
  }

  const message = await prisma.message.findFirst({
    where: {
      uuid: messageUuid.trim(),
      mailboxId: mailbox.id,
      deletedAt: null,
    },
    select: {
      id: true,
      uuid: true,
      mailboxId: true,
      messageIdHeader: true,
      senderName: true,
      senderAddress: true,
      recipientAddresses: true,
      ccAddresses: true,
      subject: true,
      receivedAt: true,
      parsedAt: true,
      textBody: true,
      sanitizedHtmlBody: true,
      sizeBytes: true,
      isRead: true,
      hasAttachments: true,
      parseStatus: true,
      parseWarning: true,
      attachments: {
        orderBy: [{ id: "asc" }],
        select: {
          uuid: true,
          originalFilename: true,
          safeFilename: true,
          declaredMimeType: true,
          detectedMimeType: true,
          sizeBytes: true,
          isInline: true,
        },
      },
    },
  });

  if (!message) {
    return null;
  }

  const resolvedActorId = await resolveActorIdForDatabase(prisma, actor.userId);
  let totalMessages = Number(mailbox.totalMessages);
  let unreadMessages = Number(mailbox.unreadMessages);
  let lastReceivedAt = mailbox.lastReceivedAt;

  if (!message.isRead) {
    await prisma.message.update({
      where: { id: message.id },
      data: { isRead: true },
    });
    const counters = await recalculateMailboxCounters(prisma, mailbox.id);
    totalMessages = counters.totalMessages;
    unreadMessages = counters.unreadMessages;
    lastReceivedAt = counters.lastReceivedAt;

    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId,
      action: "message_auto_read",
      targetType: "message",
      targetIdentifier: message.uuid,
      headers: actor.headers,
      clientIp: actor.clientIp,
      userAgent: actor.userAgent,
      trustProxyHeaders: actor.trustProxyHeaders,
      details: { mailbox: mailbox.emailAddress },
    });
  }

  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId,
    action: "message_view",
    targetType: "message",
    targetIdentifier: message.uuid,
    headers: actor.headers,
    clientIp: actor.clientIp,
    userAgent: actor.userAgent,
    trustProxyHeaders: actor.trustProxyHeaders,
    details: { mailbox: mailbox.emailAddress },
  });

  const capabilities = await resolveActorCapabilities(prisma, actor);

  return {
    id: message.id.toString(),
    uuid: message.uuid,
    mailbox: {
      id: mailbox.id.toString(),
      uuid: mailbox.uuid,
      localPart: mailbox.localPart,
      emailAddress: mailbox.emailAddress,
      domainName: mailbox.domain.name,
      status: mailbox.status,
      totalMessages,
      unreadMessages,
      lastReceivedAt: lastReceivedAt ? lastReceivedAt.toISOString() : null,
    },
    messageIdHeader: message.messageIdHeader,
    senderName: message.senderName,
    senderAddress: message.senderAddress,
    recipientAddresses: parseAddressArray(message.recipientAddresses),
    ccAddresses: parseAddressArray(message.ccAddresses),
    subject: message.subject || "(No subject)",
    receivedAt: message.receivedAt ? message.receivedAt.toISOString() : null,
    parsedAt: message.parsedAt.toISOString(),
    sizeBytes: Number(message.sizeBytes),
    isRead: true,
    hasAttachments: message.hasAttachments,
    parseStatus: message.parseStatus,
    parseWarning: message.parseWarning,
    textBody: message.textBody,
    hasHtmlBody: message.sanitizedHtmlBody.trim().length > 0,
    attachments: message.attachments.map((att) => ({
      uuid: att.uuid,
      originalFilename: att.originalFilename,
      safeFilename: att.safeFilename,
      declaredMimeType: att.declaredMimeType,
      detectedMimeType: att.detectedMimeType,
      sizeBytes: Number(att.sizeBytes),
      isInline: att.isInline,
    })),
    canDeleteMessage: capabilities.canDeleteMessages,
  };
}

export async function markMessageUnreadForUser(
  prisma: Pick<
    PrismaClient,
    "mailbox" | "message" | "user" | "auditLog"
  >,
  actor: UserWorkspaceActor,
  mailboxUuid: string,
  messageUuid: string,
): Promise<MessageActionResult<{ uuid: string; isRead: boolean }>> {
  if (!isValidUuid(mailboxUuid) || !isValidUuid(messageUuid)) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: buildAccessibleMailboxWhere(actor, { uuid: mailboxUuid.trim() }),
    select: { id: true, emailAddress: true },
  });

  if (!mailbox) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  const message = await prisma.message.findFirst({
    where: {
      uuid: messageUuid.trim(),
      mailboxId: mailbox.id,
      deletedAt: null,
    },
    select: { id: true, uuid: true, isRead: true },
  });

  if (!message) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  if (message.isRead) {
    await prisma.message.update({
      where: { id: message.id },
      data: { isRead: false },
    });
    await recalculateMailboxCounters(prisma, mailbox.id);

    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      actor.userId,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId,
      action: "message_mark_unread",
      targetType: "message",
      targetIdentifier: message.uuid,
      headers: actor.headers,
      clientIp: actor.clientIp,
      userAgent: actor.userAgent,
      trustProxyHeaders: actor.trustProxyHeaders,
      details: { mailbox: mailbox.emailAddress },
    });
  }

  return {
    ok: true,
    data: { uuid: message.uuid, isRead: false },
    message: "Message marked as unread.",
  };
}

export async function softDeleteMessageForUser(
  prisma: Pick<
    PrismaClient,
    "mailbox" | "message" | "userAccessPolicy" | "user" | "auditLog"
  >,
  actor: UserWorkspaceActor,
  mailboxUuid: string,
  messageUuid: string,
): Promise<MessageActionResult<{ uuid: string }>> {
  if (!isValidUuid(mailboxUuid) || !isValidUuid(messageUuid)) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  const capabilities = await resolveActorCapabilities(prisma, actor);
  if (!capabilities.canDeleteMessages) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: buildAccessibleMailboxWhere(actor, { uuid: mailboxUuid.trim() }),
    select: { id: true, emailAddress: true },
  });

  if (!mailbox) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  const message = await prisma.message.findFirst({
    where: {
      uuid: messageUuid.trim(),
      mailboxId: mailbox.id,
      deletedAt: null,
    },
    select: { id: true, uuid: true },
  });

  if (!message) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  const resolvedActorId = await resolveActorIdForDatabase(prisma, actor.userId);

  await prisma.message.update({
    where: { id: message.id },
    data: {
      deletedAt: new Date(),
      deletedById: resolvedActorId,
    },
  });

  await recalculateMailboxCounters(prisma, mailbox.id);

  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId,
    action: "message_deleted",
    targetType: "message",
    targetIdentifier: message.uuid,
    headers: actor.headers,
    clientIp: actor.clientIp,
    userAgent: actor.userAgent,
    trustProxyHeaders: actor.trustProxyHeaders,
    details: {
      mailbox: mailbox.emailAddress,
      source_preserved: true,
    },
  });

  return {
    ok: true,
    data: { uuid: message.uuid },
    message: "Message deleted. The source email remains preserved.",
  };
}

export interface SanitizedHtmlRenderOptions {
  readonly theme?: "light" | "dark";
}

export function buildSanitizedHtmlDocument(
  sanitizedHtmlBody: string,
  options?: SanitizedHtmlRenderOptions,
): string {
  const body =
    sanitizedHtmlBody && sanitizedHtmlBody.trim().length > 0
      ? sanitizedHtmlBody
      : "<p>No HTML body is available.</p>";

  const lightCss =
    "html{color-scheme:light;color:#1b2733;background:#ffffff;font-family:\"Segoe UI\",\"Segoe UI Web\",system-ui,-apple-system,\"Helvetica Neue\",sans-serif;}" +
    "body{margin:0;padding:16px;font-size:13px;line-height:1.55;overflow-wrap:anywhere;}" +
    "img{max-width:100%;height:auto;}table{max-width:100%;border-collapse:collapse;}" +
    "th,td{border-color:#dce3e8;}" +
    "pre{white-space:pre-wrap;overflow-wrap:anywhere;}blockquote{margin-left:0;padding-left:14px;" +
    "border-left:3px solid #dce3e8;color:#5c6c7a;}a{color:#2558bf;}";

  const darkRules =
    "html{color-scheme:dark;color:#e3ebf0;background:#151e26;}" +
    "th,td{border-color:#283540;color:#e3ebf0;}" +
    "blockquote{border-left-color:#283540;color:#96a6b3;}a{color:#6b96f2;}";

  const themeCss =
    options?.theme === "dark"
      ? `${lightCss}${darkRules}`
      : options?.theme === "light"
        ? lightCss
        : `${lightCss}@media (prefers-color-scheme: dark){${darkRules}}`;

  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
    `<style>${themeCss}</style></head><body>` +
    body +
    "</body></html>"
  );
}

export async function getSanitizedMessageHtmlForUser(
  prisma: Pick<PrismaClient, "message" | "user" | "auditLog">,
  actor: UserWorkspaceActor,
  messageUuid: string,
  options?: SanitizedHtmlRenderOptions,
): Promise<string | null> {
  if (!isValidUuid(messageUuid)) {
    return null;
  }

  const message = await prisma.message.findFirst({
    where: buildAccessibleMessageWhere(actor, { uuid: messageUuid.trim() }),
    select: {
      uuid: true,
      sanitizedHtmlBody: true,
    },
  });

  if (!message) {
    return null;
  }

  const resolvedActorId = await resolveActorIdForDatabase(prisma, actor.userId);
  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId,
    action: "message_html_view",
    targetType: "message",
    targetIdentifier: message.uuid,
    headers: actor.headers,
    clientIp: actor.clientIp,
    userAgent: actor.userAgent,
    trustProxyHeaders: actor.trustProxyHeaders,
  });

  return buildSanitizedHtmlDocument(message.sanitizedHtmlBody, options);
}

export function buildAttachmentContentDisposition(
  safeFilename: string,
): string {
  const cleaned = safeFilename.replace(/[\r\n"\\]/g, "_").trim() || "attachment";
  const encoded = encodeURIComponent(cleaned).replace(
    /['()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${cleaned}"; filename*=UTF-8''${encoded}`;
}

export async function getAttachmentForUserDownload(
  prisma: Pick<PrismaClient, "attachment" | "user" | "auditLog">,
  actor: UserWorkspaceActor,
  attachmentUuid: string,
  attachmentStorageRoot: string,
): Promise<ConfinedAttachmentDownload | null> {
  if (!isValidUuid(attachmentUuid)) {
    return null;
  }

  const attachment = await prisma.attachment.findFirst({
    where: {
      uuid: attachmentUuid.trim(),
      message: buildAccessibleMessageWhere(actor),
    },
    select: {
      uuid: true,
      safeFilename: true,
      detectedMimeType: true,
      sizeBytes: true,
      storageRelativePath: true,
    },
  });

  if (!attachment) {
    return null;
  }

  let fullPath: string;
  try {
    const rawRelPath = attachment.storageRelativePath;
    if (
      !rawRelPath ||
      rawRelPath.startsWith("/") ||
      rawRelPath.startsWith("\\") ||
      rawRelPath.includes("\\")
    ) {
      throw new PathConfinementError(
        "Unsafe attachment relative path is not allowed.",
      );
    }
    const segments = rawRelPath.split("/");
    fullPath = confinedPath(attachmentStorageRoot, ...segments);
  } catch (error) {
    if (error instanceof PathConfinementError) {
      logger.warn("attachment_download_confinement_rejected", {
        attachmentUuid: attachment.uuid,
      });
    }
    return null;
  }

  try {
    const stat = await lstat(fullPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      logger.warn("attachment_download_non_regular_file", {
        attachmentUuid: attachment.uuid,
      });
      return null;
    }
  } catch {
    return null;
  }

  const resolvedActorId = await resolveActorIdForDatabase(prisma, actor.userId);
  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId,
    action: "attachment_download",
    targetType: "attachment",
    targetIdentifier: attachment.uuid,
    headers: actor.headers,
    clientIp: actor.clientIp,
    userAgent: actor.userAgent,
    trustProxyHeaders: actor.trustProxyHeaders,
  });

  return {
    uuid: attachment.uuid,
    safeFilename: attachment.safeFilename,
    detectedMimeType: attachment.detectedMimeType || "application/octet-stream",
    sizeBytes: Number(attachment.sizeBytes),
    storageRelativePath: attachment.storageRelativePath,
    absoluteFilePath: fullPath,
  };
}

export function isLiveBackgroundRequest(
  headers: Pick<Headers, "get">,
): boolean {
  return headers.get(LIVE_UPDATE_HEADER) === "1";
}

export async function pollLiveMessagesForUser(
  prisma: Pick<PrismaClient, "mailbox" | "message">,
  actor: Pick<UserWorkspaceActor, "userId" | "isAdministrator">,
  input: {
    readonly bootstrap?: boolean;
    readonly cursor?: number | bigint;
    readonly mailboxUuids?: readonly string[];
  } = {},
): Promise<LiveUpdatePayload> {
  const bootstrap = input.bootstrap === true;
  let requestedCursor = BigInt(0);
  try {
    const numeric =
      typeof input.cursor === "bigint"
        ? input.cursor
        : BigInt(Math.max(0, Math.floor(Number(input.cursor ?? 0) || 0)));
    if (numeric > BigInt(0)) {
      requestedCursor = numeric;
    }
  } catch {
    requestedCursor = BigInt(0);
  }

  const mailboxWhere = buildAccessibleMailboxWhere(actor);
  const messageWhere = buildAccessibleMessageWhere(actor);

  const [
    maxMessageAgg,
    totalMailboxes,
    activeMailboxes,
    disabledMailboxes,
    mailboxAggregates,
  ] = await Promise.all([
    prisma.message.aggregate({
      where: messageWhere,
      _max: { id: true },
    }),
    prisma.mailbox.count({ where: mailboxWhere }),
    prisma.mailbox.count({
      where: { ...mailboxWhere, status: "active" },
    }),
    prisma.mailbox.count({
      where: { ...mailboxWhere, status: "disabled" },
    }),
    prisma.mailbox.aggregate({
      where: mailboxWhere,
      _sum: {
        totalMessages: true,
        unreadMessages: true,
      },
      _max: {
        lastReceivedAt: true,
      },
    }),
  ]);

  const currentCursor = maxMessageAgg._max.id ?? BigInt(0);
  let nextCursor = bootstrap ? currentCursor : requestedCursor;
  const newMessages: LiveUpdateMessageItem[] = [];

  if (!bootstrap) {
    const rows = await prisma.message.findMany({
      where: {
        ...messageWhere,
        id: { gt: requestedCursor },
      },
      orderBy: [{ id: "asc" }],
      take: LIVE_UPDATE_MESSAGE_LIMIT,
      select: {
        id: true,
        uuid: true,
        senderName: true,
        senderAddress: true,
        subject: true,
        textBody: true,
        sanitizedHtmlBody: true,
        receivedAt: true,
        sizeBytes: true,
        hasAttachments: true,
        isRead: true,
        mailbox: {
          select: {
            uuid: true,
            emailAddress: true,
          },
        },
      },
    });

    for (const item of rows) {
      newMessages.push({
        id: Number(item.id),
        uuid: item.uuid,
        mailbox_uuid: item.mailbox.uuid,
        mailbox: item.mailbox.emailAddress,
        sender_name: item.senderName,
        sender_address: item.senderAddress,
        subject: item.subject || "(No subject)",
        preview: buildMessagePreview(item.textBody, item.sanitizedHtmlBody),
        received_at: item.receivedAt ? item.receivedAt.toISOString() : null,
        size_bytes: Number(item.sizeBytes),
        has_attachments: item.hasAttachments,
        is_read: item.isRead,
        detail_url: `/users/inbox/${item.mailbox.uuid}/${item.uuid}`,
      });
    }

    if (rows.length > 0) {
      nextCursor = rows[rows.length - 1]!.id;
    }
  }

  const validMailboxUuids = (input.mailboxUuids ?? [])
    .map((raw) => raw.trim())
    .filter(isValidUuid)
    .slice(0, LIVE_UPDATE_VISIBLE_MAILBOX_LIMIT);

  const mailboxRowsWhere =
    validMailboxUuids.length > 0
      ? buildAccessibleMailboxWhere(actor, { uuid: { in: validMailboxUuids } })
      : mailboxWhere;

  const mailboxRows = await prisma.mailbox.findMany({
    where: mailboxRowsWhere,
    orderBy: [{ emailAddress: "asc" }],
    take: LIVE_UPDATE_MAILBOX_LIMIT,
    select: {
      uuid: true,
      emailAddress: true,
      status: true,
      totalMessages: true,
      unreadMessages: true,
      lastReceivedAt: true,
    },
  });

  return {
    cursor: Number(nextCursor),
    has_more: !bootstrap && nextCursor < currentCursor,
    summary: {
      total_mailboxes: totalMailboxes,
      active_mailboxes: activeMailboxes,
      disabled_mailboxes: disabledMailboxes,
      total_messages: Number(mailboxAggregates._sum.totalMessages ?? BigInt(0)),
      total_unread: Number(mailboxAggregates._sum.unreadMessages ?? BigInt(0)),
      last_received: mailboxAggregates._max.lastReceivedAt
        ? mailboxAggregates._max.lastReceivedAt.toISOString()
        : null,
    },
    mailboxes_truncated: totalMailboxes > LIVE_UPDATE_MAILBOX_LIMIT,
    mailboxes: mailboxRows.map((row) => ({
      uuid: row.uuid,
      email_address: row.emailAddress,
      status: row.status,
      total_messages: Number(row.totalMessages),
      unread_messages: Number(row.unreadMessages),
      last_received_at: row.lastReceivedAt
        ? row.lastReceivedAt.toISOString()
        : null,
    })),
    messages: newMessages,
  };
}
