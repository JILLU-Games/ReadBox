import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockNotify } = vi.hoisted(() => ({
  mockNotify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/users/settings",
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
  notify: mockNotify,
  NotificationToaster: () => null,
}));

import { UserSettingsView } from "@/components/users/user-settings-view";
import { UsersWorkspaceShell } from "@/components/users/users-workspace-shell";

const sampleDomains = [
  { id: "1", uuid: "99999999-0000-4000-8000-000000000001", name: "readbox.local", isDefault: true },
];

const sampleProfile = {
  id: "9002",
  username: "demo.user",
  firstName: "Demo",
  lastName: "User",
  email: "user@readbox.local",
  phone: "",
  isAdministrator: false,
  authSource: "user_table" as const,
  editable: true,
  dateJoined: null,
  lastLogin: null,
};

const sampleSecurity = {
  passwordPolicy: { minLength: 12, requireStrongPassword: true },
  activeSessions: [
    {
      id: "sess-1",
      label: "Chrome · Linux",
      ipAddress: "127.0.0.1",
      createdAt: "2026-11-16T08:00:00.000Z",
      lastSeenAt: "2026-11-16T09:00:00.000Z",
      expiresAt: "2026-11-16T16:00:00.000Z",
      isCurrent: true,
    },
    {
      id: "sess-2",
      label: "Firefox · Windows",
      ipAddress: "10.0.0.9",
      createdAt: "2026-11-16T07:00:00.000Z",
      lastSeenAt: null,
      expiresAt: "2026-11-16T15:00:00.000Z",
      isCurrent: false,
    },
  ],
  recentEvents: [
    {
      id: "evt-1",
      action: "login_success",
      label: "Signed in",
      ipAddress: "127.0.0.1",
      createdAt: "2026-11-16T08:00:00.000Z",
      outcome: "success" as const,
    },
  ],
  canManageSecurity: true,
};

