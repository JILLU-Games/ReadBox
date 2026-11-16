import { env } from "@/config/env";
import type { UserAccessCapabilities } from "@/core/accounts/policy";
import {
  canUserCreateMoreMailboxes,
  computeMessageRetentionCutoff,
  getDemoUserAccessPolicy,
  getDemoUserControlSettings,
  isDomainAllowedForUser,
  resolveEffectiveUserPolicy,
} from "@/core/accounts/user-control-policy";
import type { MailboxActionResult } from "@/core/mailboxes/service";
import {
  MailValidationError,
  validateLocalPart,
} from "@/core/mailboxes/validators";
import {
  buildSanitizedHtmlDocument,
  type LiveUpdateMessageItem,
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
  userId?: string;
}

function doesDemoMailboxBelongToUser(
  mbx: DemoMailboxRecord,
  userId: string | bigint,
  isAdministrator: boolean,
): boolean {
  if (isAdministrator) return true;
  const uid = String(userId);
  const owner = mbx.userId ?? "2";
  if (owner === uid) return true;
  if (
    (uid === "9002" && owner === "2") ||
    (uid === "2" && owner === "9002")
  ) {
    return true;
  }
  return false;
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
        name: "readbox.local",
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
        emailAddress: "billing.ops@readbox.local",
        domainUuid: "99999999-0000-4000-8000-000000000001",
        domainName: "readbox.local",
        status: "active",
        createdAt: "2026-11-10T08:15:00.000Z",
        userId: "2",
      },
      {
        id: "102",
        uuid: "11111111-1111-4111-8111-111111111102",
        localPart: "olivia.martin",
        emailAddress: "olivia.martin@readbox.local",
        domainUuid: "99999999-0000-4000-8000-000000000001",
        domainName: "readbox.local",
        status: "active",
        createdAt: "2026-11-12T10:30:00.000Z",
        userId: "2",
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
        userId: "2",
      },
      {
        id: "104",
        uuid: "11111111-1111-4111-8111-111111111104",
        localPart: "alerts.archive",
        emailAddress: "alerts.archive@readbox.local",
        domainUuid: "99999999-0000-4000-8000-000000000001",
        domainName: "readbox.local",
        status: "disabled",
        createdAt: "2026-11-01T09:00:00.000Z",
        userId: "2",
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
        recipientAddresses: ["billing.ops@readbox.local"],
        ccAddresses: ["finance@readbox.local"],
        subject: "Invoice #9021 — November Monthly Statement",
        preview:
          "Your November billing summary is ready. Total due: $184.00 on Nov 30.",
        receivedAt: "2026-11-15T12:42:00.000Z",
        parsedAt: "2026-11-15T12:42:02.000Z",
        sizeBytes: 18432,
        isRead: false,
        parseStatus: "ok",
        parseWarning: "",
        textBody:
          "Hello team,\n\nYour November billing summary (Invoice #9021) is attached.\nTotal amount: $184.00\nDue date: 2026-11-30\nView invoice online: https://billing.vendor.example/invoices/INV-9021\nDownload PDF receipt: https://billing.vendor.example/invoices/INV-9021/download\n\nRegards,\nVendor Billing",
        htmlBody: `<div style="max-width:640px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.55">
  <div style="background-color:#1e3a8a;color:#ffffff;padding:18px 20px;margin-bottom:16px">
    <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85">Vendor Cloud Billing</div>
    <h2 style="margin:4px 0 0 0;font-size:18px;font-weight:600;color:#ffffff">Invoice #9021 — Monthly Statement</h2>
  </div>
  <p style="margin:0 0 12px 0;font-size:13px">Hello Billing Operations,</p>
  <p style="margin:0 0 16px 0;font-size:13px">Your November 2026 infrastructure and workspace statement has been generated and is ready for review. Automatic settlement is scheduled for <strong>November 30, 2026</strong>.</p>
  <table style="border-collapse:collapse;width:100%;margin:0 0 16px 0;font-size:13px">
    <thead>
      <tr style="background-color:rgba(37,88,191,0.08)">
        <th align="left" style="padding:8px 10px;border:1px solid #dce3e8;font-weight:600">Description</th>
        <th align="left" style="padding:8px 10px;border:1px solid #dce3e8;font-weight:600">Period</th>
        <th align="right" style="padding:8px 10px;border:1px solid #dce3e8;font-weight:600">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:8px 10px;border:1px solid #dce3e8">Dedicated Mail Relay &amp; Storage Cluster</td>
        <td style="padding:8px 10px;border:1px solid #dce3e8">Nov 01 – Nov 30, 2026</td>
        <td align="right" style="padding:8px 10px;border:1px solid #dce3e8">$149.00</td>
      </tr>
      <tr>
        <td style="padding:8px 10px;border:1px solid #dce3e8">Archived Audit &amp; Compliance Retention</td>
        <td style="padding:8px 10px;border:1px solid #dce3e8">Nov 01 – Nov 30, 2026</td>
        <td align="right" style="padding:8px 10px;border:1px solid #dce3e8">$35.00</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:8px 10px;border:1px solid #dce3e8;font-weight:600">Total Due (USD)</td>
        <td align="right" style="padding:8px 10px;border:1px solid #dce3e8;font-weight:600">$184.00</td>
      </tr>
    </tbody>
  </table>
  <div style="margin:18px 0;display:flex;flex-wrap:wrap;gap:10px">
    <a href="https://billing.vendor.example/invoices/INV-9021" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#2558bf;color:#ffffff;text-decoration:none;padding:8px 16px;font-size:13px;font-weight:500">Pay or View Invoice #9021</a>
    <a href="https://billing.vendor.example/portal/statements" target="_blank" rel="noopener noreferrer" style="display:inline-block;border:1px solid #2558bf;color:#2558bf;text-decoration:none;padding:7px 14px;font-size:13px;font-weight:500">Open Billing Portal</a>
  </div>
  <p style="margin:14px 0 0 0;font-size:12px;opacity:0.8">Questions about this statement? Reply to <a href="mailto:billing@vendor.example" style="color:#2558bf">billing@vendor.example</a> or visit <a href="https://billing.vendor.example/support" target="_blank" rel="noopener noreferrer" style="color:#2558bf">https://billing.vendor.example/support</a>.</p>
</div>`,
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
              "Invoice #9021\nPeriod: 2026-11\nAccount: billing.ops@readbox.local\nTotal: $184.00\n",
          },
        ],
        deleted: false,
      },
      {
        id: "5002",
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa002",
        mailboxUuid: "11111111-1111-4111-8111-111111111101",
        messageIdHeader: "<sub-renewal@workspace.example>",
        senderName: "Account Services",
        senderAddress: "accounts@workspace.example",
        recipientAddresses: ["billing.ops@readbox.local"],
        ccAddresses: [],
        subject: "Annual workspace plan renewal confirmation",
        preview:
          "Your annual workspace subscription has been renewed through Feb 13, 2027.",
        receivedAt: "2026-11-15T10:15:00.000Z",
        parsedAt: "2026-11-15T10:15:01.000Z",
        sizeBytes: 3420,
        isRead: false,
        parseStatus: "ok",
        parseWarning: "",
        textBody:
          "Your annual workspace plan renewal is complete.\nNext renewal date: 2027-02-13\nReference: SUB-2026-049\nManage subscription: https://workspace.example/account/subscriptions/SUB-2026-049",
        htmlBody: `<div style="max-width:640px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.55">
  <div style="border-left:4px solid #1f7a4c;padding:10px 14px;background-color:rgba(31,122,76,0.08);margin-bottom:14px">
    <div style="font-size:13px;font-weight:600">Subscription Renewal Confirmed</div>
    <div style="font-size:12px;opacity:0.85">Reference ID: <code>SUB-2026-049</code> · Active through Feb 13, 2027</div>
  </div>
  <p style="margin:0 0 12px 0;font-size:13px">Your annual enterprise domain &amp; mailbox workspace subscription has been renewed with zero service interruption.</p>
  <ul style="margin:0 0 16px 18px;padding:0;font-size:13px">
    <li style="margin-bottom:4px">Plan Tier: <strong>Enterprise Multi-Domain Workspace</strong></li>
    <li style="margin-bottom:4px">Next Renewal Date: <strong>February 13, 2027</strong></li>
    <li style="margin-bottom:4px">Assigned Mailbox: <code>billing.ops@readbox.local</code></li>
  </ul>
  <p style="margin:0 0 14px 0">
    <a href="https://workspace.example/account/subscriptions/SUB-2026-049" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#2558bf;color:#ffffff;text-decoration:none;padding:8px 16px;font-size:13px;font-weight:500">Manage Subscription Settings</a>
  </p>
</div>`,
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
        recipientAddresses: ["billing.ops@readbox.local"],
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
          "Settlement batch #441 has been deposited to your primary operating account.\nTransfer trace: ACH-2026-884120\nDetails: https://merchant.example/payouts/batch-441",
        htmlBody: `<div style="max-width:640px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.55">
  <p style="margin:0 0 10px 0;font-size:13px">Settlement batch <strong>#441</strong> has been settled cleanly to your primary operating account.</p>
  <table style="border-collapse:collapse;width:100%;max-width:460px;margin:0 0 14px 0;font-size:12px">
    <tr><td style="padding:6px 10px;border:1px solid #dce3e8;opacity:0.8">Batch Reference</td><td style="padding:6px 10px;border:1px solid #dce3e8;font-weight:600">BATCH-441</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #dce3e8;opacity:0.8">ACH Trace Number</td><td style="padding:6px 10px;border:1px solid #dce3e8"><code>ACH-2026-884120</code></td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #dce3e8;opacity:0.8">Status</td><td style="padding:6px 10px;border:1px solid #dce3e8;color:#1f7a4c;font-weight:600">Deposited</td></tr>
  </table>
  <p style="margin:0;font-size:12px">View full reconciliation ledger: <a href="https://merchant.example/payouts/batch-441" target="_blank" rel="noopener noreferrer" style="color:#2558bf">https://merchant.example/payouts/batch-441</a></p>
</div>`,
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
        recipientAddresses: ["olivia.martin@readbox.local"],
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
        textBody:
          "Your one-time verification code is: 482910\nExpires in 10 minutes.\nSecurity portal: https://portal.example/security/activity",
        htmlBody: `<div style="max-width:560px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.55">
  <p style="margin:0 0 10px 0;font-size:13px">Use the following one-time verification code to complete your sign-in request:</p>
  <div style="display:inline-block;padding:10px 18px;border:1px solid #2558bf;background-color:rgba(37,88,191,0.08);font-size:20px;font-weight:600;letter-spacing:0.18em;margin:4px 0 12px 0">482910</div>
  <p style="margin:0 0 10px 0;font-size:12px;opacity:0.85">This code expires in 10 minutes. If you did not request this code, review your account activity at <a href="https://portal.example/security/activity" target="_blank" rel="noopener noreferrer" style="color:#2558bf">https://portal.example/security/activity</a>.</p>
</div>`,
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
        subject: "Re: Team onboarding schedule confirmation",
        preview:
          "All team members have been added to the shared support workspace.",
        receivedAt: "2026-11-15T09:20:00.000Z",
        parsedAt: "2026-11-15T09:20:02.000Z",
        sizeBytes: 9120,
        isRead: true,
        parseStatus: "ok",
        parseWarning: "",
        textBody:
          "Hi Support,\n\nAll team members have completed onboarding and can now access the shared inbox.\nTicket URL: https://helpdesk.example/tickets/882\n\nThanks!",
        htmlBody: `<div style="max-width:640px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.55">
  <p style="margin:0 0 10px 0;font-size:13px">Hi Support,</p>
  <p style="margin:0 0 12px 0;font-size:13px">All team members have completed onboarding and can now access the shared inbox at <strong>support.desk@teambox.dev</strong>.</p>
  <p style="margin:0 0 12px 0">
    <a href="https://helpdesk.example/tickets/882" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#2558bf;color:#ffffff;text-decoration:none;padding:7px 14px;font-size:12px;font-weight:500">View Ticket #882</a>
  </p>
  <p style="margin:0;font-size:13px">Thanks,<br />Customer Care Team</p>
</div>`,
        attachments: [
          {
            uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002",
            originalFilename: "onboarding-summary.txt",
            safeFilename: "onboarding-summary.txt",
            declaredMimeType: "text/plain",
            detectedMimeType: "text/plain",
            sizeBytes: 98,
            isInline: false,
            content: "Workspace: support.desk@teambox.dev\nStatus: Active\n",
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

function resolveDemoCapabilities(
  isAdministrator: boolean,
  userId: string | bigint = "2",
): UserAccessCapabilities {
  if (isAdministrator) {
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
  const globalSettings = getDemoUserControlSettings();
  const userPolicy = getDemoUserAccessPolicy(String(userId));
  const effective = resolveEffectiveUserPolicy(globalSettings, userPolicy);
  return {
    canDeleteMessages: effective.canDeleteMessages,
    canDeleteMailboxes: effective.canDeleteMailboxes,
    canCreateMailboxes: effective.canCreateMailboxes,
    maxMailboxes: effective.maxMailboxes,
    allowedDomainUuids: effective.allowedDomainUuids,
    autoDeleteEnabled: effective.autoDeleteEnabled,
    autoDeleteDays: effective.autoDeleteDays,
  };
}

function isDemoMessageRetained(
  receivedAtIso: string,
  capabilities: UserAccessCapabilities,
  isAdministrator: boolean,
): boolean {
  if (isAdministrator) return true;
  const cutoff = computeMessageRetentionCutoff({
    autoDeleteEnabled: Boolean(capabilities.autoDeleteEnabled),
    autoDeleteDays: capabilities.autoDeleteDays ?? 0,
  });
  if (!cutoff) return true;
  const receivedTime = Date.parse(receivedAtIso);
  if (!Number.isFinite(receivedTime)) return true;
  return receivedTime >= cutoff.getTime();
}

function filterDemoDomains(
  domains: DemoStoreState["domains"],
  capabilities: UserAccessCapabilities,
  isAdministrator: boolean,
) {
  if (isAdministrator) return domains;
  const allowedDomainUuids = capabilities.allowedDomainUuids ?? [];
  if (allowedDomainUuids.length === 0) return domains;
  return domains.filter((d) =>
    isDomainAllowedForUser(d.uuid, { allowedDomainUuids }),
  );
}

function computeMailboxStats(
  store: DemoStoreState,
  mailboxUuid: string,
  capabilities?: UserAccessCapabilities,
  isAdministrator = true,
) {
  const active = store.messages.filter(
    (m) =>
      m.mailboxUuid === mailboxUuid &&
      !m.deleted &&
      (!capabilities ||
        isDemoMessageRetained(m.receivedAt, capabilities, isAdministrator)),
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
  userId: string | bigint = "2",
): UserWorkspaceOverviewSnapshot {
  const store = getDemoStore();
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  const visibleMailboxes = store.mailboxes.filter((m) =>
    doesDemoMailboxBelongToUser(m, userId, isAdministrator),
  );
  const visibleMailboxUuids = new Set(visibleMailboxes.map((m) => m.uuid));

  const recentMailboxes = [...visibleMailboxes]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((mbx) => {
      const stats = computeMailboxStats(
        store,
        mbx.uuid,
        capabilities,
        isAdministrator,
      );
      return {
        ...mbx,
        totalMessages: String(stats.totalMessages),
        unreadMessages: String(stats.unreadMessages),
        lastReceivedAt: stats.lastReceivedAt,
      };
    });

  const activeMessages = store.messages
    .filter(
      (m) =>
        visibleMailboxUuids.has(m.mailboxUuid) &&
        !m.deleted &&
        isDemoMessageRetained(m.receivedAt, capabilities, isAdministrator),
    )
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
    totalMailboxes: visibleMailboxes.length,
    activeMailboxes: visibleMailboxes.filter((m) => m.status === "active").length,
    disabledMailboxes: visibleMailboxes.filter((m) => m.status !== "active")
      .length,
    totalMessages: activeMessages.length,
    totalUnread: activeMessages.filter((m) => !m.isRead).length,
    lastReceivedAt: activeMessages[0]?.receivedAt ?? null,
    recentMessages,
    recentMailboxes: recentMailboxes.slice(0, 8),
    availableDomains: filterDemoDomains(
      store.domains,
      capabilities,
      isAdministrator,
    ),
    capabilities,
  };
}

export function listDemoUserMailboxes(
  isAdministrator: boolean,
  filters: { query?: string; status?: string; page?: number },
  userId: string | bigint = "2",
): UserMailboxListResult {
  const store = getDemoStore();
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);
  const q = (filters.query ?? "").trim().toLowerCase();
  const statusFilter: "all" | "active" | "disabled" =
    filters.status === "active" || filters.status === "disabled"
      ? filters.status
      : "all";

  const filtered = store.mailboxes
    .filter((m) => {
      if (!doesDemoMailboxBelongToUser(m, userId, isAdministrator)) return false;
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
      const stats = computeMailboxStats(
        store,
        mbx.uuid,
        capabilities,
        isAdministrator,
      );
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
    availableDomains: filterDemoDomains(
      store.domains,
      capabilities,
      isAdministrator,
    ),
    capabilities,
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
  isAdministrator = false,
  userId: string | bigint = "2",
): UserInboxListResult | null {
  const store = getDemoStore();
  const mailbox = store.mailboxes.find((m) => m.uuid === mailboxUuid);
  if (!mailbox || !doesDemoMailboxBelongToUser(mailbox, userId, isAdministrator)) {
    return null;
  }

  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  const q = (filters.query ?? "").trim().toLowerCase();
  const readFilter =
    filters.read === "unread" || filters.read === "read" ? filters.read : "all";
  const attachmentFilter =
    filters.attachments === "yes" || filters.attachments === "no"
      ? filters.attachments
      : "all";

  const allActive = store.messages
    .filter(
      (m) =>
        m.mailboxUuid === mailbox.uuid &&
        !m.deleted &&
        isDemoMessageRetained(m.receivedAt, capabilities, isAdministrator),
    )
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
  const stats = computeMailboxStats(
    store,
    mailbox.uuid,
    capabilities,
    isAdministrator,
  );

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
    canDeleteMailbox: isAdministrator ? true : capabilities.canDeleteMailboxes,
  };
}

export function getDemoMessageDetail(
  mailboxUuid: string,
  messageUuid: string,
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): UserMessageDetail | null {
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  const mailbox = store.mailboxes.find((m) => m.uuid === mailboxUuid);
  if (!mailbox || !doesDemoMailboxBelongToUser(mailbox, userId, isAdministrator)) {
    return null;
  }
  const msg = store.messages.find(
    (m) => m.mailboxUuid === mailbox.uuid && m.uuid === messageUuid && !m.deleted,
  );
  if (!msg) return null;

  if (!isDemoMessageRetained(msg.receivedAt, capabilities, isAdministrator)) {
    return null;
  }

  msg.isRead = true;
  const stats = computeMailboxStats(
    store,
    mailbox.uuid,
    capabilities,
    isAdministrator,
  );

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
    htmlBody: msg.htmlBody ?? "",
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
    canDeleteMessage: isAdministrator ? true : capabilities.canDeleteMessages,
  };
}

export function getDemoMessageHtml(
  messageUuid: string,
  options?: SanitizedHtmlRenderOptions,
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): string | null {
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  const msg = store.messages.find((m) => m.uuid === messageUuid && !m.deleted);
  if (!msg?.htmlBody) return null;

  const mailbox = store.mailboxes.find((m) => m.uuid === msg.mailboxUuid);
  if (!mailbox || !doesDemoMailboxBelongToUser(mailbox, userId, isAdministrator)) {
    return null;
  }

  if (!isDemoMessageRetained(msg.receivedAt, capabilities, isAdministrator)) {
    return null;
  }

  return buildSanitizedHtmlDocument(msg.htmlBody, options);
}

export function getDemoAttachmentDownload(
  attachmentUuid: string,
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): {
  safeFilename: string;
  content: string;
} | null {
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  for (const msg of store.messages) {
    if (msg.deleted) continue;
    const att = msg.attachments.find((a) => a.uuid === attachmentUuid);
    if (att) {
      const mailbox = store.mailboxes.find((m) => m.uuid === msg.mailboxUuid);
      if (!mailbox || !doesDemoMailboxBelongToUser(mailbox, userId, isAdministrator)) {
        return null;
      }
      if (!isDemoMessageRetained(msg.receivedAt, capabilities, isAdministrator)) {
        return null;
      }
      return { safeFilename: att.safeFilename, content: att.content };
    }
  }
  return null;
}

export function createDemoMailbox(
  input: {
    localPart: string;
    domainUuid?: string;
  },
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): MailboxActionResult<{
  uuid: string;
  emailAddress: string;
  localPart: string;
}> {
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  const userMailboxes = store.mailboxes.filter((m) =>
    doesDemoMailboxBelongToUser(m, userId, false),
  );

  if (actorOptions && !isAdministrator) {
    const quotaCheck = canUserCreateMoreMailboxes(userMailboxes.length, {
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
            : `Mailbox limit reached (${userMailboxes.length}/${capabilities.maxMailboxes}). Contact an administrator to increase your quota.`,
      };
    }
  }

  let localPart: string;
  try {
    localPart = validateLocalPart(input.localPart);
  } catch (error) {
    const message =
      error instanceof MailValidationError
        ? error.message
        : "Invalid mailbox local part.";
    return {
      ok: false,
      code: "validation",
      error: message,
      fieldErrors: { localPart: message },
    };
  }

  const allowedDomainUuids = capabilities.allowedDomainUuids ?? [];
  if (
    !isAdministrator &&
    allowedDomainUuids.length > 0 &&
    input.domainUuid &&
    !isDomainAllowedForUser(input.domainUuid, { allowedDomainUuids })
  ) {
    return {
      ok: false,
      code: "validation",
      error: "Selected domain is not permitted for your account.",
    };
  }

  const availableDomains = filterDemoDomains(
    store.domains,
    capabilities,
    isAdministrator,
  );

  const domain =
    availableDomains.find((d) => d.uuid === input.domainUuid) ??
    availableDomains.find((d) => d.isDefault) ??
    availableDomains[0];

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
    userId: String(userId),
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
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): MailboxActionResult<{ emailAddress: string }> {
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  if (!isAdministrator && !capabilities.canDeleteMailboxes) {
    return {
      ok: false,
      code: "blocked",
      error: "Mailbox deletion is disabled for your account.",
    };
  }

  const index = store.mailboxes.findIndex((m) => m.uuid === mailboxUuid);
  if (index === -1) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }
  const target = store.mailboxes[index];
  if (!doesDemoMailboxBelongToUser(target, userId, isAdministrator)) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

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
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }> {
  if (!confirmed || mailboxUuids.length === 0) {
    return {
      ok: false,
      code: "validation",
      error: "Select at least one mailbox and confirm deletion.",
    };
  }
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  if (!isAdministrator && !capabilities.canDeleteMailboxes) {
    return {
      ok: false,
      code: "blocked",
      error: "Mailbox deletion is disabled for your account.",
    };
  }

  const set = new Set(mailboxUuids);
  const targetMailboxes = store.mailboxes.filter(
    (m) =>
      set.has(m.uuid) && doesDemoMailboxBelongToUser(m, userId, isAdministrator),
  );
  if (targetMailboxes.length === 0) {
    return {
      ok: false,
      code: "not_found",
      error: "No matching mailboxes found to delete.",
    };
  }

  const purgedEmails = targetMailboxes.map((m) => m.emailAddress);
  const targetUuids = new Set(targetMailboxes.map((m) => m.uuid));

  store.mailboxes = store.mailboxes.filter((m) => !targetUuids.has(m.uuid));
  store.messages = store.messages.filter((m) => !targetUuids.has(m.mailboxUuid));
  return {
    ok: true,
    data: { purgedCount: purgedEmails.length, purgedEmails },
    message: `${purgedEmails.length} mailbox(es) deleted.`,
  };
}

export function markDemoMessageUnread(
  mailboxUuid: string,
  messageUuid: string,
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): MessageActionResult<{ uuid: string; isRead: boolean }> {
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  const mailbox = store.mailboxes.find((m) => m.uuid === mailboxUuid);
  if (!mailbox || !doesDemoMailboxBelongToUser(mailbox, userId, isAdministrator)) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

  const msg = store.messages.find(
    (m) => m.mailboxUuid === mailboxUuid && m.uuid === messageUuid && !m.deleted,
  );
  if (!msg) {
    return { ok: false, code: "not_found", error: "Message not found." };
  }

  if (!isDemoMessageRetained(msg.receivedAt, capabilities, isAdministrator)) {
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
  actorOptions?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
  },
): MessageActionResult<{ uuid: string }> {
  const store = getDemoStore();
  const isAdministrator = actorOptions?.isAdministrator === true;
  const userId = actorOptions?.userId ?? "2";
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);

  if (!isAdministrator && !capabilities.canDeleteMessages) {
    return {
      ok: false,
      code: "forbidden",
      error: "Message deletion is disabled for your account.",
    };
  }

  const mailbox = store.mailboxes.find((m) => m.uuid === mailboxUuid);
  if (!mailbox || !doesDemoMailboxBelongToUser(mailbox, userId, isAdministrator)) {
    return { ok: false, code: "not_found", error: "Mailbox not found." };
  }

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
    message: "Message deleted.",
  };
}

