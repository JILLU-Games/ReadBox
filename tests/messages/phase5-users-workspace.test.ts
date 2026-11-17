import {
  DEFAULT_USER_CONTROL_SETTINGS,
  resetDemoUserControlSettings,
  setDemoUserAccessPolicy,
  setDemoUserControlSettings,
} from "@/core/accounts/user-control-policy";
import {
  createDemoMailbox,
  deleteDemoMailbox,
  getDemoMessageDetail,
  getDemoUserOverview,
  listDemoMailboxMessages,
  listDemoUserMailboxes,
  pollDemoLivePayload,
  softDeleteDemoMessage,
} from "@/core/messages/demo-workspace";
import {
  buildAttachmentContentDisposition,
  buildMessagePreview,
  buildSanitizedHtmlDocument,
  bulkDeleteUserMailboxes,
  createUserSelfMailbox,
  deleteUserMailbox,
  getAttachmentForUserDownload,
  getMessageDetailForUser,
  getSanitizedMessageHtmlForUser,
  getUserWorkspaceOverview,
  isLiveBackgroundRequest,
  listMailboxMessagesForUser,
  listUserMailboxes,
  LIVE_UPDATE_HEADER,
  markMessageUnreadForUser,
  pollLiveMessagesForUser,
  SAFE_HTML_CSP_POLICY,
  softDeleteMessageForUser,
} from "@/core/messages/service";
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const MAILBOX_A_UUID = "11111111-2222-4333-8444-555555555555";
const MAILBOX_B_UUID = "22222222-3333-4444-8555-666666666666";
const MESSAGE_A1_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const MESSAGE_A2_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2";
const MESSAGE_B1_UUID = "bbbbbbbb-cccc-4ddd-8eee-fffffffffff1";
const ATTACHMENT_A1_UUID = "cccccccc-dddd-4eee-8fff-111111111111";

interface FakeMailboxRow {
  id: bigint;
  uuid: string;
  localPart: string;
  emailAddress: string;
  status: string;
  totalMessages: bigint;
  unreadMessages: bigint;
  lastReceivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  domain: { uuid: string; name: string };
  memberUserIds: bigint[];
}

interface FakeMessageRow {
  id: bigint;
  uuid: string;
  mailboxId: bigint;
  messageIdHeader: string;
  senderName: string;
  senderAddress: string;
  recipientAddresses: string[];
  ccAddresses: string[];
  subject: string;
  receivedAt: Date | null;
  parsedAt: Date;
  createdAt: Date;
  textBody: string;
  sanitizedHtmlBody: string;
  sizeBytes: bigint;
  isRead: boolean;
  hasAttachments: boolean;
  parseStatus: string;
  parseWarning: string;
  deletedAt: Date | null;
  deletedById: bigint | null;
}

interface FakeAttachmentRow {
  id: bigint;
  uuid: string;
  messageId: bigint;
  originalFilename: string;
  safeFilename: string;
  declaredMimeType: string;
  detectedMimeType: string;
  sizeBytes: bigint;
  storageRelativePath: string;
  isInline: boolean;
}

