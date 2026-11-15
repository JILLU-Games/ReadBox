import { env } from "@/config/env";
import type { MailboxActionResult } from "@/core/mailboxes/service";
import {
  buildSanitizedHtmlDocument,
  type LiveUpdatePayload,
  type MessageActionResult,
  type SanitizedHtmlRenderOptions,
  type UserInboxListResult,
  type UserMailboxListResult,
  type UserMessageDetail,
  type UserWorkspaceOverviewSnapshot,
} from "@/core/messages/service";

interface DemoMailboxRecord {
  id: string;
  uuid: string;
  localPart: string;
  emailAddress: string;
  domainUuid: string;
  domainName: string;
  status: "active" | "disabled";
  createdAt: string;
}

interface DemoAttachmentRecord {
  uuid: string;
  originalFilename: string;
  safeFilename: string;
  declaredMimeType: string;
  detectedMimeType: string;
  sizeBytes: number;
  isInline: boolean;
  content: string;
}

interface DemoMessageRecord {
  id: string;
  uuid: string;
  mailboxUuid: string;
  messageIdHeader: string;
  senderName: string;
  senderAddress: string;
  recipientAddresses: string[];
  ccAddresses: string[];
  subject: string;
  preview: string;
  receivedAt: string;
  parsedAt: string;
  sizeBytes: number;
  isRead: boolean;
  parseStatus: string;
  parseWarning: string;
  textBody: string;
  htmlBody: string | null;
  attachments: DemoAttachmentRecord[];
  deleted: boolean;
}

interface DemoStoreState {
  domains: Array<{ id: string; uuid: string; name: string; isDefault: boolean }>;
  mailboxes: DemoMailboxRecord[];
  messages: DemoMessageRecord[];
  nextMailboxId: number;
}

const globalForDemo = globalThis as typeof globalThis & {
  __readboxDemoUserStore?: DemoStoreState;
};

export function isDemoPreviewWorkspaceActive(): boolean {
  return (
    !env.databaseUrl &&
    env.nodeEnv !== "production" &&
    env.devAuthMode === "demo"
  );
}

