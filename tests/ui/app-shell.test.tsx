import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/users" }));
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => null,
}));
vi.mock("@/components/ui/notifications", () => ({
  NotificationToaster: () => null,
}));

import { AppShell } from "@/components/layout/app-shell";

const adminUser = { username: "admin.operator", isAdministrator: true };
const regularUser = { username: "inbox.user", isAdministrator: false };
const sampleMailboxes = [
  {
    uuid: "11111111-2222-4333-8444-555555555555",
    emailAddress: "alice@mailstack.local",
    unreadMessages: "2",
    totalMessages: "5",
  },
];

describe("AppShell navigation, role gating, and sign-out", () => {
  beforeEach(() => {
    const mediaQuery = {
      matches: false,
      media: "(min-width: 48rem)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", () => mediaQuery);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("replaces legacy User panel link with compact Users navigation and hides admin navigation from regular users", () => {
    render(
      <AppShell user={regularUser} mailboxes={sampleMailboxes}>
        Workspace content
      </AppShell>,
    );

    expect(
      screen.queryByRole("link", { name: "User panel" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(screen.getByRole("link", { name: "My mailboxes" })).toHaveAttribute(
      "href",
      "/users/mailboxes",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/users/settings",
    );

    const openSpy = vi.fn();
    window.addEventListener("readbox:open-create-mailbox", openSpy);
    const addMailboxBtn = screen.getByRole("button", { name: /Add mailbox/i });
    expect(addMailboxBtn).toBeInTheDocument();
    addMailboxBtn.click();
    expect(openSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("readbox:open-create-mailbox", openSpy);

    expect(
      screen.getByRole("link", { name: /alice@mailstack\.local/i }),
    ).toHaveAttribute(
      "href",
      "/users/inbox/11111111-2222-4333-8444-555555555555",
    );
    expect(
      screen.queryByRole("link", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Management navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Backup" })).not.toBeInTheDocument();
    expect(screen.getAllByText("inbox.user").length).toBeGreaterThan(0);

    cleanup();
    render(<AppShell>Default unprivileged shell</AppShell>);
    expect(
      screen.queryByRole("link", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
  });

  it("shows grouped Management dropdown navigation and opens related sub-menus on group click for administrators", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn(async () => undefined);
    render(
      <AppShell user={adminUser} signOutAction={signOut}>
        Workspace content
      </AppShell>,
    );

    expect(
      screen.queryByRole("link", { name: "User panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Workspace navigation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Management navigation" }),
    ).toBeInTheDocument();

    const overviewGroupBtn = screen.getByRole("button", {
      name: /Overview & Ops/i,
    });
    const mailGroupBtn = screen.getByRole("button", {
      name: /Mail & Domains/i,
    });
    const usersGroupBtn = screen.getByRole("button", {
      name: /Users & Security/i,
    });
    const systemGroupBtn = screen.getByRole("button", {
      name: /System & Settings/i,
    });

    // Overview & Ops group is open by default
    expect(overviewGroupBtn).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: "Admin panel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Operations" }),
    ).toBeInTheDocument();

    // Other groups start collapsed and open when clicked
    expect(mailGroupBtn).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Domains" }),
    ).not.toBeInTheDocument();
    await user.click(mailGroupBtn);
    expect(mailGroupBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Domains" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mailboxes" })).toBeInTheDocument();

    expect(usersGroupBtn).toHaveAttribute("aria-expanded", "false");
    await user.click(usersGroupBtn);
    expect(usersGroupBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      "/vcon/users",
    );
    expect(
      screen.getByRole("link", { name: "Users control" }),
    ).toHaveAttribute("href", "/vcon/users/control");
    expect(
      screen.getByRole("link", { name: "Audit & security" }),
    ).toHaveAttribute("href", "/vcon/audit");
    expect(
      screen.getByRole("link", { name: "Contact inquiries" }),
    ).toHaveAttribute("href", "/vcon/inquiries");

    expect(systemGroupBtn).toHaveAttribute("aria-expanded", "false");
    await user.click(systemGroupBtn);
    expect(systemGroupBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "System update" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Backup" })).toHaveAttribute(
      "href",
      "/vcon/backup",
    );

    expect(
      screen.getByRole("button", { name: /Sign out/i }),
    ).toBeInTheDocument();
  });

  it("visually hides the closed drawer and exposes disclosure state", () => {
    render(<AppShell user={adminUser}>Workspace content</AppShell>);

    const drawer = document.getElementById("workspace-sidebar");
    const toggle = screen.getByRole("button", { name: "Open navigation" });

    expect(drawer).toHaveClass("invisible", "md:visible");
    expect(toggle).toHaveAttribute("aria-controls", "workspace-sidebar");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("moves focus into the opened drawer and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<AppShell user={adminUser}>Workspace content</AppShell>);

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: /Overview & Ops/i }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    expect(document.getElementById("workspace-sidebar")).toHaveClass("invisible");
  });

  it("contains keyboard focus inside the open navigation drawer", async () => {
    const user = userEvent.setup();
    render(<AppShell user={adminUser}>Workspace content</AppShell>);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = screen.getByRole("dialog", { name: "Workspace navigation" });
    const firstGroupBtn = screen.getByRole("button", {
      name: /Overview & Ops/i,
    });
    const adminLink = screen.getByRole("link", { name: "Admin panel" });
    const operationsLink = screen.getByRole("link", { name: "Operations" });
    const mailGroupBtn = screen.getByRole("button", {
      name: /Mail & Domains/i,
    });
    const usersGroupBtn = screen.getByRole("button", {
      name: /Users & Security/i,
    });
    const systemGroupBtn = screen.getByRole("button", {
      name: /System & Settings/i,
    });
    const closeButton = screen.getByRole("button", {
      name: "Close navigation drawer",
    });

    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(firstGroupBtn).toHaveFocus();

    await user.tab();
    expect(adminLink).toHaveFocus();
    await user.tab();
    expect(operationsLink).toHaveFocus();
    await user.tab();
    expect(mailGroupBtn).toHaveFocus();
    await user.tab();
    expect(usersGroupBtn).toHaveFocus();
    await user.tab();
    expect(systemGroupBtn).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab();
    expect(firstGroupBtn).toHaveFocus();
    await user.tab({ shift: true });
    expect(closeButton).toHaveFocus();
  });

  it("closes the modal on desktop and restores focus before the drawer hides", async () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      matches: false,
      media: "(min-width: 48rem)",
      addEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.add(listener);
      },
      removeEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        listeners.delete(listener);
      },
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", () => mediaQuery);

    const user = userEvent.setup();
    render(<AppShell user={adminUser}>Workspace content</AppShell>);

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    await user.click(toggle);
    const drawer = screen.getByRole("dialog", { name: "Workspace navigation" });
    const firstGroupBtn = screen.getByRole("button", {
      name: /Overview & Ops/i,
    });

    act(() => {
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent),
      );
    });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(drawer).not.toHaveAttribute("role", "dialog");
    expect(firstGroupBtn).toHaveFocus();

    act(() => {
      listeners.forEach((listener) =>
        listener({ matches: false } as MediaQueryListEvent),
      );
    });

    expect(toggle).toHaveFocus();
  });

  it("returns focus to the menu trigger when its close control is activated", async () => {
    const user = userEvent.setup();
    render(<AppShell user={adminUser}>Workspace content</AppShell>);

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    await user.click(toggle);
    await user.click(
      screen.getByRole("button", { name: "Close navigation drawer" }),
    );

    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("does not focus the hidden mobile trigger when navigating from the desktop drawer", async () => {
    const user = userEvent.setup();
    render(<AppShell user={adminUser}>Workspace content</AppShell>);

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    const activeLink = screen.getByRole("link", { name: "Admin panel" });
    activeLink.focus();
    await user.click(activeLink);

    expect(toggle).not.toHaveFocus();
  });

  it("renders User Workspace sidebar and header Admin panel switcher when an administrator visits /users with mailboxes, and updates counts on live events", () => {
    render(
      <AppShell user={adminUser} mailboxes={sampleMailboxes}>
        User workspace content for admin
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(screen.getByRole("link", { name: "My mailboxes" })).toHaveAttribute(
      "href",
      "/users/mailboxes",
    );
    expect(screen.getByRole("button", { name: /Add mailbox/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin panel" })).toHaveAttribute(
      "href",
      "/vcon",
    );

    const inboxLink = screen.getByRole("link", {
      name: /alice@mailstack\.local/i,
    });
    expect(inboxLink).toHaveTextContent("2");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("readbox:live-mailboxes-updated", {
          detail: [
            {
              uuid: "11111111-2222-4333-8444-555555555555",
              unread_messages: 7,
              total_messages: 12,
            },
          ],
        }),
      );
    });

    expect(inboxLink).toHaveTextContent("7");
  });
});