describe("Users Panel — Sidebar Add mailbox & /users/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          cursor: 1,
          has_more: false,
          summary: {
            total_mailboxes: 1,
            active_mailboxes: 1,
            disabled_mailboxes: 0,
            total_messages: 0,
            total_unread: 0,
            last_received: null,
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

  it("opens CreateUserMailboxModal when readbox:open-create-mailbox fires on UsersWorkspaceShell", () => {
    render(
      <UsersWorkspaceShell
        mailboxes={[]}
        totalMailboxCount={0}
        domains={sampleDomains}
        capabilities={{
          canDeleteMessages: true,
          canDeleteMailboxes: true,
          canCreateMailboxes: true,
          maxMailboxes: 5,
        }}
        databaseConfigured={false}
        createMailboxAction={vi.fn()}
      >
        <div>Settings body</div>
      </UsersWorkspaceShell>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent("readbox:open-create-mailbox"));
    });

    expect(
      screen.getByRole("dialog", { name: "Create mailbox" }),
    ).toBeInTheDocument();
  });

  it("shows exact quota error toast when Add mailbox triggers at quota limit", () => {
    render(
      <UsersWorkspaceShell
        mailboxes={[]}
        totalMailboxCount={2}
        domains={sampleDomains}
        capabilities={{
          canDeleteMessages: false,
          canDeleteMailboxes: false,
          canCreateMailboxes: true,
          maxMailboxes: 2,
        }}
        databaseConfigured={false}
        createMailboxAction={vi.fn()}
      >
        <div>Workspace body</div>
      </UsersWorkspaceShell>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("readbox:open-create-mailbox"));
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockNotify.error).toHaveBeenCalledWith(
      "Mailbox limit reached (2/2). Contact an administrator to increase your quota.",
    );
  });

  it("renders UserSettingsView profile details, validates errors, and persists updates cleanly", async () => {
    const user = userEvent.setup();
    const updateAction = vi.fn(async (input) => ({
      ok: true as const,
      message: "Profile settings saved.",
      data: {
        ...sampleProfile,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
      },
    }));

    render(
      <UserSettingsView
        profile={sampleProfile}
        security={sampleSecurity}
        mailboxQuota={{ used: 4, max: 10 }}
        databaseConfigured={true}
        updateProfileAction={updateAction}
      />,
    );

    expect(screen.getByLabelText("Username")).toBeDisabled();
    expect(screen.getByText("4 / 10")).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: /Save changes/i });
    expect(saveButton).toBeDisabled();

    const firstNameInput = screen.getByLabelText("First name");
    const phoneInput = screen.getByLabelText("Phone");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Rahim");
    await user.type(phoneInput, "+880 1700 112233");

    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect(updateAction).toHaveBeenCalledWith({
      firstName: "Rahim",
      lastName: "User",
      email: "user@readbox.local",
      phone: "+880 1700 112233",
    });
    expect(mockNotify.success).toHaveBeenCalledWith("Profile settings saved.");
    expect(screen.getByText("Profile settings saved.")).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it("displays exact inline field error and toast when updateProfileAction fails validation", async () => {
    const user = userEvent.setup();
    const updateAction = vi.fn(async () => ({
      ok: false as const,
      code: "validation" as const,
      error: "Enter a valid email address or leave blank.",
      fieldErrors: {
        email: "Enter a valid email address or leave blank.",
      },
    }));

    render(
      <UserSettingsView
        profile={sampleProfile}
        security={sampleSecurity}
        mailboxQuota={{ used: 1, max: 0 }}
        databaseConfigured={true}
        updateProfileAction={updateAction}
      />,
    );

    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "invalid-email");
    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(mockNotify.error).toHaveBeenCalledWith(
      "Enter a valid email address or leave blank.",
    );
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getAllByText("Enter a valid email address or leave blank.").length,
    ).toBeGreaterThan(0);
  });

  it("supports password update submission, validation errors, session revocation, and security activity display", async () => {
    const user = userEvent.setup();
    const updatePasswordAction = vi.fn(async () => ({
      ok: true as const,
      data: { revokedOtherSessions: 1 },
      message: "Password updated and 1 other active session(s) signed out.",
    }));
    const revokeSessionAction = vi.fn(async () => ({
      ok: true as const,
      data: { revoked: 1 },
      message: "Session revoked.",
    }));
    const revokeOtherSessionsAction = vi.fn(async () => ({
      ok: true as const,
      data: { revoked: 1 },
      message: "Signed out 1 other active session(s).",
    }));

    render(
      <UserSettingsView
        profile={sampleProfile}
        security={sampleSecurity}
        mailboxQuota={{ used: 4, max: 10 }}
        databaseConfigured={true}
        updateProfileAction={vi.fn()}
        updatePasswordAction={updatePasswordAction}
        revokeSessionAction={revokeSessionAction}
        revokeOtherSessionsAction={revokeOtherSessionsAction}
      />,
    );

    // Active sessions & recent security event visible
    expect(screen.getByText("Chrome · Linux")).toBeInTheDocument();
    expect(screen.getByText("Firefox · Windows")).toBeInTheDocument();
    expect(screen.getByText("Signed in")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: /Update password/i });
    expect(updateBtn).toBeDisabled();

    await user.type(
      screen.getByLabelText("Current password"),
      "demo-user-local-dev",
    );
    await user.type(
      screen.getByLabelText("New password"),
      "Strong!Pass2026",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "Strong!Pass2026",
    );

    expect(updateBtn).toBeEnabled();
    await user.click(updateBtn);

    expect(updatePasswordAction).toHaveBeenCalledWith({
      currentPassword: "demo-user-local-dev",
      newPassword: "Strong!Pass2026",
      confirmPassword: "Strong!Pass2026",
      revokeOtherSessions: true,
    });
    expect(mockNotify.success).toHaveBeenCalledWith(
      "Password updated and 1 other active session(s) signed out.",
    );

    // Test revoking a specific session and revoking all other sessions
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(revokeSessionAction).toHaveBeenCalledWith("sess-2");
    expect(mockNotify.success).toHaveBeenCalledWith("Session revoked.");

    await user.click(
      screen.getByRole("button", { name: /Sign out other sessions/i }),
    );
    expect(revokeOtherSessionsAction).toHaveBeenCalledTimes(1);
    expect(mockNotify.success).toHaveBeenCalledWith(
      "Signed out 1 other active session(s).",
    );
  });
});