function createInitialDemoStore(): DemoStoreState {
  return {
    domains: [
      {
        id: "1",
        uuid: "99999999-0000-4000-8000-000000000001",
        name: "mailstack.local",
        isDefault: true,
      },
      {
        id: "2",
        uuid: "99999999-0000-4000-8000-000000000002",
        name: "teambox.dev",
        isDefault: false,
      },
    ],
    mailboxes: [
      {
        id: "101",
        uuid: "11111111-1111-4111-8111-111111111101",
        localPart: "billing.ops",
        emailAddress: "billing.ops@mailstack.local",
        domainUuid: "99999999-0000-4000-8000-000000000001",
        domainName: "mailstack.local",
        status: "active",
        createdAt: "2026-11-10T08:15:00.000Z",
      },
      {
        id: "102",
        uuid: "11111111-1111-4111-8111-111111111102",
        localPart: "olivia.martin",
        emailAddress: "olivia.martin@mailstack.local",
        domainUuid: "99999999-0000-4000-8000-000000000001",
        domainName: "mailstack.local",
        status: "active",
        createdAt: "2026-11-12T10:30:00.000Z",
      },
      {
        id: "103",
        uuid: "11111111-1111-4111-8111-111111111103",
        localPart: "support.desk",
        emailAddress: "support.desk@teambox.dev",
        domainUuid: "99999999-0000-4000-8000-000000000002",
        domainName: "teambox.dev",
        status: "active",
        createdAt: "2026-11-13T14:20:00.000Z",
      },
      {
        id: "104",
        uuid: "11111111-1111-4111-8111-111111111104",
        localPart: "alerts.archive",
        emailAddress: "alerts.archive@mailstack.local",
        domainUuid: "99999999-0000-4000-8000-000000000001",
        domainName: "mailstack.local",
        status: "disabled",
        createdAt: "2026-11-01T09:00:00.000Z",
      },
    ],
    messages: [
      {
        id: "5001",
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001",
        mailboxUuid: "11111111-1111-4111-8111-111111111101",
        messageIdHeader: "<inv-9021@vendor.example>",
        senderName: "Vendor Billing",
        senderAddress: "billing@vendor.example",
        recipientAddresses: ["billing.ops@mailstack.local"],
        ccAddresses: ["finance@mailstack.local"],
        subject: "Invoice #9021 — November Infrastructure Statement",
        preview:
          "Your November billing summary is ready. Total due: $184.00 on Nov 30.",
        receivedAt: "2026-11-15T12:42:00.000Z",
        parsedAt: "2026-11-15T12:42:02.000Z",
        sizeBytes: 18432,
        isRead: false,
        parseStatus: "ok",
        parseWarning: "",
        textBody:
          "Hello team,\n\nYour November billing summary (Invoice #9021) is attached.\nTotal amount: $184.00\nDue date: 2026-11-30\n\nRegards,\nVendor Billing",
        htmlBody: `<h3 style="margin:0 0 8px 0;font-size:15px;font-weight:600">Invoice #9021</h3><p style="margin:0 0 10px 0;font-size:13px;line-height:1.5">Your November infrastructure statement is ready for review.</p><table style="border-collapse:collapse;width:100%;max-width:420px;font-size:12px"><tr><td style="padding:6px;border-width:1px;border-style:solid;opacity:0.75">Period</td><td style="padding:6px;border-width:1px;border-style:solid">Nov 01 – Nov 30, 2026</td></tr><tr><td style="padding:6px;border-width:1px;border-style:solid;opacity:0.75">Amount</td><td style="padding:6px;border-width:1px;border-style:solid">$184.00</td></tr></table>`,
        attachments: [
          {
            uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001",
            originalFilename: "invoice-9021.txt",
            safeFilename: "invoice-9021.txt",
            declaredMimeType: "text/plain",
            detectedMimeType: "text/plain",
            sizeBytes: 142,
            isInline: false,
            content:
              "Invoice #9021\nPeriod: 2026-11\nAccount: billing.ops@mailstack.local\nTotal: $184.00\n",
          },
        ],
        deleted: false,
      },
      {
        id: "5002",
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa002",
        mailboxUuid: "11111111-1111-4111-8111-111111111101",
        messageIdHeader: "<tls-renew@letsencrypt.org>",
        senderName: "Security Ops",
        senderAddress: "secops@cloudnode.example",
        recipientAddresses: ["billing.ops@mailstack.local"],
        ccAddresses: [],
        subject: "TLS Certificate Renewed for mail.mailstack.local",
        preview:
          "Automated ACME renewal succeeded. Valid through Feb 13, 2027.",
        receivedAt: "2026-11-15T10:15:00.000Z",
        parsedAt: "2026-11-15T10:15:01.000Z",
        sizeBytes: 3420,
        isRead: false,
        parseStatus: "ok",
        parseWarning: "",
        textBody:
          "Automated certificate renewal completed for mail.mailstack.local.\nExpiry: 2027-02-13 UTC\nSerial: 04:9A:2F:18:C2",
        htmlBody: null,
        attachments: [],
        deleted: false,
      },
      {
        id: "5003",
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa003",
        mailboxUuid: "11111111-1111-4111-8111-111111111101",
        messageIdHeader: "<payout-confirm@stripe-demo.example>",
        senderName: "Merchant Payouts",
        senderAddress: "payouts@merchant.example",
        recipientAddresses: ["billing.ops@mailstack.local"],
        ccAddresses: [],
        subject: "Settlement batch #441 deposited",
        preview:
          "Bank transfer for settlement batch #441 has completed without exceptions.",
        receivedAt: "2026-11-14T18:05:00.000Z",
        parsedAt: "2026-11-14T18:05:03.000Z",
        sizeBytes: 6144,
        isRead: true,
        parseStatus: "ok",
        parseWarning: "",
        textBody:
          "Settlement batch #441 has been deposited to your primary operating account.",
        htmlBody: `<p style="margin:0;font-size:13px">Settlement batch <strong>#441</strong> has been settled cleanly.</p>`,
        attachments: [],
        deleted: false,
      },
      {
        id: "5004",
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa004",
        mailboxUuid: "11111111-1111-4111-8111-111111111102",
        messageIdHeader: "<verify-code@portal.example>",
        senderName: "Account Security",
        senderAddress: "security@portal.example",
        recipientAddresses: ["olivia.martin@mailstack.local"],
        ccAddresses: [],
        subject: "One-time verification code: 482910",
        preview:
          "Use verification code 482910 within 10 minutes to finish sign-in.",
        receivedAt: "2026-11-15T11:54:00.000Z",
        parsedAt: "2026-11-15T11:54:01.000Z",
        sizeBytes: 2150,
        isRead: false,
        parseStatus: "ok",
        parseWarning: "",
        textBody: "Your one-time verification code is: 482910\nExpires in 10 minutes.",
        htmlBody: null,
        attachments: [],
        deleted: false,
      },
      {
        id: "5005",
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa005",
        mailboxUuid: "11111111-1111-4111-8111-111111111103",
        messageIdHeader: "<ticket-882@helpdesk.example>",
        senderName: "Customer Care",
        senderAddress: "care@client-org.example",
        recipientAddresses: ["support.desk@teambox.dev"],
        ccAddresses: [],
        subject: "Re: Domain DNS cutover confirmation",
        preview:
          "MX and SPF records have propagated across all authoritative nameservers.",
        receivedAt: "2026-11-15T09:20:00.000Z",
        parsedAt: "2026-11-15T09:20:02.000Z",
        sizeBytes: 9120,
        isRead: true,
        parseStatus: "ok",
        parseWarning: "",
        textBody:
          "Hi Support,\n\nMX and SPF records propagated cleanly across our resolvers.\n\nThanks!",
        htmlBody: `<p style="margin:0 0 8px 0;font-size:13px">Hi Support,</p><p style="margin:0;font-size:13px">MX and SPF records propagated cleanly across our resolvers.</p>`,
        attachments: [
          {
            uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002",
            originalFilename: "dns-check-report.txt",
            safeFilename: "dns-check-report.txt",
            declaredMimeType: "text/plain",
            detectedMimeType: "text/plain",
            sizeBytes: 98,
            isInline: false,
            content: "MX: mail.mailstack.local (10) OK\nSPF: v=spf1 a:mail.mailstack.local -all OK\n",
          },
        ],
        deleted: false,
      },
    ],
    nextMailboxId: 105,
  };
}

