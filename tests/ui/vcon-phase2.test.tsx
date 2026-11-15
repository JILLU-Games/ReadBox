import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
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

import { AuditConsole } from "@/components/vcon/audit-console";
import { UserForm } from "@/components/vcon/user-form";
import { UsersDirectory } from "@/components/vcon/users-directory";
import { AdminOverview } from "@/vcon/overview-panel";

describe("Phase 2 /vcon overview, user management, and audit UI", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders AdminOverview KPIs, health strip, and copies recent mailbox address", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <AdminOverview
        data={{
          databaseConfigured: true,
          databaseConnected: true,
          kpis: {
            totalMailboxes: 4,
            activeMailboxes: 3,
            disabledMailboxes: 1,
            totalMessages: 19,
            totalUnread: 5,
            lastReceivedAt: "2026-11-15T11:30:00.000Z",
          },
          health: {
            database: { label: "Database", state: "ok", detail: "Connected" },
            ingestion: {
              label: "Ingestion service",
              state: "ok",
              detail: "Healthy",
              meta: "2026-11-15T11:59:00.000Z",
            },
            mailStorage: {
              label: "Mail storage",
              state: "ok",
              detail: "Accessible",
            },
          },
          recentMessages: [
            {
              uuid: "m1",
              mailboxUuid: "b1",
              mailboxEmail: "support@readbox.test",
              subject: "Test delivery",
              senderAddress: "sender@remote.test",
              senderName: "Sender",
              receivedAt: "2026-11-15T11:30:00.000Z",
              isRead: false,
            },
          ],
          recentMailboxes: [
            {
              uuid: "b1",
              emailAddress: "support@readbox.test",
              status: "active",
              totalMessages: "19",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("System overview")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Test delivery")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /support@readbox\.test/i }),
    );
    expect(writeText).toHaveBeenCalledWith("support@readbox.test");
  });

  it("supports generators, live mailbox filter, password toggle, and Create & copy modal in UserForm", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const onCreate = vi.fn(async (input) => ({
      ok: true as const,
      data: { id: "50", username: input.username },
    }));

    render(
      <UserForm
        mode="create"
        mailboxes={[
          {
            id: "1",
            uuid: "u1",
            emailAddress: "alpha@readbox.test",
            status: "active",
          },
          {
            id: "2",
            uuid: "u2",
            emailAddress: "billing@readbox.test",
            status: "active",
          },
        ]}
        onCreate={onCreate}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Generate random username/i }),
    );
    const usernameInput = screen.getByLabelText("Username") as HTMLInputElement;
    expect(usernameInput.value.length).toBeGreaterThan(3);

    await user.click(screen.getByRole("button", { name: "Auto-generate" }));
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const confirmInput = screen.getByLabelText(
      "Password confirmation",
    ) as HTMLInputElement;
    expect(passwordInput.value.length).toBeGreaterThanOrEqual(15);
    expect(confirmInput.value).toBe(passwordInput.value);

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput.type).toBe("text");

    await user.type(screen.getByLabelText("Search mailboxes"), "billing");
    expect(
      screen.queryByText("alpha@readbox.test"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByText("billing@readbox.test"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Create & copy/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("dialog", { name: "User created" }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(`Username: ${usernameInput.value}`),
    );
  });

  it("hides Edit/Delete controls for administrators and confirms delete for regular users", async () => {
    const onDeleteUser = vi.fn(async () => ({
      ok: true as const,
      data: { username: "inbox.user" },
    }));
    const user = userEvent.setup();

    render(
      <UsersDirectory
        databaseConfigured={true}
        databaseConnected={true}
        onDeleteUser={onDeleteUser}
        list={{
          query: "",
          page: 1,
          pageSize: 25,
          totalCount: 2,
          totalPages: 1,
          items: [
            {
              id: "1",
              username: "root.admin",
              firstName: "",
              lastName: "",
              email: "",
              isAdministrator: true,
              isActive: true,
              mailboxCount: 0,
              canDeleteMessages: false,
              canDeleteMailboxes: false,
              dateJoined: "2026-11-01T00:00:00.000Z",
              lastLogin: null,
            },
            {
              id: "2",
              username: "inbox.user",
              firstName: "Inbox",
              lastName: "User",
              email: "",
              isAdministrator: false,
              isActive: true,
              mailboxCount: 1,
              canDeleteMessages: true,
              canDeleteMailboxes: false,
              dateJoined: "2026-11-02T00:00:00.000Z",
              lastLogin: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Managed outside this screen")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Edit" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("dialog", { name: /Delete user inbox\.user\?/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(onDeleteUser).toHaveBeenCalledWith("2");
  });

  it("renders AuditConsole active lockouts and audit events", () => {
    render(
      <AuditConsole
        bundle={{
          databaseConfigured: true,
          databaseConnected: true,
          logs: {
            actionFilter: "",
            query: "",
            page: 1,
            pageSize: 25,
            totalCount: 1,
            totalPages: 1,
            availableActions: ["login_failure", "user_created"],
            items: [
              {
                uuid: "log-1",
                action: "user_created",
                actorUsername: "root.admin",
                targetType: "user",
                targetIdentifier: "inbox.user",
                ipAddress: "198.51.100.1",
                userAgent: "Browser",
                details: { active: true },
                createdAt: "2026-11-15T10:00:00.000Z",
              },
            ],
          },
          security: {
            recentFailureCount: 5,
            activeLockouts: [
              {
                usernameNormalized: "locked.user",
                ipAddress: "203.0.113.8",
                failureCount: 5,
                latestFailureAt: "2026-11-15T11:50:00.000Z",
                lockedUntil: "2026-11-15T12:05:00.000Z",
                remainingSeconds: 600,
              },
            ],
            recentAttempts: [],
          },
        }}
      />,
    );

    expect(screen.getByText("1 active lockout")).toBeInTheDocument();
    expect(screen.getByText("locked.user")).toBeInTheDocument();
    expect(screen.getByText("inbox.user")).toBeInTheDocument();
  });
});
