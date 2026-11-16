import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/users",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/notifications", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { claimMessageNotification } from "@/components/users/live-mail-notifier";
import { MailboxInboxView } from "@/components/users/mailbox-inbox-view";
import { MessageReaderView } from "@/components/users/message-reader-view";
import { UserMailboxesView } from "@/components/users/user-mailboxes-view";
import { UsersWorkspaceShell } from "@/components/users/users-workspace-shell";
import { UserOverview } from "@/users/overview-panel";

describe("Phase 5 — User Workspace UI components", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          cursor: 5,
          has_more: false,
          summary: {
            total_mailboxes: 2,
            active_mailboxes: 2,
            disabled_mailboxes: 0,
            total_messages: 10,
            total_unread: 3,
            last_received: "2026-11-15T10:00:00.000Z",
          },
          mailboxes_truncated: false,
          mailboxes: [],
          messages: [],
        }),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders UserOverview KPIs, assigned mailboxes, recent messages, and opens Create mailbox modal", async () => {
    const user = userEvent.setup();
    const createAction = vi.fn(async () => ({
      ok: true as const,
      data: {
        uuid: "11111111-2222-4333-8444-555555555555",
        emailAddress: "team.desk@mailstack.local",
        localPart: "team.desk",
      },
    }));

    render(
      <UserOverview
        username="demo.user"
        createMailboxAction={createAction}
        snapshot={{
          databaseConfigured: true,
          totalMailboxes: 2,
          activeMailboxes: 2,
          disabledMailboxes: 0,
          totalMessages: 10,
          totalUnread: 3,
          lastReceivedAt: "2026-11-15T10:00:00.000Z",
          recentMessages: [
            {
              id: "1",
              uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1",
              mailboxUuid: "11111111-2222-4333-8444-555555555555",
              mailboxEmail: "alice@mailstack.local",
              senderName: "Vendor Billing",
              senderAddress: "billing@vendor.example",
              subject: "Invoice #9021",
              preview: "Attached is your monthly statement.",
              receivedAt: "2026-11-15T10:00:00.000Z",
              isRead: false,
              hasAttachments: true,
              sizeBytes: "2048",
            },
          ],
          recentMailboxes: [
            {
              id: "10",
              uuid: "11111111-2222-4333-8444-555555555555",
              localPart: "alice",
              emailAddress: "alice@mailstack.local",
              domainUuid: "99999999-0000-4000-8000-000000000001",
              domainName: "mailstack.local",
              status: "active",
              totalMessages: "10",
              unreadMessages: "3",
              lastReceivedAt: "2026-11-15T10:00:00.000Z",
              createdAt: "2026-11-10T00:00:00.000Z",
            },
          ],
          availableDomains: [
            {
              id: "1",
              uuid: "99999999-0000-4000-8000-000000000001",
              name: "mailstack.local",
              isDefault: true,
            },
          ],
          capabilities: {
            canDeleteMessages: false,
            canDeleteMailboxes: false,
          },
        }}
      />,
    );

    expect(screen.getByText("Inbox & Mailbox Workspace")).toBeInTheDocument();
    expect(screen.getByText("Invoice #9021")).toBeInTheDocument();
    expect(screen.getAllByText("alice@mailstack.local").length).toBeGreaterThan(
      0,
    );

    await user.click(screen.getByRole("button", { name: /Create mailbox/i }));
    expect(
      screen.getByRole("dialog", { name: /Create mailbox/i }),
    ).toBeInTheDocument();
  });

  it("renders singular '1 message' label and mounts only one Create mailbox modal inside UsersWorkspaceShell", async () => {
    const user = userEvent.setup();
    const createAction = vi.fn(async () => ({
      ok: true as const,
      data: {
        uuid: "11111111-2222-4333-8444-555555555555",
        emailAddress: "single@mailstack.local",
        localPart: "single",
      },
    }));

    const singleMailbox = {
      id: "10",
      uuid: "11111111-2222-4333-8444-555555555555",
      localPart: "single",
      emailAddress: "single@mailstack.local",
      domainUuid: "99999999-0000-4000-8000-000000000001",
      domainName: "mailstack.local",
      status: "active",
      totalMessages: "1",
      unreadMessages: "1",
      lastReceivedAt: "2026-11-15T10:00:00.000Z",
      createdAt: "2026-11-10T00:00:00.000Z",
    };

    render(
      <UsersWorkspaceShell
        mailboxes={[singleMailbox]}
        domains={[
          {
            id: "1",
            uuid: "99999999-0000-4000-8000-000000000001",
            name: "mailstack.local",
            isDefault: true,
          },
        ]}
        databaseConfigured={true}
        createMailboxAction={createAction}
      >
        <UserOverview
          username="demo.user"
          createMailboxAction={createAction}
          snapshot={{
            databaseConfigured: true,
            totalMailboxes: 1,
            activeMailboxes: 1,
            disabledMailboxes: 0,
            totalMessages: 1,
            totalUnread: 1,
            lastReceivedAt: "2026-11-15T10:00:00.000Z",
            recentMessages: [],
            recentMailboxes: [singleMailbox],
            availableDomains: [
              {
                id: "1",
                uuid: "99999999-0000-4000-8000-000000000001",
                name: "mailstack.local",
                isDefault: true,
              },
            ],
            capabilities: {
              canDeleteMessages: false,
              canDeleteMailboxes: false,
            },
          }}
        />
      </UsersWorkspaceShell>,
    );

    expect(screen.getByText(/1 message/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 messages/i)).not.toBeInTheDocument();

    const createButtons = screen.getAllByRole("button", {
      name: /Create mailbox/i,
    });
    await user.click(createButtons[1] ?? createButtons[0]);
    expect(
      screen.getAllByRole("dialog", { name: /Create mailbox/i }),
    ).toHaveLength(1);
  });

  it("gates Delete controls in UserMailboxesView by canDeleteMailboxes policy", () => {
    const noopCreate = vi.fn();
    const noopDelete = vi.fn();
    const noopBulk = vi.fn();

    const baseMailbox = {
      id: "10",
      uuid: "11111111-2222-4333-8444-555555555555",
      localPart: "alice",
      emailAddress: "alice@mailstack.local",
      domainUuid: "99999999-0000-4000-8000-000000000001",
      domainName: "mailstack.local",
      status: "active",
      totalMessages: "4",
      unreadMessages: "1",
      lastReceivedAt: "2026-11-15T10:00:00.000Z",
      createdAt: "2026-11-10T00:00:00.000Z",
    };

    render(
      <UserMailboxesView
        listResult={{
          databaseConfigured: true,
          items: [baseMailbox],
          totalCount: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
          query: "",
          statusFilter: "all",
          availableDomains: [],
          capabilities: {
            canDeleteMessages: false,
            canDeleteMailboxes: false,
          },
        }}
        createMailboxAction={noopCreate}
        deleteMailboxAction={noopDelete}
        bulkDeleteMailboxesAction={noopBulk}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /^Delete$/i }),
    ).not.toBeInTheDocument();

    cleanup();

    render(
      <UserMailboxesView
        listResult={{
          databaseConfigured: true,
          items: [baseMailbox],
          totalCount: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
          query: "",
          statusFilter: "all",
          availableDomains: [],
          capabilities: {
            canDeleteMessages: false,
            canDeleteMailboxes: true,
          },
        }}
        createMailboxAction={noopCreate}
        deleteMailboxAction={noopDelete}
        bulkDeleteMailboxesAction={noopBulk}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Delete$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete selected/i }),
    ).toBeInTheDocument();
  });

  it("renders MailboxInboxView with search/filter controls and message rows", () => {
    render(
      <MailboxInboxView
        inboxResult={{
          mailbox: {
            id: "10",
            uuid: "11111111-2222-4333-8444-555555555555",
            localPart: "alice",
            emailAddress: "alice@mailstack.local",
            domainName: "mailstack.local",
            status: "active",
            totalMessages: 2,
            unreadMessages: 1,
            lastReceivedAt: "2026-11-15T10:00:00.000Z",
          },
          items: [
            {
              id: "1",
              uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1",
              senderName: "Security Ops",
              senderAddress: "secops@example.com",
              subject: "TLS Certificate Renewed",
              preview: "Your certificate renewal succeeded.",
              receivedAt: "2026-11-15T10:00:00.000Z",
              sizeBytes: 1536,
              isRead: false,
              hasAttachments: true,
              parseStatus: "ok",
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 30,
          totalPages: 1,
          query: "",
          readFilter: "all",
          attachmentFilter: "all",
          liveUnfilteredFirstPage: true,
          canDeleteMailbox: false,
        }}
      />,
    );

    expect(screen.getByText("TLS Certificate Renewed")).toBeInTheDocument();
    expect(screen.getByLabelText("Read state")).toBeInTheDocument();
    expect(screen.getByLabelText("Attachment filter")).toBeInTheDocument();
  });

  it("renders MessageReaderView with unified Gmail-style email body, working links/buttons, attachments, and gated Delete button without HTML/Plain-text toggles", async () => {
    const user = userEvent.setup();
    const markUnread = vi.fn(async () => ({
      ok: true as const,
      data: { uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1", isRead: false },
    }));
    const deleteMsg = vi.fn(async () => ({
      ok: true as const,
      data: { uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1" },
    }));

    render(
      <MessageReaderView
        markUnreadAction={markUnread}
        deleteMessageAction={deleteMsg}
        message={{
          id: "1",
          uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1",
          mailbox: {
            id: "10",
            uuid: "11111111-2222-4333-8444-555555555555",
            localPart: "alice",
            emailAddress: "alice@mailstack.local",
            domainName: "mailstack.local",
            status: "active",
            totalMessages: 2,
            unreadMessages: 0,
            lastReceivedAt: "2026-11-15T10:00:00.000Z",
          },
          messageIdHeader: "<m1@mailstack.local>",
          senderName: "Billing Team",
          senderAddress: "billing@vendor.example",
          recipientAddresses: ["alice@mailstack.local"],
          ccAddresses: [],
          subject: "November Statement",
          receivedAt: "2026-11-15T10:00:00.000Z",
          parsedAt: "2026-11-15T10:01:00.000Z",
          sizeBytes: 4096,
          isRead: true,
          hasAttachments: true,
          parseStatus: "ok",
          parseWarning: "",
          textBody: "Plain text fallback statement.",
          htmlBody:
            '<div><p>Your November statement is ready.</p><a href="https://billing.vendor.example/inv/9021">View Invoice #9021</a></div>',
          hasHtmlBody: true,
          attachments: [
            {
              uuid: "cccccccc-dddd-4eee-8fff-111111111111",
              originalFilename: "statement.pdf",
              safeFilename: "statement.pdf",
              declaredMimeType: "application/pdf",
              detectedMimeType: "application/pdf",
              sizeBytes: 2048,
              isInline: false,
            },
          ],
          canDeleteMessage: true,
        }}
      />,
    );

    // Ensure confusing Sanitized HTML / Plain text toggle buttons are absent
    expect(
      screen.queryByRole("button", { name: /Sanitized HTML/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Plain text/i })).toBeNull();

    // Ensure HTML email body and interactive CTA link render directly in the DOM
    expect(
      screen.getByText("Your November statement is ready."),
    ).toBeInTheDocument();
    const ctaLink = screen.getByRole("link", { name: /View Invoice #9021/i });
    expect(ctaLink).toHaveAttribute(
      "href",
      "https://billing.vendor.example/inv/9021",
    );
    expect(ctaLink).toHaveAttribute("target", "_blank");

    expect(screen.getByText("statement.pdf")).toBeInTheDocument();

    // Open delete modal
    await user.click(screen.getByRole("button", { name: /^Delete$/i }));
    expect(
      screen.getByRole("dialog", { name: /Delete message from workspace/i }),
    ).toBeInTheDocument();
  });

  it("deduplicates cross-tab notifications via claimMessageNotification", async () => {
    const memory = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, val: string) => {
        memory.set(key, val);
      },
    };
    const posted: unknown[] = [];
    const fakeChannel = {
      postMessage: (msg: unknown) => {
        posted.push(msg);
      },
    };

    const firstClaim = await claimMessageNotification("msg-uuid-1", {
      storage: fakeStorage,
      channel: fakeChannel,
    });
    const secondClaim = await claimMessageNotification("msg-uuid-1", {
      storage: fakeStorage,
      channel: fakeChannel,
    });

    expect(firstClaim).toBe(true);
    expect(secondClaim).toBe(false);
    expect(posted.length).toBe(1);
  });
});
