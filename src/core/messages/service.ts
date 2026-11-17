import {
  getUserAccessCapabilities,
  type UserAccessCapabilities,
} from "@/core/accounts/policy";
import {
  canUserCreateMoreMailboxes,
  computeMessageRetentionCutoff,
  getUserControlSettings,
  getUserExtendedPolicy,
  isDomainAllowedForUser,
  resolveEffectiveUserPolicy,
} from "@/core/accounts/user-control-policy";
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

export const LIVE_UPDATE_HEADER = "X-ReadBox-Live-Request";
export const LIVE_UPDATE_MESSAGE_LIMIT = 20;
export const LIVE_UPDATE_MAILBOX_LIMIT = 50;
export const LIVE_UPDATE_VISIBLE_MAILBOX_LIMIT = 50;

export const SAFE_HTML_CSP_POLICY = [
  "default-src 'none'",
  "img-src data: 'self'",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export interface UserWorkspaceActor {
  readonly userId: bigint;
  readonly authSource?: "admin_table" | "user_table";
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
  readonly databaseError?: string;
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
  readonly databaseError?: string;
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
  readonly contentId?: string;
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
  readonly htmlBody?: string;
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
  prisma: Partial<Pick<PrismaClient, "userAccessPolicy" | "userControlSettings">>,
  actor: Pick<UserWorkspaceActor, "userId" | "isAdministrator">,
): Promise<UserAccessCapabilities> {
  if (actor.isAdministrator) {
    return {
      canDeleteMessages: true,
      canDeleteMailboxes: true,
      canCreateMailboxes: true,
      maxMailboxes: 0,
      allowedDomainUuids: [],
      autoDeleteEnabled: false,
      autoDeleteDays: 0,
    };
  }
  const hasPolicyClient = Boolean(prisma.userAccessPolicy);
  const [baseCaps, globalSettings] = await Promise.all([
    hasPolicyClient
      ? getUserAccessCapabilities(
          prisma as Pick<PrismaClient, "userAccessPolicy">,
          actor.userId,
        )
      : Promise.resolve({
          canDeleteMessages: false,
          canDeleteMailboxes: false,
        }),
    getUserControlSettings(prisma),
  ]);
  const effective = hasPolicyClient
    ? await getUserExtendedPolicy(
        prisma as Pick<PrismaClient, "userAccessPolicy">,
        actor.userId,
        globalSettings,
      )
    : {
        canDeleteMessages: globalSettings.defaultCanDeleteMessages,
        canDeleteMailboxes: globalSettings.defaultCanDeleteMailboxes,
        canCreateMailboxes: globalSettings.defaultCanCreateMailboxes,
        maxMailboxes: globalSettings.defaultMaxMailboxes,
        allowedDomainUuids: [...globalSettings.allowedDomainUuids],
        autoDeleteEnabled: globalSettings.autoDeleteEnabled,
        autoDeleteDays: globalSettings.autoDeleteDays,
      };
  return {
    canDeleteMessages: baseCaps.canDeleteMessages || effective.canDeleteMessages,
    canDeleteMailboxes:
      baseCaps.canDeleteMailboxes || effective.canDeleteMailboxes,
    canCreateMailboxes: effective.canCreateMailboxes,
    maxMailboxes: effective.maxMailboxes,
    allowedDomainUuids: effective.allowedDomainUuids,
    autoDeleteEnabled: effective.autoDeleteEnabled,
    autoDeleteDays: effective.autoDeleteDays,
  };
}

export function resolveInlineCidAttachmentsInHtml(
  html: string,
  attachments: readonly {
    readonly uuid: string;
    readonly contentId?: string | null;
    readonly originalFilename?: string | null;
    readonly safeFilename?: string | null;
    readonly isInline?: boolean;
  }[],
): string {
  if (!html || !attachments || attachments.length === 0) {
    return html;
  }
  const cidLookup = new Map<string, string>();
  for (const att of attachments) {
    if (!att.uuid) continue;
    const attachmentUrl = `/api/messages/attachment/${att.uuid}`;
    const rawCid = (att.contentId ?? "").replace(/^<|>$/g, "").trim();
    if (rawCid) {
      cidLookup.set(rawCid, attachmentUrl);
      cidLookup.set(rawCid.toLowerCase(), attachmentUrl);
    }
    if (att.isInline) {
      const orig = (att.originalFilename ?? "").trim();
      if (orig && !cidLookup.has(orig.toLowerCase())) {
        cidLookup.set(orig, attachmentUrl);
        cidLookup.set(orig.toLowerCase(), attachmentUrl);
      }
      const safe = (att.safeFilename ?? "").trim();
      if (safe && !cidLookup.has(safe.toLowerCase())) {
        cidLookup.set(safe, attachmentUrl);
        cidLookup.set(safe.toLowerCase(), attachmentUrl);
      }
    }
  }
  if (cidLookup.size === 0) {
    return html;
  }
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*["'])cid:([^"']+)(["'])/gi,
    (fullMatch, prefix: string, rawCid: string, suffix: string) => {
      const cleanedCid = rawCid.replace(/^<|>$/g, "").trim();
      if (!cleanedCid) return fullMatch;
      const resolvedUrl =
        cidLookup.get(cleanedCid) ?? cidLookup.get(cleanedCid.toLowerCase());
      return resolvedUrl ? `${prefix}${resolvedUrl}${suffix}` : fullMatch;
    },
  );
}