function getDemoStore(): DemoStoreState {
  if (!globalForDemo.__readboxDemoUserStore) {
    globalForDemo.__readboxDemoUserStore = createInitialDemoStore();
  }
  return globalForDemo.__readboxDemoUserStore;
}

function computeMailboxStats(store: DemoStoreState, mailboxUuid: string) {
  const active = store.messages.filter(
    (m) => m.mailboxUuid === mailboxUuid && !m.deleted,
  );
  const unread = active.filter((m) => !m.isRead).length;
  const sorted = [...active].sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  );
  return {
    totalMessages: active.length,
    unreadMessages: unread,
    lastReceivedAt: sorted[0]?.receivedAt ?? null,
  };
}

export function getDemoUserOverview(
  isAdministrator: boolean,
): UserWorkspaceOverviewSnapshot {
  const store = getDemoStore();
  const recentMailboxes = [...store.mailboxes]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((mbx) => {
      const stats = computeMailboxStats(store, mbx.uuid);
      return {
        ...mbx,
        totalMessages: String(stats.totalMessages),
        unreadMessages: String(stats.unreadMessages),
        lastReceivedAt: stats.lastReceivedAt,
      };
    });

  const activeMessages = store.messages
    .filter((m) => !m.deleted)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const mailboxByUuid = new Map(store.mailboxes.map((m) => [m.uuid, m]));

  const recentMessages = activeMessages.slice(0, 8).map((msg) => ({
    id: msg.id,
    uuid: msg.uuid,
    mailboxUuid: msg.mailboxUuid,
    mailboxEmail: mailboxByUuid.get(msg.mailboxUuid)?.emailAddress ?? "",
    senderName: msg.senderName,
    senderAddress: msg.senderAddress,
    subject: msg.subject,
    preview: msg.preview,
    receivedAt: msg.receivedAt,
    isRead: msg.isRead,
    hasAttachments: msg.attachments.length > 0,
    sizeBytes: String(msg.sizeBytes),
  }));

  return {
    databaseConfigured: true,
    totalMailboxes: store.mailboxes.length,
    activeMailboxes: store.mailboxes.filter((m) => m.status === "active").length,
    disabledMailboxes: store.mailboxes.filter((m) => m.status !== "active")
      .length,
    totalMessages: activeMessages.length,
    totalUnread: activeMessages.filter((m) => !m.isRead).length,
    lastReceivedAt: activeMessages[0]?.receivedAt ?? null,
    recentMessages,
    recentMailboxes: recentMailboxes.slice(0, 8),
    availableDomains: store.domains,
    capabilities: {
      canDeleteMessages: true,
      canDeleteMailboxes: isAdministrator,
    },
  };
}