function createFakeWorkspacePrisma(options?: {
  canDeleteMessages?: boolean;
  canDeleteMailboxes?: boolean;
  storageRelativePath?: string;
}) {
  const mailboxes: FakeMailboxRow[] = [
    {
      id: BigInt(10),
      uuid: MAILBOX_A_UUID,
      localPart: "alice",
      emailAddress: "alice@mailstack.local",
      status: "active",
      totalMessages: BigInt(2),
      unreadMessages: BigInt(1),
      lastReceivedAt: new Date("2026-11-15T10:00:00.000Z"),
      deletedAt: null,
      createdAt: new Date("2026-11-10T00:00:00.000Z"),
      domain: {
        uuid: "99999999-0000-4000-8000-000000000001",
        name: "mailstack.local",
      },
      memberUserIds: [BigInt(101)],
    },
    {
      id: BigInt(20),
      uuid: MAILBOX_B_UUID,
      localPart: "bob",
      emailAddress: "bob@mailstack.local",
      status: "active",
      totalMessages: BigInt(1),
      unreadMessages: BigInt(1),
      lastReceivedAt: new Date("2026-11-15T11:00:00.000Z"),
      deletedAt: null,
      createdAt: new Date("2026-11-11T00:00:00.000Z"),
      domain: {
        uuid: "99999999-0000-4000-8000-000000000001",
        name: "mailstack.local",
      },
      memberUserIds: [BigInt(202)],
    },
  ];

  const messages: FakeMessageRow[] = [
    {
      id: BigInt(1),
      uuid: MESSAGE_A1_UUID,
      mailboxId: BigInt(10),
      messageIdHeader: "<m1@mailstack.local>",
      senderName: "Billing Team",
      senderAddress: "billing@vendor.example",
      recipientAddresses: ["alice@mailstack.local"],
      ccAddresses: [],
      subject: "November Invoice Ready",
      receivedAt: new Date("2026-11-15T09:00:00.000Z"),
      parsedAt: new Date("2026-11-15T09:01:00.000Z"),
      createdAt: new Date("2026-11-15T09:01:00.000Z"),
      textBody: "Your November invoice is attached for review.",
      sanitizedHtmlBody:
        "<p>Your <strong>November invoice</strong> is attached for review.</p>",
      sizeBytes: BigInt(2048),
      isRead: false,
      hasAttachments: true,
      parseStatus: "ok",
      parseWarning: "",
      deletedAt: null,
      deletedById: null,
    },
    {
      id: BigInt(2),
      uuid: MESSAGE_A2_UUID,
      mailboxId: BigInt(10),
      messageIdHeader: "<m2@mailstack.local>",
      senderName: "Security Alerts",
      senderAddress: "alerts@vendor.example",
      recipientAddresses: ["alice@mailstack.local"],
      ccAddresses: ["ops@mailstack.local"],
      subject: "SSH Key Rotated",
      receivedAt: new Date("2026-11-15T10:00:00.000Z"),
      parsedAt: new Date("2026-11-15T10:01:00.000Z"),
      createdAt: new Date("2026-11-15T10:01:00.000Z"),
      textBody: "Your SSH key rotation completed.",
      sanitizedHtmlBody: "",
      sizeBytes: BigInt(1024),
      isRead: true,
      hasAttachments: false,
      parseStatus: "ok",
      parseWarning: "",
      deletedAt: null,
      deletedById: null,
    },
    {
      id: BigInt(3),
      uuid: MESSAGE_B1_UUID,
      mailboxId: BigInt(20),
      messageIdHeader: "<m3@mailstack.local>",
      senderName: "Private Sender",
      senderAddress: "secret@private.example",
      recipientAddresses: ["bob@mailstack.local"],
      ccAddresses: [],
      subject: "Bob Confidential Payroll",
      receivedAt: new Date("2026-11-15T11:00:00.000Z"),
      parsedAt: new Date("2026-11-15T11:01:00.000Z"),
      createdAt: new Date("2026-11-15T11:01:00.000Z"),
      textBody: "Confidential body for Bob only.",
      sanitizedHtmlBody: "<p>Confidential body for Bob only.</p>",
      sizeBytes: BigInt(4096),
      isRead: false,
      hasAttachments: false,
      parseStatus: "ok",
      parseWarning: "",
      deletedAt: null,
      deletedById: null,
    },
  ];

  const attachments: FakeAttachmentRow[] = [
    {
      id: BigInt(50),
      uuid: ATTACHMENT_A1_UUID,
      messageId: BigInt(1),
      originalFilename: "invoice.pdf",
      safeFilename: "invoice.pdf",
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      sizeBytes: BigInt(512),
      storageRelativePath: options?.storageRelativePath ?? "10/1/invoice.pdf",
      isInline: false,
    },
  ];

  const auditLogs: Array<{
    actorId: bigint | null;
    action: string;
    targetType: string;
    targetIdentifier: string;
    details: unknown;
  }> = [];

  function matchesMailboxWhere(
    row: FakeMailboxRow,
    where: Record<string, unknown> = {},
  ): boolean {
    if (where.deletedAt === null && row.deletedAt !== null) return false;
    if (typeof where.id === "bigint" && row.id !== where.id) return false;
    if (typeof where.uuid === "string" && row.uuid !== where.uuid) return false;
    if (
      where.uuid &&
      typeof where.uuid === "object" &&
      Array.isArray((where.uuid as { in?: string[] }).in)
    ) {
      if (!(where.uuid as { in: string[] }).in.includes(row.uuid)) return false;
    }
    if (typeof where.status === "string" && row.status !== where.status)
      return false;

    const memberships = where.memberships as
      | { some?: { userId?: bigint } }
      | undefined;
    if (memberships?.some?.userId !== undefined) {
      if (!row.memberUserIds.includes(memberships.some.userId)) return false;
    }

    if (Array.isArray(where.OR)) {
      const orMatched = where.OR.some((clause: Record<string, unknown>) => {
        const localContains = (
          clause.localPart as { contains?: string } | undefined
        )?.contains;
        const emailContains = (
          clause.emailAddress as { contains?: string } | undefined
        )?.contains;
        if (
          localContains &&
          row.localPart.toLowerCase().includes(localContains.toLowerCase())
        ) {
          return true;
        }
        if (
          emailContains &&
          row.emailAddress.toLowerCase().includes(emailContains.toLowerCase())
        ) {
          return true;
        }
        return false;
      });
      if (!orMatched) return false;
    }

    return true;
  }

  function matchesMessageWhere(
    row: FakeMessageRow,
    where: Record<string, unknown> = {},
  ): boolean {
    if (where.deletedAt === null && row.deletedAt !== null) return false;
    if (typeof where.id === "bigint" && row.id !== where.id) return false;
    if (
      where.id &&
      typeof where.id === "object" &&
      typeof (where.id as { gt?: bigint }).gt === "bigint"
    ) {
      if (!(row.id > (where.id as { gt: bigint }).gt)) return false;
    }
    if (
      where.id &&
      typeof where.id === "object" &&
      Array.isArray((where.id as { in?: bigint[] }).in)
    ) {
      if (!(where.id as { in: bigint[] }).in.includes(row.id)) return false;
    }
    if (typeof where.uuid === "string" && row.uuid !== where.uuid) return false;
    if (typeof where.mailboxId === "bigint" && row.mailboxId !== where.mailboxId)
      return false;
    if (typeof where.isRead === "boolean" && row.isRead !== where.isRead)
      return false;
    if (
      typeof where.hasAttachments === "boolean" &&
      row.hasAttachments !== where.hasAttachments
    )
      return false;

    const mailboxWhere = where.mailbox as Record<string, unknown> | undefined;
    if (mailboxWhere) {
      const mbx = mailboxes.find((m) => m.id === row.mailboxId);
      if (!mbx || !matchesMailboxWhere(mbx, mailboxWhere)) return false;
    }

    if (where.receivedAt === null && row.receivedAt !== null) return false;
    if (
      where.receivedAt &&
      typeof where.receivedAt === "object" &&
      (where.receivedAt as { gte?: Date }).gte instanceof Date
    ) {
      if (
        !row.receivedAt ||
        row.receivedAt < (where.receivedAt as { gte: Date }).gte
      ) {
        return false;
      }
    }
    if (
      where.receivedAt &&
      typeof where.receivedAt === "object" &&
      (where.receivedAt as { lt?: Date }).lt instanceof Date
    ) {
      if (
        !row.receivedAt ||
        !(row.receivedAt < (where.receivedAt as { lt: Date }).lt)
      ) {
        return false;
      }
    }
    if (
      where.createdAt &&
      typeof where.createdAt === "object" &&
      (where.createdAt as { gte?: Date }).gte instanceof Date
    ) {
      if (row.createdAt < (where.createdAt as { gte: Date }).gte) {
        return false;
      }
    }
    if (
      where.createdAt &&
      typeof where.createdAt === "object" &&
      (where.createdAt as { lt?: Date }).lt instanceof Date
    ) {
      if (!(row.createdAt < (where.createdAt as { lt: Date }).lt)) {
        return false;
      }
    }

    if (Array.isArray(where.AND)) {
      const andMatched = where.AND.every((clause: Record<string, unknown>) =>
        matchesMessageWhere(row, clause),
      );
      if (!andMatched) return false;
    }

    if (Array.isArray(where.OR)) {
      const orMatched = where.OR.some((clause: Record<string, unknown>) => {
        if ("receivedAt" in clause || "createdAt" in clause || "AND" in clause) {
          return matchesMessageWhere(row, clause);
        }
        const sName = (clause.senderName as { contains?: string } | undefined)
          ?.contains;
        const sAddr = (
          clause.senderAddress as { contains?: string } | undefined
        )?.contains;
        const subj = (clause.subject as { contains?: string } | undefined)
          ?.contains;
        if (
          sName &&
          row.senderName.toLowerCase().includes(sName.toLowerCase())
        ) {
          return true;
        }
        if (
          sAddr &&
          row.senderAddress.toLowerCase().includes(sAddr.toLowerCase())
        ) {
          return true;
        }
        if (subj && row.subject.toLowerCase().includes(subj.toLowerCase())) {
          return true;
        }
        return false;
      });
      if (!orMatched) return false;
    }

    return true;
  }

  const prisma = {
    mailboxes,
    messages,
    attachments,
    auditLogs,
    user: {
      findUnique: async ({ where }: { where: { id: bigint } }) => {
        if (
          where.id === BigInt(101) ||
          where.id === BigInt(202) ||
          where.id === BigInt(1)
        ) {
          return { id: where.id };
        }
        return null;
      },
    },
    userAccessPolicy: {
      findUnique: async () => ({
        canDeleteMessages: options?.canDeleteMessages === true,
        canDeleteMailboxes: options?.canDeleteMailboxes === true,
      }),
    },
    domain: {
      findMany: async () => [
        {
          id: BigInt(1),
          uuid: "99999999-0000-4000-8000-000000000001",
          name: "mailstack.local",
          isDefault: true,
        },
      ],
    },
    mailbox: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        mailboxes.filter((m) => matchesMailboxWhere(m, where)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        mailboxes.find((m) => matchesMailboxWhere(m, where)) ?? null,
      findMany: async ({
        where,
        skip = 0,
        take = 50,
      }: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) =>
        mailboxes
          .filter((m) => matchesMailboxWhere(m, where))
          .slice(skip, skip + take),
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        const matched = mailboxes.filter((m) => matchesMailboxWhere(m, where));
        let totalMessages = BigInt(0);
        let unreadMessages = BigInt(0);
        let lastReceivedAt: Date | null = null;
        for (const m of matched) {
          totalMessages += m.totalMessages;
          unreadMessages += m.unreadMessages;
          if (
            m.lastReceivedAt &&
            (!lastReceivedAt || m.lastReceivedAt > lastReceivedAt)
          ) {
            lastReceivedAt = m.lastReceivedAt;
          }
        }
        return {
          _sum: { totalMessages, unreadMessages },
          _max: { lastReceivedAt },
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: bigint };
        data: {
          totalMessages?: bigint;
          unreadMessages?: bigint;
          lastReceivedAt?: Date | null;
        };
      }) => {
        const found = mailboxes.find((m) => m.id === where.id);
        if (!found) throw new Error("Mailbox not found");
        if (data.totalMessages !== undefined)
          found.totalMessages = data.totalMessages;
        if (data.unreadMessages !== undefined)
          found.unreadMessages = data.unreadMessages;
        if (data.lastReceivedAt !== undefined)
          found.lastReceivedAt = data.lastReceivedAt;
        return found;
      },
      delete: async ({ where }: { where: { id: bigint } }) => {
        const idx = mailboxes.findIndex((m) => m.id === where.id);
        if (idx >= 0) mailboxes.splice(idx, 1);
      },
    },
    message: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        messages.filter((m) => matchesMessageWhere(m, where)).length,
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        const matched = messages.filter((m) => matchesMessageWhere(m, where));
        let maxId: bigint | null = null;
        let maxReceivedAt: Date | null = null;
        for (const m of matched) {
          if (maxId === null || m.id > maxId) maxId = m.id;
          if (
            m.receivedAt &&
            (!maxReceivedAt || m.receivedAt > maxReceivedAt)
          ) {
            maxReceivedAt = m.receivedAt;
          }
        }
        return {
          _max: { id: maxId, receivedAt: maxReceivedAt },
        };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const found = messages.find((m) => matchesMessageWhere(m, where));
        if (!found) return null;
        const mbx = mailboxes.find((m) => m.id === found.mailboxId)!;
        const msgAttachments = attachments.filter(
          (a) => a.messageId === found.id,
        );
        return {
          ...found,
          mailbox: mbx,
          attachments: msgAttachments,
        };
      },
      findMany: async ({
        where,
        skip = 0,
        take = 30,
      }: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) => {
        const filtered = messages.filter((m) => matchesMessageWhere(m, where));
        filtered.sort((a, b) => {
          const aTime = a.receivedAt ? a.receivedAt.getTime() : -1;
          const bTime = b.receivedAt ? b.receivedAt.getTime() : -1;
          if (bTime !== aTime) return bTime - aTime;
          return Number(b.id - a.id);
        });
        return filtered.slice(skip, skip + take).map((m) => ({
          ...m,
          mailbox: mailboxes.find((mbx) => mbx.id === m.mailboxId)!,
        }));
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: bigint };
        data: {
          isRead?: boolean;
          deletedAt?: Date | null;
          deletedById?: bigint | null;
        };
      }) => {
        const found = messages.find((m) => m.id === where.id);
        if (!found) throw new Error("Message not found");
        if (data.isRead !== undefined) found.isRead = data.isRead;
        if (data.deletedAt !== undefined) found.deletedAt = data.deletedAt;
        if (data.deletedById !== undefined)
          found.deletedById = data.deletedById;
        return found;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: {
          deletedAt?: Date | null;
        };
      }) => {
        const matched = messages.filter((m) => matchesMessageWhere(m, where));
        for (const row of matched) {
          if (data.deletedAt !== undefined) row.deletedAt = data.deletedAt;
        }
        return { count: matched.length };
      },
    },
    attachment: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const uuid = where.uuid as string | undefined;
        const messageWhere = where.message as
          | Record<string, unknown>
          | undefined;
        const found = attachments.find((a) => {
          if (uuid && a.uuid !== uuid) return false;
          const msg = messages.find((m) => m.id === a.messageId);
          if (!msg) return false;
          if (messageWhere && !matchesMessageWhere(msg, messageWhere))
            return false;
          return true;
        });
        return found ?? null;
      },
      findMany: async () => [],
    },
    auditLog: {
      create: async ({
        data,
      }: {
        data: {
          actorId: bigint | null;
          action: string;
          targetType: string;
          targetIdentifier: string;
          details: unknown;
        };
      }) => {
        auditLogs.push(data);
        return data;
      },
    },
  };

  return prisma;
}