function resolveActorRetentionCutoff(
  capabilities: UserAccessCapabilities,
  isAdministrator: boolean,
): Date | null {
  if (isAdministrator) return null;
  return computeMessageRetentionCutoff({
    autoDeleteEnabled: Boolean(capabilities.autoDeleteEnabled),
    autoDeleteDays: capabilities.autoDeleteDays ?? 0,
  });
}

export function buildRetentionFilterClause(
  retentionCutoff: Date | null,
): Record<string, unknown> {
  if (!retentionCutoff) {
    return {};
  }
  return {
    AND: [
      {
        OR: [
          { receivedAt: { gte: retentionCutoff } },
          { receivedAt: null, createdAt: { gte: retentionCutoff } },
        ],
      },
    ],
  };
}

export function buildExpiredRetentionFilterClause(
  retentionCutoff: Date,
): Record<string, unknown> {
  return {
    OR: [
      { receivedAt: { lt: retentionCutoff } },
      { receivedAt: null, createdAt: { lt: retentionCutoff } },
    ],
  };
}

export function isMessageWithinRetention(
  msg: {
    readonly receivedAt?: Date | null;
    readonly createdAt?: Date | null;
  },
  retentionCutoff: Date | null,
): boolean {
  if (!retentionCutoff) {
    return true;
  }
  const effectiveDate = msg.receivedAt ?? msg.createdAt ?? null;
  if (!effectiveDate) {
    return true;
  }
  return effectiveDate >= retentionCutoff;
}

function filterDomainsForCapabilities<
  T extends { readonly uuid: string },
>(
  domains: readonly T[],
  capabilities: UserAccessCapabilities,
  isAdministrator: boolean,
): T[] {
  if (isAdministrator) return [...domains];
  const allowedDomainUuids = capabilities.allowedDomainUuids ?? [];
  if (allowedDomainUuids.length === 0) return [...domains];
  return domains.filter((d) =>
    isDomainAllowedForUser(d.uuid, { allowedDomainUuids }),
  );
}

async function resolveActorIdForDatabase(
  prisma: Pick<PrismaClient, "user">,
  actorId: bigint,
  authSource?: "admin_table" | "user_table",
): Promise<bigint | null> {
  if (authSource === "admin_table") return null;
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
  databaseError?: string,
): UserWorkspaceOverviewSnapshot {
  return {
    databaseConfigured: false,
    ...(databaseError ? { databaseError } : {}),
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
      canCreateMailboxes: true,
      maxMailboxes: actor.isAdministrator ? 0 : 3,
      allowedDomainUuids: [],
      autoDeleteEnabled: false,
      autoDeleteDays: 0,
    },
  };
}