export function listDemoUserMailboxes(
  isAdministrator: boolean,
  filters: { query?: string; status?: string; page?: number },
): UserMailboxListResult {
  const store = getDemoStore();
  const q = (filters.query ?? "").trim().toLowerCase();
  const statusFilter: "all" | "active" | "disabled" =
    filters.status === "active" || filters.status === "disabled"
      ? filters.status
      : "all";

  const filtered = store.mailboxes
    .filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (
        q &&
        !m.localPart.toLowerCase().includes(q) &&
        !m.emailAddress.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pageSize = 25;
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, filters.page || 1), totalPages);
  const items = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map((mbx) => {
      const stats = computeMailboxStats(store, mbx.uuid);
      return {
        ...mbx,
        totalMessages: String(stats.totalMessages),
        unreadMessages: String(stats.unreadMessages),
        lastReceivedAt: stats.lastReceivedAt,
      };
    });

  return {
    databaseConfigured: true,
    items,
    totalCount,
    page,
    pageSize,
    totalPages,
    query: filters.query?.trim() ?? "",
    statusFilter,
    availableDomains: store.domains,
    capabilities: {
      canDeleteMessages: true,
      canDeleteMailboxes: isAdministrator,
    },
  };
}

export function listDemoMailboxMessages(
  mailboxUuid: string,
  filters: {
    query?: string;
    read?: string;
    attachments?: string;
    page?: number;
  },
): UserInboxListResult | null {
  const store = getDemoStore();
  const mailbox = store.mailboxes.find((m) => m.uuid === mailboxUuid);
  if (!mailbox) return null;

  const q = (filters.query ?? "").trim().toLowerCase();
  const readFilter =
    filters.read === "unread" || filters.read === "read" ? filters.read : "all";
  const attachmentFilter =
    filters.attachments === "yes" || filters.attachments === "no"
      ? filters.attachments
      : "all";

  const allActive = store.messages
    .filter((m) => m.mailboxUuid === mailbox.uuid && !m.deleted)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const filtered = allActive.filter((m) => {
    if (readFilter === "unread" && m.isRead) return false;
    if (readFilter === "read" && !m.isRead) return false;
    if (attachmentFilter === "yes" && m.attachments.length === 0) return false;
    if (attachmentFilter === "no" && m.attachments.length > 0) return false;
    if (q) {
      const haystack = `${m.senderName} ${m.senderAddress} ${m.subject} ${m.preview}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const pageSize = 30;
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, filters.page || 1), totalPages);
  const stats = computeMailboxStats(store, mailbox.uuid);

  return {
    mailbox: {
      id: mailbox.id,
      uuid: mailbox.uuid,
      localPart: mailbox.localPart,
      emailAddress: mailbox.emailAddress,
      domainName: mailbox.domainName,
      status: mailbox.status,
      totalMessages: stats.totalMessages,
      unreadMessages: stats.unreadMessages,
      lastReceivedAt: stats.lastReceivedAt,
    },
    items: filtered.slice((page - 1) * pageSize, page * pageSize).map((m) => ({
      id: m.id,
      uuid: m.uuid,
      senderName: m.senderName,
      senderAddress: m.senderAddress,
      subject: m.subject,
      preview: m.preview,
      receivedAt: m.receivedAt,
      sizeBytes: m.sizeBytes,
      isRead: m.isRead,
      hasAttachments: m.attachments.length > 0,
      parseStatus: m.parseStatus,
    })),
    totalCount,
    page,
    pageSize,
    totalPages,
    query: filters.query?.trim() ?? "",
    readFilter,
    attachmentFilter,
    liveUnfilteredFirstPage:
      !q && readFilter === "all" && attachmentFilter === "all" && page === 1,
    canDeleteMailbox: true,
  };
}

export function getDemoMessageDetail(
  mailboxUuid: string,
  messageUuid: string,
): UserMessageDetail | null {
  const store = getDemoStore();
  const mailbox = store.mailboxes.find((m) => m.uuid === mailboxUuid);
  if (!mailbox) return null;
  const msg = store.messages.find(
    (m) => m.mailboxUuid === mailbox.uuid && m.uuid === messageUuid && !m.deleted,
  );
  if (!msg) return null;

  msg.isRead = true;
  const stats = computeMailboxStats(store, mailbox.uuid);

  return {
    id: msg.id,
    uuid: msg.uuid,
    mailbox: {
      id: mailbox.id,
      uuid: mailbox.uuid,
      localPart: mailbox.localPart,
      emailAddress: mailbox.emailAddress,
      domainName: mailbox.domainName,
      status: mailbox.status,
      totalMessages: stats.totalMessages,
      unreadMessages: stats.unreadMessages,
      lastReceivedAt: stats.lastReceivedAt,
    },
    messageIdHeader: msg.messageIdHeader,
    senderName: msg.senderName,
    senderAddress: msg.senderAddress,
    recipientAddresses: msg.recipientAddresses,
    ccAddresses: msg.ccAddresses,
    subject: msg.subject,
    receivedAt: msg.receivedAt,
    parsedAt: msg.parsedAt,
    sizeBytes: msg.sizeBytes,
    isRead: msg.isRead,
    hasAttachments: msg.attachments.length > 0,
    parseStatus: msg.parseStatus,
    parseWarning: msg.parseWarning,
    textBody: msg.textBody,
    hasHtmlBody: Boolean(msg.htmlBody),
    attachments: msg.attachments.map((att) => ({
      uuid: att.uuid,
      originalFilename: att.originalFilename,
      safeFilename: att.safeFilename,
      declaredMimeType: att.declaredMimeType,
      detectedMimeType: att.detectedMimeType,
      sizeBytes: att.sizeBytes,
      isInline: att.isInline,
    })),
    canDeleteMessage: true,
  };
}

export function getDemoMessageHtml(
  messageUuid: string,
  options?: SanitizedHtmlRenderOptions,
): string | null {
  const store = getDemoStore();
  const msg = store.messages.find((m) => m.uuid === messageUuid && !m.deleted);
  if (!msg?.htmlBody) return null;
  return buildSanitizedHtmlDocument(msg.htmlBody, options);
}

export function getDemoAttachmentDownload(attachmentUuid: string): {
  safeFilename: string;
  content: string;
} | null {
  const store = getDemoStore();
  for (const msg of store.messages) {
    if (msg.deleted) continue;
    const att = msg.attachments.find((a) => a.uuid === attachmentUuid);
    if (att) {
      return { safeFilename: att.safeFilename, content: att.content };
    }
  }
  return null;
}

export function createDemoMailbox(input: {
  localPart: string;
  domainUuid?: string;
}): MailboxActionResult<{
  uuid: string;
  emailAddress: string;
  localPart: string;
}> {
  const store = getDemoStore();
  const localPart = input.localPart.trim().toLowerCase();
  if (!/^[a-z0-9._+-]{1,64}$/.test(localPart)) {
    return {
      ok: false,
      code: "validation",
      error: "Mailbox local part may only contain lowercase letters, numbers, dots, hyphens, underscores, or plus signs.",
    };
  }

  const domain =
    store.domains.find((d) => d.uuid === input.domainUuid) ??
    store.domains.find((d) => d.isDefault) ??
    store.domains[0];

  if (!domain) {
    return { ok: false, code: "validation", error: "No active domain available." };
  }

  const emailAddress = `${localPart}@${domain.name}`;
  if (store.mailboxes.some((m) => m.emailAddress === emailAddress)) {
    return {
      ok: false,
      code: "conflict",
      error: `Mailbox ${emailAddress} already exists.`,
    };
  }

  const idNum = store.nextMailboxId++;
  const uuid = `11111111-1111-4111-8111-${String(idNum).padStart(12, "0")}`;
  store.mailboxes.unshift({
    id: String(idNum),
    uuid,
    localPart,
    emailAddress,
    domainUuid: domain.uuid,
    domainName: domain.name,
    status: "active",
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true,
    data: { uuid, emailAddress, localPart },
    message: `Created ${emailAddress}`,
  };
}

export function deleteDemoMailbox(
  mailboxUuid: string,
  confirmationEmail: string,
): MailboxActionResult<{ emailAddress: string }> {
  const store = getDemoStore();
  const index = store.mailboxes.findIndex((m) => m.uuid === mailboxUuid);
  if (index === -1) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }
  const target = store.mailboxes[index];
  if (confirmationEmail.trim().toLowerCase() !== target.emailAddress) {
    return {
      ok: false,
      code: "validation",
      error: `Type ${target.emailAddress} exactly to confirm deletion.`,
    };
  }

  store.mailboxes.splice(index, 1);
  store.messages = store.messages.filter((m) => m.mailboxUuid !== mailboxUuid);
  return {
    ok: true,
    data: { emailAddress: target.emailAddress },
    message: `Mailbox ${target.emailAddress} deleted.`,
  };
}

export function bulkDeleteDemoMailboxes(
  mailboxUuids: readonly string[],
  confirmed: boolean,
): MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }> {
  if (!confirmed || mailboxUuids.length === 0) {
    return {
      ok: false,
      code: "validation",
      error: "Select at least one mailbox and confirm deletion.",
    };
  }
  const store = getDemoStore();
  const set = new Set(mailboxUuids);
  const purgedEmails = store.mailboxes
    .filter((m) => set.has(m.uuid))
    .map((m) => m.emailAddress);
  store.mailboxes = store.mailboxes.filter((m) => !set.has(m.uuid));
  store.messages = store.messages.filter((m) => !set.has(m.mailboxUuid));
  return {
    ok: true,
    data: { purgedCount: purgedEmails.length, purgedEmails },
    message: `${purgedEmails.length} mailbox(es) deleted.`,
  };
}

export function markDemoMessageUnread(
  mailboxUuid: string,
  messageUuid: string,
): MessageActionResult<{ uuid: string; isRead: boolean }> {
  const store = getDemoStore();
  const msg = store.messages.find(
    (m) => m.mailboxUuid === mailboxUuid && m.uuid === messageUuid && !m.deleted,
  );
  if (!msg) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }
  msg.isRead = false;
  return {
    ok: true,
    data: { uuid: msg.uuid, isRead: false },
    message: "Message marked as unread.",
  };
}

export function softDeleteDemoMessage(
  mailboxUuid: string,
  messageUuid: string,
): MessageActionResult<{ uuid: string }> {
  const store = getDemoStore();
  const msg = store.messages.find(
    (m) => m.mailboxUuid === mailboxUuid && m.uuid === messageUuid && !m.deleted,
  );
  if (!msg) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }
  msg.deleted = true;
  return {
    ok: true,
    data: { uuid: msg.uuid },
    message: "Message deleted. The source email remains preserved.",
  };
}

export function pollDemoLivePayload(
  mailboxUuids: readonly string[],
): LiveUpdatePayload {
  const store = getDemoStore();
  const overview = getDemoUserOverview(true);
  const requestedSet = new Set(mailboxUuids);
  const visibleMailboxes = (
    requestedSet.size > 0
      ? store.mailboxes.filter((m) => requestedSet.has(m.uuid))
      : store.mailboxes
  ).map((mbx) => {
    const stats = computeMailboxStats(store, mbx.uuid);
    return {
      uuid: mbx.uuid,
      email_address: mbx.emailAddress,
      status: mbx.status,
      total_messages: stats.totalMessages,
      unread_messages: stats.unreadMessages,
      last_received_at: stats.lastReceivedAt,
    };
  });

  return {
    cursor: 100,
    has_more: false,
    summary: {
      total_mailboxes: overview.totalMailboxes,
      active_mailboxes: overview.activeMailboxes,
      disabled_mailboxes: overview.disabledMailboxes,
      total_messages: overview.totalMessages,
      total_unread: overview.totalUnread,
      last_received: overview.lastReceivedAt,
    },
    mailboxes_truncated: false,
    mailboxes: visibleMailboxes,
    messages: [],
  };
}
