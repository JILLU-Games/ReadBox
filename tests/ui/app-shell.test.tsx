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

  it("hides admin navigation from non-administrators and omitted user state", () => {
    render(<AppShell user={regularUser}>Workspace content</AppShell>);

    expect(screen.getByRole("link", { name: "User panel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Management navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("inbox.user").length).toBeGreaterThan(0);

    cleanup();
    render(<AppShell>Default unprivileged shell</AppShell>);
    expect(
      screen.queryByRole("link", { name: "Admin panel" }),
    ).not.toBeInTheDocument();
  });

  it("shows management navigation and sign-out control for administrators", () => {
    const signOut = vi.fn(async () => undefined);
    render(
      <AppShell user={adminUser} signOutAction={signOut}>
        Workspace content
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "User panel" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Admin panel" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Domains" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mailboxes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Operations" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Audit & security" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "System update" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Management navigation" }),
    ).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "User panel" })).toHaveFocus();

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
    const firstLink = screen.getByRole("link", { name: "User panel" });
    const adminLink = screen.getByRole("link", { name: "Admin panel" });
    const domainsLink = screen.getByRole("link", { name: "Domains" });
    const mailboxesLink = screen.getByRole("link", { name: "Mailboxes" });
    const usersLink = screen.getByRole("link", { name: "Users" });
    const operationsLink = screen.getByRole("link", { name: "Operations" });
    const auditLink = screen.getByRole("link", { name: "Audit & security" });
    const settingsLink = screen.getByRole("link", { name: "Settings" });
    const lastLink = screen.getByRole("link", { name: "System update" });
    const closeButton = screen.getByRole("button", {
      name: "Close navigation drawer",
    });

    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(firstLink).toHaveFocus();

    await user.tab();
    expect(adminLink).toHaveFocus();
    await user.tab();
    expect(domainsLink).toHaveFocus();
    await user.tab();
    expect(mailboxesLink).toHaveFocus();
    await user.tab();
    expect(usersLink).toHaveFocus();
    await user.tab();
    expect(operationsLink).toHaveFocus();
    await user.tab();
    expect(auditLink).toHaveFocus();
    await user.tab();
    expect(settingsLink).toHaveFocus();
    await user.tab();
    expect(lastLink).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab();
    expect(firstLink).toHaveFocus();
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
    const firstLink = screen.getByRole("link", { name: "User panel" });

    act(() => {
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent),
      );
    });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(drawer).not.toHaveAttribute("role", "dialog");
    expect(firstLink).toHaveFocus();

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
    const activeLink = screen.getByRole("link", { name: "User panel" });
    activeLink.focus();
    await user.click(activeLink);

    expect(toggle).not.toHaveFocus();
  });
});
