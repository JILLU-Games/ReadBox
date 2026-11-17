import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

import { RouteErrorPanel } from "@/components/layout/route-error-panel";
import {
  claimMessageNotification,
  LIVE_BROADCAST_CHANNEL_NAME,
  NOTIFIED_STORAGE_KEY,
} from "@/components/users/live-mail-notifier";
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

  it("renders MailboxInboxView with compact search, filter tabs, sender initials, and clutter-free message rows", () => {
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
    expect(screen.getByText("SO")).toBeInTheDocument();
    expect(screen.getByText("Nov 15, 10:00")).toBeInTheDocument();
    expect(screen.queryByText("1.5 KB")).toBeNull();
    expect(screen.getByLabelText("Read state")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/users/inbox/11111111-2222-4333-8444-555555555555",
    );
    expect(screen.getByRole("link", { name: "Unread" })).toHaveAttribute(
      "href",
      "/users/inbox/11111111-2222-4333-8444-555555555555?read=unread",
    );
    expect(screen.getByRole("link", { name: "Read" })).toHaveAttribute(
      "href",
      "/users/inbox/11111111-2222-4333-8444-555555555555?read=read",
    );
    expect(screen.getByLabelText("Attachment filter")).toHaveAttribute(
      "href",
      "/users/inbox/11111111-2222-4333-8444-555555555555?attachments=yes",
    );
  });

  it("renders MessageReaderView with sandboxed iframe isolation, error fallback with Retry, attachments, and gated Delete button", async () => {
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

    // Verify parent React DOM does NOT inject raw email HTML inline
    expect(screen.queryByText("Your November statement is ready.")).toBeNull();

    // Verify sandboxed iframe points to CSP-hardened HTML endpoint without allow-scripts
    const iframe = screen.getByTestId("message-html-iframe") as HTMLIFrameElement;
    expect(iframe).toHaveAttribute(
      "src",
      "/api/messages/html/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1?theme=light",
    );
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-popups allow-popups-to-escape-sandbox",
    );
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-scripts");

    // Simulate successful CSP-guarded load with readbox-html-body meta marker
    const fakeDoc = document.implementation.createHTMLDocument("email");
    const meta = fakeDoc.createElement("meta");
    meta.setAttribute("name", "readbox-html-body");
    meta.setAttribute("content", "1");
    fakeDoc.head.appendChild(meta);
    fakeDoc.body.innerHTML = "<p>Iframe content loaded cleanly.</p>";
    Object.defineProperty(iframe, "contentDocument", {
      configurable: true,
      get: () => fakeDoc,
    });
    fireEvent.load(iframe);
    expect(screen.queryByText(/Loading formatted email/i)).toBeNull();

    // Simulate 404/plain-text response loaded into iframe (missing readbox-html-body meta) -> EH-05 fallback
    const emptyDoc = document.implementation.createHTMLDocument("404");
    emptyDoc.body.textContent = "Not found";
    Object.defineProperty(iframe, "contentDocument", {
      configurable: true,
      get: () => emptyDoc,
    });
    fireEvent.load(iframe);
    expect(
      screen.getByText(/Formatted HTML body could not be loaded/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Plain text fallback statement."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("message-html-iframe")).toBeNull();

    // Retry remounts the sandboxed iframe and error event also triggers fallback
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    const retriedIframe = screen.getByTestId("message-html-iframe");
    fireEvent.error(retriedIframe);
    expect(
      screen.getByText(/Formatted HTML body could not be loaded/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Retry/i }));
    expect(screen.getByTestId("message-html-iframe")).toBeInTheDocument();

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
    expect(NOTIFIED_STORAGE_KEY).toBe("readbox-notified-message-uuids");
    expect(LIVE_BROADCAST_CHANNEL_NAME).toBe("readbox-live-notifications");
  });

  it("Phase 4 EH-02 & EH-04: renders databaseError AlertBanner in UserOverview & UserMailboxesView and recovery actions in RouteErrorPanel", async () => {
    const user = userEvent.setup();
    render(
      <UserOverview
        username="alice"
        snapshot={{
          databaseConfigured: false,
          databaseError: "PostgreSQL overview query failed.",
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
            canDeleteMessages: false,
            canDeleteMailboxes: false,
          },
        }}
      />,
    );

    expect(
      screen.getByText("Database temporarily unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PostgreSQL overview query failed."),
    ).toBeInTheDocument();

    cleanup();

    render(
      <UserMailboxesView
        listResult={{
          databaseConfigured: false,
          databaseError: "PostgreSQL mailbox query failed.",
          items: [],
          totalCount: 0,
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
        createMailboxAction={vi.fn()}
        deleteMailboxAction={vi.fn()}
        bulkDeleteMailboxesAction={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Database temporarily unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PostgreSQL mailbox query failed."),
    ).toBeInTheDocument();

    cleanup();

    const onReset = vi.fn();
    render(
      <RouteErrorPanel
        title="Sign-in view temporarily unavailable"
        description="Retry or return home."
        backHref="/"
        backLabel="Back to home"
        onReset={onReset}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: "Back to home" }),
    ).toHaveAttribute("href", "/");
  });
});