export function createUnconfiguredUserMailboxList(
  actor: Pick<UserWorkspaceActor, "isAdministrator">,
  databaseError?: string,
): UserMailboxListResult {
  return {
    databaseConfigured: false,
    ...(databaseError ? { databaseError } : {}),
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
      canCreateMailboxes: true,
      maxMailboxes: actor.isAdministrator ? 0 : 3,
      allowedDomainUuids: [],
      autoDeleteEnabled: false,
      autoDeleteDays: 0,
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
  const capabilities = await resolveActorCapabilities(prisma, actor);
  const retentionCutoff = resolveActorRetentionCutoff(
    capabilities,
    actor.isAdministrator,
  );
  const mailboxWhere = buildAccessibleMailboxWhere(actor);
  const messageWhere = buildAccessibleMessageWhere(
    actor,
    buildRetentionFilterClause(retentionCutoff),
  );

  const [
    totalMailboxes,
    activeMailboxes,
    disabledMailboxes,
    totalMessages,
    totalUnread,
    latestAggregate,
    recentMessagesRaw,
    recentMailboxes,
    domains,
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
        createdAt: true,
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
  ]);

  const recentMessages = retentionCutoff
    ? recentMessagesRaw.filter((msg) =>
        isMessageWithinRetention(msg, retentionCutoff),
      )
    : recentMessagesRaw;
  const filteredDomains = filterDomainsForCapabilities(
    domains,
    capabilities,
    actor.isAdministrator,
  );

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
    availableDomains: filteredDomains.map((d) => ({
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

  const filteredDomains = filterDomainsForCapabilities(
    domains,
    capabilities,
    actor.isAdministrator,
  );

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
    availableDomains: filteredDomains.map((d) => ({
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
  let effectiveDomainUuid = input.domainUuid;

  if (!actor.isAdministrator) {
    const [capabilities, currentMailboxCount] = await Promise.all([
      resolveActorCapabilities(
        prisma as unknown as Pick<PrismaClient, "userAccessPolicy">,
        actor,
      ),
      prisma.mailbox.count({
        where: buildAccessibleMailboxWhere(actor),
      }),
    ]);

    const quotaCheck = canUserCreateMoreMailboxes(currentMailboxCount, {
      canCreateMailboxes: capabilities.canCreateMailboxes !== false,
      maxMailboxes: capabilities.maxMailboxes ?? 0,
    });

    if (!quotaCheck.allowed) {
      return {
        ok: false,
        code: "validation",
        error:
          quotaCheck.reason === "disabled"
            ? "Mailbox creation is disabled for your account by User Control policy."
            : `Mailbox limit reached (${currentMailboxCount}/${capabilities.maxMailboxes}). Contact an administrator to increase your quota.`,
      };
    }

    const allowedDomainUuids = capabilities.allowedDomainUuids ?? [];
    if (allowedDomainUuids.length > 0) {
      if (effectiveDomainUuid) {
        if (
          !isDomainAllowedForUser(effectiveDomainUuid, { allowedDomainUuids })
        ) {
          return {
            ok: false,
            code: "validation",
            error: "Selected domain is not permitted for your account.",
          };
        }
      } else {
        effectiveDomainUuid = allowedDomainUuids[0];
      }
    }
  }

  return provisionMailbox(
    prisma,
    {
      localPart: input.localPart,
      domainUuid: effectiveDomainUuid,
      assignedUserIds: actor.isAdministrator ? [] : [actor.userId.toString()],
      allowReserved: false,
    },
    config,
    {
      actorId: actor.userId,
      authSource: actor.authSource,
      actorUsername: actor.username,
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
      authSource: actor.authSource,
      actorUsername: actor.username,
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
      authSource: actor.authSource,
      actorUsername: actor.username,
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

  const [mailbox, capabilities] = await Promise.all([
    prisma.mailbox.findFirst({
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
    }),
    resolveActorCapabilities(prisma, actor),
  ]);

  if (!mailbox) {
    return null;
  }

  const retentionCutoff = resolveActorRetentionCutoff(
    capabilities,
    actor.isAdministrator,
  );

  const query = (filter.query ?? "").trim();
  const readFilter = normalizeReadFilter(filter.read);
  const attachmentFilter = normalizeAttachmentFilter(filter.attachments);
  const pageSize = Math.min(Math.max(filter.pageSize ?? 30, 1), 100);
  const requestedPage = Math.max(filter.page ?? 1, 1);

  const messageWhere: Record<string, unknown> = {
    mailboxId: mailbox.id,
    deletedAt: null,
    ...buildRetentionFilterClause(retentionCutoff),
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

  const totalCount = await prisma.message.count({ where: messageWhere });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const rowsRaw = await prisma.message.findMany({
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
      createdAt: true,
      sizeBytes: true,
      isRead: true,
      hasAttachments: true,
      parseStatus: true,
    },
  });

  const rows = retentionCutoff
    ? rowsRaw.filter((row) => isMessageWithinRetention(row, retentionCutoff))
    : rowsRaw;

  let headerTotalMessages = Number(mailbox.totalMessages);
  let headerUnreadMessages = Number(mailbox.unreadMessages);
  if (retentionCutoff) {
    const retentionMailboxBaseWhere: Record<string, unknown> = {
      mailboxId: mailbox.id,
      deletedAt: null,
      ...buildRetentionFilterClause(retentionCutoff),
    };
    const [retTotal, retUnread] = await Promise.all([
      prisma.message.count({ where: retentionMailboxBaseWhere }),
      prisma.message.count({
        where: { ...retentionMailboxBaseWhere, isRead: false },
      }),
    ]);
    headerTotalMessages = retTotal;
    headerUnreadMessages = retUnread;
  }

  if (options.recordAccessAudit !== false) {
    const resolvedActorId = await resolveActorIdForDatabase(
      prisma,
      actor.userId,
      actor.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? actor.userId,
      authSource: actor.authSource,
      actorUsername: actor.username,
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
      totalMessages: headerTotalMessages,
      unreadMessages: headerUnreadMessages,
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

  const [mailbox, capabilities] = await Promise.all([
    prisma.mailbox.findFirst({
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
    }),
    resolveActorCapabilities(prisma, actor),
  ]);

  if (!mailbox) {
    return null;
  }

  const retentionCutoff = resolveActorRetentionCutoff(
    capabilities,
    actor.isAdministrator,
  );

  const message = await prisma.message.findFirst({
    where: {
      uuid: messageUuid.trim(),
      mailboxId: mailbox.id,
      deletedAt: null,
      ...buildRetentionFilterClause(retentionCutoff),
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
      createdAt: true,
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
          contentId: true,
        },
      },
    },
  });

  if (!message || !isMessageWithinRetention(message, retentionCutoff)) {
    return null;
  }

  const resolvedActorId = await resolveActorIdForDatabase(
    prisma,
    actor.userId,
    actor.authSource,
  );
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
      actorId: resolvedActorId ?? actor.userId,
      authSource: actor.authSource,
      actorUsername: actor.username,
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
    actorId: resolvedActorId ?? actor.userId,
    authSource: actor.authSource,
    actorUsername: actor.username,
    action: "message_view",
    targetType: "message",
    targetIdentifier: message.uuid,
    headers: actor.headers,
    clientIp: actor.clientIp,
    userAgent: actor.userAgent,
    trustProxyHeaders: actor.trustProxyHeaders,
    details: { mailbox: mailbox.emailAddress },
  });

  const hasHtmlBody = message.sanitizedHtmlBody.trim().length > 0;

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
    hasHtmlBody,
    attachments: message.attachments.map((att) => ({
      uuid: att.uuid,
      originalFilename: att.originalFilename,
      safeFilename: att.safeFilename,
      declaredMimeType: att.declaredMimeType,
      detectedMimeType: att.detectedMimeType,
      sizeBytes: Number(att.sizeBytes),
      isInline: att.isInline,
      contentId: att.contentId ?? "",
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
      actor.authSource,
    );
    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? actor.userId,
      authSource: actor.authSource,
      actorUsername: actor.username,
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

  const resolvedActorId = await resolveActorIdForDatabase(
    prisma,
    actor.userId,
    actor.authSource,
  );

  await prisma.message.update({
    where: { id: message.id },
    data: {
      deletedAt: new Date(),
      deletedById: resolvedActorId,
    },
  });

  await recalculateMailboxCounters(prisma, mailbox.id);

  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId ?? actor.userId,
    authSource: actor.authSource,
    actorUsername: actor.username,
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

function hardenSanitizedEmailHtmlForIframe(rawHtml: string): string {
  let working = rawHtml.replace(
    /<a\b([^>]*?)>/gi,
    (fullTag, attrs: string) => {
      const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
        attrs,
      );
      const href = (
        hrefMatch?.[1] ??
        hrefMatch?.[2] ??
        hrefMatch?.[3] ??
        ""
      ).trim();
      if (!href) {
        return fullTag;
      }
      const isMailtoOrHash =
        href.toLowerCase().startsWith("mailto:") || href.startsWith("#");
      let cleanedAttrs = attrs
        .replace(/\btarget\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\brel\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .trim();
      if (!isMailtoOrHash) {
        cleanedAttrs = `${cleanedAttrs} target="_blank" rel="noopener noreferrer"`.trim();
      }
      return `<a ${cleanedAttrs}>`;
    },
  );

  working = working.replace(
    /<button\b([^>]*?)>/gi,
    (fullTag, attrs: string) => {
      if (/\btype\s*=/i.test(attrs)) {
        return fullTag;
      }
      return `<button type="button"${attrs}>`;
    },
  );

  return working;
}

export function buildSanitizedHtmlDocument(
  sanitizedHtmlBody: string,
  options?: SanitizedHtmlRenderOptions,
): string {
  const rawBody =
    sanitizedHtmlBody && sanitizedHtmlBody.trim().length > 0
      ? sanitizedHtmlBody
      : "<p>No HTML body is available.</p>";
  const body = hardenSanitizedEmailHtmlForIframe(rawBody);

  const lightCss =
    "*{scrollbar-width:none;-ms-overflow-style:none;}*::-webkit-scrollbar{display:none;width:0;height:0;}" +
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
    "<meta name='readbox-html-body' content='1'>" +
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
      attachments: {
        orderBy: [{ id: "asc" }],
        select: {
          uuid: true,
          originalFilename: true,
          safeFilename: true,
          isInline: true,
          contentId: true,
        },
      },
    },
  });

  if (!message) {
    return null;
  }

  const resolvedActorId = await resolveActorIdForDatabase(
    prisma,
    actor.userId,
    actor.authSource,
  );
  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId ?? actor.userId,
    authSource: actor.authSource,
    actorUsername: actor.username,
    action: "message_html_view",
    targetType: "message",
    targetIdentifier: message.uuid,
    headers: actor.headers,
    clientIp: actor.clientIp,
    userAgent: actor.userAgent,
    trustProxyHeaders: actor.trustProxyHeaders,
  });

  const resolvedHtml = resolveInlineCidAttachmentsInHtml(
    message.sanitizedHtmlBody,
    message.attachments ?? [],
  );

  return buildSanitizedHtmlDocument(resolvedHtml, options);
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

  const resolvedActorId = await resolveActorIdForDatabase(
    prisma,
    actor.userId,
    actor.authSource,
  );
  await recordAudit(prisma as unknown as AuditWriteClient, {
    actorId: resolvedActorId ?? actor.userId,
    authSource: actor.authSource,
    actorUsername: actor.username,
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
  prisma: Pick<PrismaClient, "mailbox" | "message"> &
    Partial<Pick<PrismaClient, "userAccessPolicy" | "userControlSettings">>,
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

  const capabilities = await resolveActorCapabilities(prisma, actor);
  const retentionCutoff = resolveActorRetentionCutoff(
    capabilities,
    actor.isAdministrator,
  );

  const mailboxWhere = buildAccessibleMailboxWhere(actor);
  const messageWhere = buildAccessibleMessageWhere(
    actor,
    buildRetentionFilterClause(retentionCutoff),
  );

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
    const rowsRaw = await prisma.message.findMany({
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
        createdAt: true,
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

    const rows = retentionCutoff
      ? rowsRaw.filter((row) => isMessageWithinRetention(row, retentionCutoff))
      : rowsRaw;

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

    if (rowsRaw.length > 0) {
      nextCursor = rowsRaw[rowsRaw.length - 1]!.id;
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
      id: true,
      uuid: true,
      emailAddress: true,
      status: true,
      totalMessages: true,
      unreadMessages: true,
      lastReceivedAt: true,
    },
  });

  let summaryTotalMessages = Number(
    mailboxAggregates._sum.totalMessages ?? BigInt(0),
  );
  let summaryUnreadMessages = Number(
    mailboxAggregates._sum.unreadMessages ?? BigInt(0),
  );

  const retentionMailboxCounts = new Map<
    string,
    { totalMessages: number; unreadMessages: number }
  >();

  if (retentionCutoff) {
    const [retTotal, retUnread] = await Promise.all([
      prisma.message.count({ where: messageWhere }),
      prisma.message.count({ where: { ...messageWhere, isRead: false } }),
    ]);
    summaryTotalMessages = retTotal;
    summaryUnreadMessages = retUnread;

    await Promise.all(
      mailboxRows.map(async (mbx) => {
        if (mbx.id === undefined) return;
        const mbxBaseWhere: Record<string, unknown> = {
          mailboxId: mbx.id,
          deletedAt: null,
          ...buildRetentionFilterClause(retentionCutoff),
        };
        const [mbxTotal, mbxUnread] = await Promise.all([
          prisma.message.count({ where: mbxBaseWhere }),
          prisma.message.count({ where: { ...mbxBaseWhere, isRead: false } }),
        ]);
        retentionMailboxCounts.set(mbx.uuid, {
          totalMessages: mbxTotal,
          unreadMessages: mbxUnread,
        });
      }),
    );
  }

  return {
    cursor: Number(nextCursor),
    has_more: !bootstrap && nextCursor < currentCursor,
    summary: {
      total_mailboxes: totalMailboxes,
      active_mailboxes: activeMailboxes,
      disabled_mailboxes: disabledMailboxes,
      total_messages: summaryTotalMessages,
      total_unread: summaryUnreadMessages,
      last_received: mailboxAggregates._max.lastReceivedAt
        ? mailboxAggregates._max.lastReceivedAt.toISOString()
        : null,
    },
    mailboxes_truncated: totalMailboxes > LIVE_UPDATE_MAILBOX_LIMIT,
    mailboxes: mailboxRows.map((row) => {
      const retOverride = retentionMailboxCounts.get(row.uuid);
      return {
        uuid: row.uuid,
        email_address: row.emailAddress,
        status: row.status,
        total_messages: retOverride
          ? retOverride.totalMessages
          : Number(row.totalMessages),
        unread_messages: retOverride
          ? retOverride.unreadMessages
          : Number(row.unreadMessages),
        last_received_at: row.lastReceivedAt
          ? row.lastReceivedAt.toISOString()
          : null,
      };
    }),
    messages: newMessages,
  };
}

export interface RetentionPurgeSummary {
  readonly dryRun: boolean;
  readonly retentionDays: number;
  readonly cutoffIso: string | null;
  readonly scannedMailboxes: number;
  readonly affectedMailboxes: number;
  readonly purgedMessages: number;
  readonly errors?: number;
}

const RETENTION_PURGE_BATCH_SIZE = 500;

interface RetentionMembershipRow {
  readonly mailboxId: bigint;
  readonly user?: {
    readonly isActive?: boolean;
    readonly accessPolicy?: {
      readonly canCreateMailboxes?: boolean | null;
      readonly canDeleteMessages?: boolean | null;
      readonly canDeleteMailboxes?: boolean | null;
      readonly maxMailboxes?: number | null;
      readonly allowedDomainUuids?: readonly string[] | null;
      readonly autoDeleteEnabled?: boolean | null;
      readonly autoDeleteDays?: number | null;
    } | null;
  } | null;
}

export async function purgeExpiredMessagesForRetention(
  prisma: Pick<PrismaClient, "mailbox" | "message"> &
    Partial<
      Pick<
        PrismaClient,
        | "userControlSettings"
        | "user"
        | "auditLog"
        | "mailboxMembership"
        | "userAccessPolicy"
      >
    >,
  options: {
    readonly dryRun?: boolean;
    readonly retentionDays?: number;
    readonly mailboxUuid?: string;
    readonly now?: Date;
    readonly actor?: Partial<UserWorkspaceActor>;
  } = {},
): Promise<RetentionPurgeSummary> {
  const dryRun = options.dryRun === true;
  const now = options.now ?? new Date();
  const globalSettings = await getUserControlSettings(prisma);

  const explicitDays =
    typeof options.retentionDays === "number" &&
    Number.isFinite(options.retentionDays)
      ? Math.max(0, Math.floor(options.retentionDays))
      : undefined;

  const globalDays =
    explicitDays !== undefined
      ? explicitDays
      : globalSettings.autoDeleteEnabled
        ? globalSettings.autoDeleteDays
        : 0;

  const globalCutoff =
    globalDays > 0
      ? computeMessageRetentionCutoff(
          { autoDeleteEnabled: true, autoDeleteDays: globalDays },
          now,
        )
      : null;

  const mailboxWhere: Record<string, unknown> = {
    deletedAt: null,
    ...(options.mailboxUuid?.trim()
      ? { uuid: options.mailboxUuid.trim() }
      : {}),
  };

  const mailboxes = await prisma.mailbox.findMany({
    where: mailboxWhere,
    select: {
      id: true,
      uuid: true,
      emailAddress: true,
    },
  });

  if (mailboxes.length === 0) {
    return {
      dryRun,
      retentionDays: globalDays,
      cutoffIso: globalCutoff ? globalCutoff.toISOString() : null,
      scannedMailboxes: 0,
      affectedMailboxes: 0,
      purgedMessages: 0,
      errors: 0,
    };
  }

  // When no explicit override is supplied, resolve per-mailbox retention from
  // assigned users' effective policies (inheriting global UserControlSettings
  // whenever per-user fields are NULL).
  const membershipsByMailbox = new Map<bigint, RetentionMembershipRow[]>();
  if (
    explicitDays === undefined &&
    prisma.mailboxMembership &&
    typeof prisma.mailboxMembership.findMany === "function"
  ) {
    try {
      const rows = (await prisma.mailboxMembership.findMany({
        where: {
          mailboxId: { in: mailboxes.map((mbx) => mbx.id) },
        },
        select: {
          mailboxId: true,
          user: {
            select: {
              isActive: true,
              accessPolicy: {
                select: {
                  canCreateMailboxes: true,
                  canDeleteMessages: true,
                  canDeleteMailboxes: true,
                  maxMailboxes: true,
                  allowedDomainUuids: true,
                  autoDeleteEnabled: true,
                  autoDeleteDays: true,
                },
              },
            },
          },
        },
      })) as unknown as RetentionMembershipRow[];

      for (const row of rows) {
        if (!row || typeof row.mailboxId !== "bigint") continue;
        const list = membershipsByMailbox.get(row.mailboxId) ?? [];
        list.push(row);
        membershipsByMailbox.set(row.mailboxId, list);
      }
    } catch {
      // Partial mock or unavailable membership relation: fall back to global retention cutoff.
    }
  }

  function resolveMailboxRetentionDays(mailboxId: bigint): number {
    if (explicitDays !== undefined) {
      return explicitDays;
    }
    const members = membershipsByMailbox.get(mailboxId);
    if (!members || members.length === 0) {
      return globalDays;
    }
    const activeMembers = members.filter((m) => m.user?.isActive !== false);
    const relevantMembers = activeMembers.length > 0 ? activeMembers : members;

    const effectiveDaysList = relevantMembers.map((member) => {
      const effective = resolveEffectiveUserPolicy(
        globalSettings,
        member.user?.accessPolicy ?? null,
      );
      return effective.autoDeleteEnabled ? effective.autoDeleteDays : 0;
    });

    // If any active member has retention disabled (0), do not purge shared messages.
    if (effectiveDaysList.some((days) => days <= 0)) {
      return 0;
    }
    return Math.max(...effectiveDaysList);
  }

  let affectedMailboxes = 0;
  let purgedMessages = 0;
  let errors = 0;
  let maxAppliedRetentionDays = globalDays;
  let latestRepresentativeCutoff = globalCutoff;

  const messageDelegate = prisma.message as unknown as {
    count?: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
      orderBy?: Record<string, "asc" | "desc">;
      take?: number;
    }) => Promise<Array<{ id: bigint; receivedAt?: Date | null; createdAt?: Date | null }>>;
    updateMany?: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
    update: (args: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };

  for (const mailbox of mailboxes) {
    const mailboxDays = resolveMailboxRetentionDays(mailbox.id);
    const mailboxCutoff =
      mailboxDays > 0
        ? computeMessageRetentionCutoff(
            { autoDeleteEnabled: true, autoDeleteDays: mailboxDays },
            now,
          )
        : null;

    if (!mailboxCutoff) {
      continue;
    }

    if (mailboxDays > maxAppliedRetentionDays) {
      maxAppliedRetentionDays = mailboxDays;
      latestRepresentativeCutoff = mailboxCutoff;
    } else if (!latestRepresentativeCutoff) {
      latestRepresentativeCutoff = mailboxCutoff;
    }

    const expiredWhere: Record<string, unknown> = {
      mailboxId: mailbox.id,
      deletedAt: null,
      ...buildExpiredRetentionFilterClause(mailboxCutoff),
    };

    try {
      if (dryRun) {
        let expiredCount = 0;
        if (typeof messageDelegate.count === "function") {
          expiredCount = await messageDelegate.count({ where: expiredWhere });
        } else {
          const rows = await messageDelegate.findMany({
            where: expiredWhere,
            select: { id: true, receivedAt: true, createdAt: true },
          });
          expiredCount = rows.filter(
            (msg) => !isMessageWithinRetention(msg, mailboxCutoff),
          ).length;
        }

        if (expiredCount > 0) {
          affectedMailboxes += 1;
          purgedMessages += expiredCount;
        }
        continue;
      }

      let mailboxPurged = 0;
      while (true) {
        const batch = await messageDelegate.findMany({
          where: expiredWhere,
          select: { id: true },
          orderBy: { id: "asc" },
          take: RETENTION_PURGE_BATCH_SIZE,
        });

        if (batch.length === 0) {
          break;
        }

        const batchIds = batch.map((row) => row.id);
        let updatedCount = 0;

        if (typeof messageDelegate.updateMany === "function") {
          const result = await messageDelegate.updateMany({
            where: {
              id: { in: batchIds },
              deletedAt: null,
            },
            data: { deletedAt: now },
          });
          updatedCount =
            typeof result?.count === "number" ? result.count : batchIds.length;
        } else {
          for (const id of batchIds) {
            await messageDelegate.update({
              where: { id },
              data: { deletedAt: now },
            });
            updatedCount += 1;
          }
        }

        mailboxPurged += updatedCount;
        if (batch.length < RETENTION_PURGE_BATCH_SIZE || updatedCount === 0) {
          break;
        }
      }

      if (mailboxPurged > 0) {
        affectedMailboxes += 1;
        purgedMessages += mailboxPurged;
        await recalculateMailboxCounters(prisma, mailbox.id);
      }
    } catch (error) {
      errors += 1;
      logger.error("retention_purge_mailbox_failed", {
        mailboxUuid: mailbox.uuid,
        reason: error instanceof Error ? error.name : "RetentionError",
      });
    }
  }

  const effectiveSummaryDays =
    explicitDays !== undefined
      ? explicitDays
      : globalDays > 0
        ? globalDays
        : maxAppliedRetentionDays;
  const effectiveSummaryCutoff =
    explicitDays !== undefined || globalCutoff
      ? globalCutoff
      : latestRepresentativeCutoff;

  if (!dryRun && purgedMessages > 0 && prisma.auditLog) {
    const rawActorId = options.actor?.userId;
    const resolvedActorId =
      rawActorId && prisma.user
        ? await resolveActorIdForDatabase(
            prisma as Pick<PrismaClient, "user">,
            rawActorId,
            options.actor?.authSource,
          )
        : null;

    await recordAudit(prisma as unknown as AuditWriteClient, {
      actorId: resolvedActorId ?? rawActorId ?? null,
      authSource: options.actor?.authSource,
      actorUsername: options.actor?.username,
      action: "messages_retention_purged",
      targetType: "mailbox",
      targetIdentifier: options.mailboxUuid?.trim() || "all",
      headers: options.actor?.headers,
      clientIp: options.actor?.clientIp,
      userAgent: options.actor?.userAgent,
      trustProxyHeaders: options.actor?.trustProxyHeaders,
      details: {
        retention_days: effectiveSummaryDays,
        cutoff_iso: effectiveSummaryCutoff
          ? effectiveSummaryCutoff.toISOString()
          : null,
        scanned_mailboxes: mailboxes.length,
        affected_mailboxes: affectedMailboxes,
        purged_messages: purgedMessages,
        errors,
      },
    });
  }

  return {
    dryRun,
    retentionDays: effectiveSummaryDays,
    cutoffIso: effectiveSummaryCutoff
      ? effectiveSummaryCutoff.toISOString()
      : null,
    scannedMailboxes: mailboxes.length,
    affectedMailboxes,
    purgedMessages,
    errors,
  };
}