describe("Phase 5 — User Workspace (/users Inbox, Sandboxed Reader, Attachments, Live Polling)", () => {
  it("1. enforces strict cross-user membership isolation across overview, mailbox list, inbox, reader, HTML iframe, and attachment download", async () => {
    const fake = createFakeWorkspacePrisma();
    const aliceActor = { userId: BigInt(101), isAdministrator: false };

    const overview = await getUserWorkspaceOverview(fake as never, aliceActor);
    assert.equal(overview.totalMailboxes, 1);
    assert.equal(
      overview.recentMailboxes[0]?.emailAddress,
      "alice@mailstack.local",
    );
    assert.equal(overview.totalMessages, 2);
    assert.equal(overview.totalUnread, 1);

    const mbxList = await listUserMailboxes(fake as never, aliceActor);
    assert.equal(mbxList.totalCount, 1);
    assert.equal(mbxList.items[0]?.uuid, MAILBOX_A_UUID);

    // Alice cannot view Bob's inbox, message detail, HTML payload, mark unread, or delete
    const bobInboxForAlice = await listMailboxMessagesForUser(
      fake as never,
      aliceActor,
      MAILBOX_B_UUID,
    );
    assert.equal(bobInboxForAlice, null);

    const bobMessageForAlice = await getMessageDetailForUser(
      fake as never,
      aliceActor,
      MAILBOX_B_UUID,
      MESSAGE_B1_UUID,
    );
    assert.equal(bobMessageForAlice, null);

    const bobHtmlForAlice = await getSanitizedMessageHtmlForUser(
      fake as never,
      aliceActor,
      MESSAGE_B1_UUID,
    );
    assert.equal(bobHtmlForAlice, null);

    const markBobUnread = await markMessageUnreadForUser(
      fake as never,
      aliceActor,
      MAILBOX_B_UUID,
      MESSAGE_B1_UUID,
    );
    assert.equal(markBobUnread.ok, false);
    if (!markBobUnread.ok) {
      assert.equal(markBobUnread.code, "not_found");
    }
  });

  it("2. filters inbox messages by search query, unread state, and attachment state with 30/page pagination", async () => {
    const fake = createFakeWorkspacePrisma();
    const aliceActor = { userId: BigInt(101), isAdministrator: false };

    const fullInbox = await listMailboxMessagesForUser(
      fake as never,
      aliceActor,
      MAILBOX_A_UUID,
    );
    assert.ok(fullInbox);
    assert.equal(fullInbox.pageSize, 30);
    assert.equal(fullInbox.totalCount, 2);
    assert.equal(fullInbox.liveUnfilteredFirstPage, true);
    assert.ok(fake.auditLogs.some((a) => a.action === "inbox_access"));

    // Filter unread only
    const unreadInbox = await listMailboxMessagesForUser(
      fake as never,
      aliceActor,
      MAILBOX_A_UUID,
      { read: "unread" },
    );
    assert.ok(unreadInbox);
    assert.equal(unreadInbox.items.length, 1);
    assert.equal(unreadInbox.items[0]?.uuid, MESSAGE_A1_UUID);
    assert.equal(unreadInbox.liveUnfilteredFirstPage, false);

    // Filter attachments=yes
    const attachmentInbox = await listMailboxMessagesForUser(
      fake as never,
      aliceActor,
      MAILBOX_A_UUID,
      { attachments: "yes" },
    );
    assert.ok(attachmentInbox);
    assert.equal(attachmentInbox.items.length, 1);
    assert.equal(attachmentInbox.items[0]?.uuid, MESSAGE_A1_UUID);

    // Search by subject / senderName
    const searchInbox = await listMailboxMessagesForUser(
      fake as never,
      aliceActor,
      MAILBOX_A_UUID,
      { query: "SSH Key" },
    );
    assert.ok(searchInbox);
    assert.equal(searchInbox.items.length, 1);
    assert.equal(searchInbox.items[0]?.uuid, MESSAGE_A2_UUID);
  });

  it("3. auto-marks unread message as read on getMessageDetailForUser, recalculates mailbox counters, and supports markMessageUnreadForUser", async () => {
    const fake = createFakeWorkspacePrisma();
    const aliceActor = { userId: BigInt(101), isAdministrator: false };

    const detail = await getMessageDetailForUser(
      fake as never,
      aliceActor,
      MAILBOX_A_UUID,
      MESSAGE_A1_UUID,
    );
    assert.ok(detail);
    assert.equal(detail.isRead, true);
    assert.equal(detail.mailbox.unreadMessages, 0);
    assert.ok(fake.auditLogs.some((a) => a.action === "message_auto_read"));
    assert.ok(fake.auditLogs.some((a) => a.action === "message_view"));

    // Mark unread again
    const unreadRes = await markMessageUnreadForUser(
      fake as never,
      aliceActor,
      MAILBOX_A_UUID,
      MESSAGE_A1_UUID,
    );
    assert.equal(unreadRes.ok, true);
    assert.equal(fake.mailboxes[0]?.unreadMessages, BigInt(1));
    assert.ok(fake.auditLogs.some((a) => a.action === "message_mark_unread"));
  });

  it("4. enforces canDeleteMessages on softDeleteMessageForUser and preserves raw Maildir file on disk when allowed", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "phase5-maildir-"));
    try {
      const rawMaildirFile = path.join(tempDir, "1700000000.M1P1.mailstack");
      await writeFile(rawMaildirFile, "Subject: Preserved Raw Email\r\n\r\nBody");

      // Disallowed when canDeleteMessages=false
      const fakeForbidden = createFakeWorkspacePrisma({
        canDeleteMessages: false,
      });
      const denied = await softDeleteMessageForUser(
        fakeForbidden as never,
        { userId: BigInt(101), isAdministrator: false },
        MAILBOX_A_UUID,
        MESSAGE_A1_UUID,
      );
      assert.equal(denied.ok, false);
      if (!denied.ok) {
        assert.equal(denied.code, "not_found");
      }
      assert.equal(fakeForbidden.messages[0]?.deletedAt, null);

      // Allowed when canDeleteMessages=true
      const fakeAllowed = createFakeWorkspacePrisma({
        canDeleteMessages: true,
      });
      const deleted = await softDeleteMessageForUser(
        fakeAllowed as never,
        { userId: BigInt(101), isAdministrator: false },
        MAILBOX_A_UUID,
        MESSAGE_A1_UUID,
      );
      assert.equal(deleted.ok, true);
      assert.notEqual(fakeAllowed.messages[0]?.deletedAt, null);
      assert.equal(fakeAllowed.messages[0]?.deletedById, BigInt(101));
      assert.equal(fakeAllowed.mailboxes[0]?.totalMessages, BigInt(1));
      assert.equal(fakeAllowed.mailboxes[0]?.unreadMessages, BigInt(0));

      const deleteAudit = fakeAllowed.auditLogs.find(
        (a) => a.action === "message_deleted",
      );
      assert.ok(deleteAudit);
      assert.deepEqual(deleteAudit.details, {
        mailbox: "alice@mailstack.local",
        source_preserved: true,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("5. enforces canDeleteMailboxes on deleteUserMailbox and bulkDeleteUserMailboxes", async () => {
    const fakeDenied = createFakeWorkspacePrisma({
      canDeleteMailboxes: false,
    });
    const res1 = await deleteUserMailbox(
      fakeDenied as never,
      { userId: BigInt(101), isAdministrator: false },
      MAILBOX_A_UUID,
      "alice@mailstack.local",
      { mailStorageRoot: "/tmp", attachmentStorageRoot: "/tmp" },
    );
    assert.equal(res1.ok, false);
    if (!res1.ok) {
      assert.equal(res1.code, "not_found");
    }

    const res2 = await bulkDeleteUserMailboxes(
      fakeDenied as never,
      { userId: BigInt(101), isAdministrator: false },
      [MAILBOX_A_UUID],
      true,
      { mailStorageRoot: "/tmp", attachmentStorageRoot: "/tmp" },
    );
    assert.equal(res2.ok, false);
    if (!res2.ok) {
      assert.equal(res2.code, "not_found");
    }
  });

  it("6. builds strict CSP sandboxed HTML document and blocks unauthorized users", async () => {
    assert.match(SAFE_HTML_CSP_POLICY, /default-src 'none'/);
    assert.match(SAFE_HTML_CSP_POLICY, /img-src data: 'self'/);
    assert.match(SAFE_HTML_CSP_POLICY, /style-src 'unsafe-inline'/);
    assert.match(SAFE_HTML_CSP_POLICY, /base-uri 'none'/);
    assert.match(SAFE_HTML_CSP_POLICY, /form-action 'none'/);
    assert.match(SAFE_HTML_CSP_POLICY, /frame-ancestors 'self'/);
    assert.doesNotMatch(SAFE_HTML_CSP_POLICY, /navigate-to/);

    const fake = createFakeWorkspacePrisma();
    const detail = await getMessageDetailForUser(
      fake as never,
      { userId: BigInt(101), isAdministrator: false },
      MAILBOX_A_UUID,
      MESSAGE_A1_UUID,
    );
    assert.ok(detail);
    assert.equal(detail.hasHtmlBody, true);
    assert.equal(detail.htmlBody, undefined);

    const html = await getSanitizedMessageHtmlForUser(
      fake as never,
      { userId: BigInt(101), isAdministrator: false },
      MESSAGE_A1_UUID,
    );
    assert.ok(html);
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /<meta name='readbox-html-body' content='1'>/);
    assert.match(html, /November invoice/);
    assert.ok(fake.auditLogs.some((a) => a.action === "message_html_view"));

    const hardenedLinksHtml = buildSanitizedHtmlDocument(
      '<p><a href="https://vendor.example/inv">Invoice</a> <a href="mailto:support@vendor.example">Support</a> <button>Action</button></p>',
    );
    assert.match(
      hardenedLinksHtml,
      /href="https:\/\/vendor\.example\/inv" target="_blank" rel="noopener noreferrer"/,
    );
    assert.match(
      hardenedLinksHtml,
      /<a href="mailto:support@vendor\.example">Support<\/a>/,
    );
    assert.match(hardenedLinksHtml, /<button type="button">Action<\/button>/);

    const fallbackHtml = buildSanitizedHtmlDocument("");
    assert.match(fallbackHtml, /No HTML body is available\./);
  });

  it("7. confines attachment downloads to ATTACHMENT_STORAGE_ROOT and rejects traversal, symlinks, and non-members", async () => {
    const storageRoot = await mkdtemp(
      path.join(tmpdir(), "phase5-attachments-"),
    );
    try {
      const validDir = path.join(storageRoot, "10", "1");
      await rm(validDir, { recursive: true, force: true });
      const { mkdir } = await import("node:fs/promises");
      await mkdir(validDir, { recursive: true });
      const validFile = path.join(validDir, "invoice.pdf");
      await writeFile(validFile, "%PDF-1.4 fake invoice");

      const fake = createFakeWorkspacePrisma({
        storageRelativePath: "10/1/invoice.pdf",
      });

      // Authorized member download succeeds
      const allowed = await getAttachmentForUserDownload(
        fake as never,
        { userId: BigInt(101), isAdministrator: false },
        ATTACHMENT_A1_UUID,
        storageRoot,
      );
      assert.ok(allowed);
      assert.equal(allowed.safeFilename, "invoice.pdf");
      assert.equal(allowed.absoluteFilePath, validFile);
      assert.ok(fake.auditLogs.some((a) => a.action === "attachment_download"));

      // Unauthorized user (Bob) gets null (uniform 404)
      const deniedBob = await getAttachmentForUserDownload(
        fake as never,
        { userId: BigInt(202), isAdministrator: false },
        ATTACHMENT_A1_UUID,
        storageRoot,
      );
      assert.equal(deniedBob, null);

      // Path traversal relative path rejected with uniform null
      const fakeTraversal = createFakeWorkspacePrisma({
        storageRelativePath: "../../etc/passwd",
      });
      const traversalRes = await getAttachmentForUserDownload(
        fakeTraversal as never,
        { userId: BigInt(101), isAdministrator: false },
        ATTACHMENT_A1_UUID,
        storageRoot,
      );
      assert.equal(traversalRes, null);

      // Symlink file inside storage root rejected with uniform null
      const symlinkPath = path.join(validDir, "symlink.pdf");
      await symlink(validFile, symlinkPath);
      const fakeSymlink = createFakeWorkspacePrisma({
        storageRelativePath: "10/1/symlink.pdf",
      });
      const symlinkRes = await getAttachmentForUserDownload(
        fakeSymlink as never,
        { userId: BigInt(101), isAdministrator: false },
        ATTACHMENT_A1_UUID,
        storageRoot,
      );
      assert.equal(symlinkRes, null);

      const disposition = buildAttachmentContentDisposition("report 2026.pdf");
      assert.match(disposition, /^attachment; filename="report 2026\.pdf"/);
    } finally {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it("8. validates X-ReadBox-Live-Request header and returns bounded cursor updates without message bodies", async () => {
    const validHeaders = new Headers({ [LIVE_UPDATE_HEADER]: "1" });
    const missingHeaders = new Headers();
    assert.equal(isLiveBackgroundRequest(validHeaders), true);
    assert.equal(isLiveBackgroundRequest(missingHeaders), false);

    const fake = createFakeWorkspacePrisma();
    const aliceActor = { userId: BigInt(101), isAdministrator: false };

    // Bootstrap poll returns current cursor and zero messages
    const bootstrapPayload = await pollLiveMessagesForUser(
      fake as never,
      aliceActor,
      { bootstrap: true },
    );
    assert.equal(bootstrapPayload.cursor, 2);
    assert.equal(bootstrapPayload.messages.length, 0);
    assert.equal(bootstrapPayload.summary.total_mailboxes, 1);
    assert.equal(bootstrapPayload.summary.total_unread, 1);

    // Incremental poll after cursor=1 returns only Alice's message #2 (and never Bob's message #3)
    const incrementalPayload = await pollLiveMessagesForUser(
      fake as never,
      aliceActor,
      { bootstrap: false, cursor: 1 },
    );
    assert.equal(incrementalPayload.cursor, 2);
    assert.equal(incrementalPayload.messages.length, 1);
    assert.equal(incrementalPayload.messages[0]?.uuid, MESSAGE_A2_UUID);
    const firstMsgObj = incrementalPayload.messages[0] as unknown as Record<
      string,
      unknown
    >;
    assert.equal("textBody" in firstMsgObj, false);
    assert.equal("sanitizedHtmlBody" in firstMsgObj, false);

    const preview = buildMessagePreview("", "<p>Hello <b>world</b></p>", 10);
    assert.equal(preview, "Hello wor…");
  });

  it("9. renders dark-mode sanitized HTML document and gates demo non-admin mailbox deletion", () => {
    const darkDoc = buildSanitizedHtmlDocument("<p>Dark body</p>", {
      theme: "dark",
    });
    assert.match(darkDoc, /#151e26/);
    assert.match(darkDoc, /#e3ebf0/);
    assert.match(darkDoc, /Dark body/);

    const userOverview = getDemoUserOverview(false);
    assert.equal(userOverview.capabilities.canDeleteMailboxes, false);
    const adminOverview = getDemoUserOverview(true);
    assert.equal(adminOverview.capabilities.canDeleteMailboxes, true);

    const userMailboxes = listDemoUserMailboxes(false, {});
    assert.equal(userMailboxes.capabilities.canDeleteMailboxes, false);
    const adminMailboxes = listDemoUserMailboxes(true, {});
    assert.equal(adminMailboxes.capabilities.canDeleteMailboxes, true);
  });

  it("10. enforces User Control allowedDomainUuids, maxMailboxes quota, canCreateMailboxes, and autoDeleteDays retention in /users runtime", async () => {
    try {
      setDemoUserControlSettings({
        ...DEFAULT_USER_CONTROL_SETTINGS,
        allowedDomainUuids: ["99999999-0000-4000-8000-000000000001"],
        defaultMaxMailboxes: 1,
        defaultCanCreateMailboxes: true,
        autoDeleteEnabled: true,
        autoDeleteDays: 1,
      });

      const demoOverview = getDemoUserOverview(false, "2");
      assert.equal(demoOverview.availableDomains.length, 1);
      assert.equal(demoOverview.availableDomains[0]?.name, "readbox.local");
      assert.equal(demoOverview.capabilities.maxMailboxes, 1);
      assert.equal(demoOverview.capabilities.autoDeleteEnabled, true);
      assert.equal(demoOverview.capabilities.autoDeleteDays, 1);

      // Quota reached (store has 4 demo mailboxes > maxMailboxes=1)
      const blockedByQuota = createDemoMailbox(
        { localPart: "quota.test" },
        { isAdministrator: false, userId: "2" },
      );
      assert.equal(blockedByQuota.ok, false);
      if (!blockedByQuota.ok) {
        assert.match(blockedByQuota.error, /Mailbox limit reached/i);
      }

      // Per-user override disabling mailbox creation
      setDemoUserAccessPolicy("2", {
        canCreateMailboxes: false,
        canDeleteMessages: false,
        canDeleteMailboxes: false,
        maxMailboxes: 10,
        allowedDomainUuids: ["99999999-0000-4000-8000-000000000001"],
        autoDeleteEnabled: true,
        autoDeleteDays: 7,
      });

      const blockedByDisabled = createDemoMailbox(
        { localPart: "disabled.test" },
        { isAdministrator: false, userId: "2" },
      );
      assert.equal(blockedByDisabled.ok, false);
      if (!blockedByDisabled.ok) {
        assert.match(blockedByDisabled.error, /disabled for your account/i);
      }

      // Disallowed domain check in createUserSelfMailbox
      const fake = createFakeWorkspacePrisma();
      (fake.userAccessPolicy as { findUnique: unknown }).findUnique =
        async () => ({
          canCreateMailboxes: true,
          canDeleteMessages: false,
          canDeleteMailboxes: false,
          maxMailboxes: 5,
          allowedDomainUuids: ["99999999-0000-4000-8000-000000000001"],
          autoDeleteEnabled: false,
          autoDeleteDays: 0,
        });

      const blockedByDomain = await createUserSelfMailbox(
        fake as never,
        { userId: BigInt(101), isAdministrator: false },
        {
          localPart: "unpermitted",
          domainUuid: "99999999-0000-4000-8000-000000000002",
        },
        {
          mailDomain: "mailstack.local",
          mailStorageRoot: "/tmp/mail",
          attachmentStorageRoot: "/tmp/att",
          mailboxProvisionLockRoot: "/tmp/lock",
          defaultQuotaBytes: 1048576,
        },
      );
      assert.equal(blockedByDomain.ok, false);
      if (!blockedByDomain.ok) {
        assert.match(blockedByDomain.error, /not permitted/i);
      }
    } finally {
      resetDemoUserControlSettings();
    }
  });

  it("11. Phase 03 BUG-20: preserves recent receivedAt:null messages via createdAt fallback and purges expired messages with counter recalculation", async () => {
    const { isMessageWithinRetention, purgeExpiredMessagesForRetention } =
      await import("@/core/messages/service");

    const cutoff = new Date("2026-11-14T00:00:00.000Z");
    assert.equal(
      isMessageWithinRetention(
        {
          receivedAt: null,
          createdAt: new Date("2026-11-15T08:00:00.000Z"),
        },
        cutoff,
      ),
      true,
    );
    assert.equal(
      isMessageWithinRetention(
        {
          receivedAt: null,
          createdAt: new Date("2026-11-10T08:00:00.000Z"),
        },
        cutoff,
      ),
      false,
    );

    const fake = createFakeWorkspacePrisma();
    // Make Message #1 old (2026-10-01) and Message #2 recent with receivedAt: null
    fake.messages[0]!.receivedAt = new Date("2026-10-01T00:00:00.000Z");
    fake.messages[0]!.createdAt = new Date("2026-10-01T00:00:00.000Z");
    fake.messages[1]!.receivedAt = null;
    fake.messages[1]!.createdAt = new Date("2026-11-15T10:00:00.000Z");

    const now = new Date("2026-11-16T00:00:00.000Z");
    const drySummary = await purgeExpiredMessagesForRetention(fake as never, {
      dryRun: true,
      retentionDays: 7,
      now,
    });
    assert.equal(drySummary.purgedMessages, 1);
    assert.equal(drySummary.affectedMailboxes, 1);
    assert.equal(fake.messages[0]!.deletedAt, null);

    const liveSummary = await purgeExpiredMessagesForRetention(fake as never, {
      dryRun: false,
      retentionDays: 7,
      now,
      actor: {
        userId: BigInt(1),
        authSource: "admin_table",
        username: "admin",
      },
    });
    assert.equal(liveSummary.purgedMessages, 1);
    assert.notEqual(fake.messages[0]!.deletedAt, null);
    assert.equal(fake.messages[1]!.deletedAt, null);
    assert.equal(fake.mailboxes[0]!.totalMessages, BigInt(1));
    assert.equal(fake.mailboxes[0]!.unreadMessages, BigInt(0));
    assert.ok(
      fake.auditLogs.some((a) => a.action === "messages_retention_purged"),
    );
  });

  it("12. Phase 04 BUG-18: pollLiveMessagesForUser enforces retention cutoff on messages, summary totals, and per-mailbox counters", async () => {
    const fake = createFakeWorkspacePrisma();
    const aliceActor = { userId: BigInt(101), isAdministrator: false };

    // Set Message #1 old (expired) and Message #2 recent (within 7-day retention)
    fake.messages[0]!.receivedAt = new Date("2020-01-01T00:00:00.000Z");
    fake.messages[0]!.createdAt = new Date("2020-01-01T00:00:00.000Z");
    fake.messages[0]!.isRead = false;
    fake.messages[1]!.receivedAt = new Date();
    fake.messages[1]!.createdAt = new Date();
    fake.messages[1]!.isRead = false;

    (fake.userAccessPolicy as { findUnique: unknown }).findUnique =
      async () => ({
        canCreateMailboxes: true,
        canDeleteMessages: true,
        canDeleteMailboxes: false,
        maxMailboxes: 5,
        allowedDomainUuids: [],
        autoDeleteEnabled: true,
        autoDeleteDays: 7,
      });

    const livePoll = await pollLiveMessagesForUser(
      fake as never,
      aliceActor,
      {
        bootstrap: false,
        cursor: 0,
        mailboxUuids: [MAILBOX_A_UUID],
      },
    );

    assert.equal(livePoll.messages.length, 1);
    assert.equal(livePoll.messages[0]?.uuid, MESSAGE_A2_UUID);
    assert.equal(livePoll.summary.total_messages, 1);
    assert.equal(livePoll.summary.total_unread, 1);
    assert.equal(livePoll.mailboxes[0]?.total_messages, 1);
    assert.equal(livePoll.mailboxes[0]?.unread_messages, 1);
  });

  it("13. Phase 04 BUG-19: resolves inline cid: attachment references to same-origin attachment URLs in message detail, HTML endpoint, and sanitizer", async () => {
    const {
      sanitizeHtmlEmail,
      isSafeInternalAttachmentImagePath,
    } = await import("@/core/ingestion/sanitizer");
    const { resolveInlineCidAttachmentsInHtml } = await import(
      "@/core/messages/service"
    );

    assert.equal(
      isSafeInternalAttachmentImagePath(
        `/api/messages/attachment/${ATTACHMENT_A1_UUID}`,
      ),
      true,
    );
    assert.equal(
      isSafeInternalAttachmentImagePath("https://evil.example/track.png"),
      false,
    );

    const sanitizedWithCidMap = sanitizeHtmlEmail(
      '<p>Hello <img src="cid:logo-1@mailstack.local" alt="Logo"><img src="cid:unmapped-cid" alt="Drop"></p>',
      {
        cidMap: {
          "logo-1@mailstack.local": `/api/messages/attachment/${ATTACHMENT_A1_UUID}`,
        },
      },
    );
    assert.match(
      sanitizedWithCidMap,
      new RegExp(`/api/messages/attachment/${ATTACHMENT_A1_UUID}`),
    );
    assert.doesNotMatch(sanitizedWithCidMap, /unmapped-cid/);

    const resolvedBody = resolveInlineCidAttachmentsInHtml(
      '<p><img src="cid:banner-cid" alt="Banner"></p>',
      [
        {
          uuid: ATTACHMENT_A1_UUID,
          contentId: "<banner-cid>",
          originalFilename: "banner.png",
          safeFilename: "banner.png",
          isInline: true,
        },
      ],
    );
    assert.equal(
      resolvedBody,
      `<p><img src="/api/messages/attachment/${ATTACHMENT_A1_UUID}" alt="Banner"></p>`,
    );
  });

  it("13. Phase 05 BUG-08: enforces dynamic capabilities, ownership, retention, and cursor-based live polling in Demo Workspace", () => {
    try {
      // 1. Set policy with canDeleteMessages: false and canDeleteMailboxes: false for userId: "2"
      setDemoUserAccessPolicy("2", {
        canCreateMailboxes: true,
        canDeleteMessages: false,
        canDeleteMailboxes: false,
        maxMailboxes: 5,
        allowedDomainUuids: [],
        autoDeleteEnabled: false,
        autoDeleteDays: 0,
      });

      // 2. getDemoMessageDetail reflects canDeleteMessage: false for non-admin user
      const msgDetailUser = getDemoMessageDetail(
        "11111111-1111-4111-8111-111111111101",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001",
        { isAdministrator: false, userId: "2" },
      );
      assert.equal(Boolean(msgDetailUser), true);
      assert.equal(msgDetailUser?.canDeleteMessage, false);

      // Admin gets canDeleteMessage: true
      const msgDetailAdmin = getDemoMessageDetail(
        "11111111-1111-4111-8111-111111111101",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001",
        { isAdministrator: true, userId: "2" },
      );
      assert.equal(Boolean(msgDetailAdmin), true);
      assert.equal(msgDetailAdmin?.canDeleteMessage, true);

      // 3. softDeleteDemoMessage rejected when canDeleteMessages is false
      const softDeleteBlocked = softDeleteDemoMessage(
        "11111111-1111-4111-8111-111111111101",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001",
        { isAdministrator: false, userId: "2" },
      );
      assert.equal(softDeleteBlocked.ok, false);
      if (!softDeleteBlocked.ok) {
        assert.equal(softDeleteBlocked.code, "forbidden");
      }

      // 4. deleteDemoMailbox rejected when canDeleteMailboxes is false
      const deleteMailboxBlocked = deleteDemoMailbox(
        "11111111-1111-4111-8111-111111111101",
        "billing.ops@readbox.local",
        { isAdministrator: false, userId: "2" },
      );
      assert.equal(deleteMailboxBlocked.ok, false);
      if (!deleteMailboxBlocked.ok) {
        assert.equal(deleteMailboxBlocked.code, "blocked");
      }

      // 5. Ownership isolation: create mailbox assigned to userId: "999"
      const createdForOther = createDemoMailbox(
        { localPart: "isolated.box" },
        { isAdministrator: false, userId: "999" },
      );
      assert.equal(createdForOther.ok, true);
      if (createdForOther.ok) {
        const otherUuid = createdForOther.data.uuid;

        // User "2" cannot access mailbox of user "999"
        const forbiddenList = listDemoMailboxMessages(
          otherUuid,
          {},
          false,
          "2",
        );
        assert.equal(forbiddenList, null);

        // Admin CAN access mailbox of user "999"
        const adminAccess = listDemoMailboxMessages(
          otherUuid,
          {},
          true,
          "1",
        );
        assert.equal(Boolean(adminAccess), true);
      }

      // 6. pollDemoLivePayload supports cursor-based incremental polling
      const pollBootstrap = pollDemoLivePayload([], {
        isAdministrator: true,
        cursor: 0,
        bootstrap: true,
      });
      assert.equal(pollBootstrap.messages.length, 0);
      assert.equal(pollBootstrap.cursor >= 5000, true);

      // Polling with cursor = 5000 returns messages with id > 5000
      const pollIncremental = pollDemoLivePayload([], {
        isAdministrator: true,
        cursor: 5000,
        bootstrap: false,
      });
      assert.equal(pollIncremental.messages.length > 0, true);
      assert.equal(pollIncremental.cursor >= 5001, true);
      assert.equal(pollIncremental.messages[0]?.id, 5001);
    } finally {
      resetDemoUserControlSettings();
    }
  });

  it("14. Phase 3 FA-006: retention purge uses batched updateMany and respects per-user policy overrides alongside global inheritance", async () => {
    const { purgeExpiredMessagesForRetention } = await import(
      "@/core/messages/service"
    );

    const fake = createFakeWorkspacePrisma();
    // Mailbox 10 (Alice, uid 101) has message #1 from 15 days ago and message #2 from 2 days ago
    fake.messages[0]!.receivedAt = new Date("2026-11-01T00:00:00.000Z");
    fake.messages[0]!.createdAt = new Date("2026-11-01T00:00:00.000Z");
    fake.messages[1]!.receivedAt = new Date("2026-11-14T00:00:00.000Z");
    fake.messages[1]!.createdAt = new Date("2026-11-14T00:00:00.000Z");

    // Mailbox 20 (Bob, uid 202) has message #3 from 15 days ago
    fake.messages[2]!.receivedAt = new Date("2026-11-01T00:00:00.000Z");
    fake.messages[2]!.createdAt = new Date("2026-11-01T00:00:00.000Z");

    let updateManyCalls = 0;
    const origUpdateMany = fake.message.updateMany;
    fake.message.updateMany = async (args) => {
      updateManyCalls += 1;
      return origUpdateMany(args);
    };

    // Attach per-user policy overrides: global is disabled, Alice has 7-day retention, Bob explicitly disables auto-delete
    (fake as Record<string, unknown>).mailboxMembership = {
      findMany: async () => [
        {
          mailboxId: BigInt(10),
          user: {
            isActive: true,
            accessPolicy: {
              canCreateMailboxes: null,
              canDeleteMessages: true,
              canDeleteMailboxes: false,
              maxMailboxes: null,
              allowedDomainUuids: [],
              autoDeleteEnabled: true,
              autoDeleteDays: 7,
            },
          },
        },
        {
          mailboxId: BigInt(20),
          user: {
            isActive: true,
            accessPolicy: {
              canCreateMailboxes: null,
              canDeleteMessages: false,
              canDeleteMailboxes: false,
              maxMailboxes: null,
              allowedDomainUuids: [],
              autoDeleteEnabled: false,
              autoDeleteDays: 0,
            },
          },
        },
      ],
    };

    const summary = await purgeExpiredMessagesForRetention(fake as never, {
      dryRun: false,
      now: new Date("2026-11-16T00:00:00.000Z"),
    });

    assert.equal(updateManyCalls, 1);
    assert.equal(summary.affectedMailboxes, 1);
    assert.equal(summary.purgedMessages, 1);
    assert.notEqual(fake.messages[0]!.deletedAt, null);
    assert.equal(fake.messages[1]!.deletedAt, null);
    assert.equal(fake.messages[2]!.deletedAt, null);
  });
});