export function pollDemoLivePayload(
  mailboxUuids: readonly string[],
  options?: {
    readonly isAdministrator?: boolean;
    readonly userId?: string | bigint;
    readonly cursor?: number;
    readonly bootstrap?: boolean;
  },
): LiveUpdatePayload {
  const store = getDemoStore();
  const isAdministrator = options?.isAdministrator ?? true;
  const userId = options?.userId ?? "2";
  const cursor = options?.cursor ?? 0;
  const bootstrap = options?.bootstrap === true;
  const capabilities = resolveDemoCapabilities(isAdministrator, userId);
  const overview = getDemoUserOverview(isAdministrator, userId);

  const userMailboxes = store.mailboxes.filter((m) =>
    doesDemoMailboxBelongToUser(m, userId, isAdministrator),
  );
  const requestedSet = new Set(mailboxUuids);
  const targetMailboxes =
    requestedSet.size > 0
      ? userMailboxes.filter((m) => requestedSet.has(m.uuid))
      : userMailboxes;

  const targetMailboxUuids = new Set(targetMailboxes.map((m) => m.uuid));

  const visibleMailboxes = targetMailboxes.map((mbx) => {
    const stats = computeMailboxStats(
      store,
      mbx.uuid,
      capabilities,
      isAdministrator,
    );
    return {
      uuid: mbx.uuid,
      email_address: mbx.emailAddress,
      status: mbx.status,
      total_messages: stats.totalMessages,
      unread_messages: stats.unreadMessages,
      last_received_at: stats.lastReceivedAt,
    };
  });

  const activeMessages = store.messages.filter(
    (m) =>
      targetMailboxUuids.has(m.mailboxUuid) &&
      !m.deleted &&
      isDemoMessageRetained(m.receivedAt, capabilities, isAdministrator),
  );

  let maxId = cursor;
  for (const m of activeMessages) {
    const numericId = Number(m.id) || 0;
    if (numericId > maxId) {
      maxId = numericId;
    }
  }

  const mailboxByUuid = new Map(store.mailboxes.map((m) => [m.uuid, m]));

  const newMessages: LiveUpdateMessageItem[] =
    bootstrap || cursor === 0
      ? []
      : activeMessages
          .filter((m) => (Number(m.id) || 0) > cursor)
          .slice(0, 50)
          .map((msg) => {
            const mbx = mailboxByUuid.get(msg.mailboxUuid);
            return {
              id: Number(msg.id) || 0,
              uuid: msg.uuid,
              mailbox_uuid: msg.mailboxUuid,
              mailbox: mbx?.emailAddress ?? "",
              sender_name: msg.senderName,
              sender_address: msg.senderAddress,
              subject: msg.subject,
              preview: msg.preview,
              received_at: msg.receivedAt,
              size_bytes: msg.sizeBytes,
              has_attachments: msg.attachments.length > 0,
              is_read: msg.isRead,
              detail_url: `/users/inbox/${msg.mailboxUuid}/${msg.uuid}`,
            };
          });

  return {
    cursor: maxId,
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
    messages: newMessages,
  };
}
