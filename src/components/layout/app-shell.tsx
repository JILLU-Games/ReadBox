"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { NotificationToaster } from "@/components/ui/notifications";
import { cn } from "@/lib/utils";
import {
  Globe,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  ScrollText,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface AppShellUser {
  readonly username: string;
  readonly isAdministrator: boolean;
}

export interface AppShellProps {
  readonly children: ReactNode;
  readonly user?: AppShellUser | null;
  readonly signOutAction?: () => Promise<void>;
}

const workspaceNavigation = [
  { href: "/users", label: "User panel", icon: Inbox },
] as const;

const managementNavigation = [
  { href: "/vcon", label: "Admin panel", icon: ShieldCheck },
  { href: "/vcon/domains", label: "Domains", icon: Globe },
  { href: "/vcon/mailboxes", label: "Mailboxes", icon: Mail },
  { href: "/vcon/users", label: "Users", icon: Users },
  { href: "/vcon/operations", label: "Operations", icon: Wrench },
  { href: "/vcon/audit", label: "Audit & security", icon: ScrollText },
] as const;

const menuButtonId = "workspace-menu-toggle";

export function AppShell({ children, user, signOutAction }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const firstNavigationRef = useRef<HTMLAnchorElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isAdministrator = user?.isAdministrator === true;

  useEffect(() => {
    if (!mobileOpen) return;

    firstNavigationRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        document.getElementById(menuButtonId)?.focus();
        return;
      }

      if (event.key !== "Tab") return;
      const sidebar = sidebarRef.current;
      const focusable = sidebar?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!sidebar || !focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusOutside = !sidebar.contains(document.activeElement);
      if (
        (event.shiftKey && (document.activeElement === first || focusOutside)) ||
        (!event.shiftKey && (document.activeElement === last || focusOutside))
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 48rem)");
    function handleViewportChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setMobileOpen(false);
      } else if (sidebarRef.current?.contains(document.activeElement)) {
        document.getElementById(menuButtonId)?.focus();
      }
    }

    desktopQuery.addEventListener("change", handleViewportChange);
    return () => desktopQuery.removeEventListener("change", handleViewportChange);
  }, []);

  function closeMobileNavigation() {
    setMobileOpen(false);
    if (mobileOpen) document.getElementById(menuButtonId)?.focus();
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-40 bg-overlay md:hidden"
          aria-label="Close navigation"
          onClick={closeMobileNavigation}
        />
      ) : null}
      <aside
        ref={sidebarRef}
        id="workspace-sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Workspace navigation" : undefined}
        className={cn(
          "invisible fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform md:visible md:translate-x-0",
          mobileOpen ? "visible translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Icon glyph={Inbox} />
          </span>
          <span className="text-sm font-semibold tracking-wide">MailStack</span>
          <IconButton
            className="ml-auto md:hidden"
            label="Close navigation drawer"
            onClick={closeMobileNavigation}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>
        <div className="px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
          Workspaces
        </div>
        <nav aria-label="Workspace navigation" className="space-y-1 px-3">
          {workspaceNavigation.map(({ href, label, icon: NavigationIcon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                ref={href === "/users" ? firstNavigationRef : undefined}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={closeMobileNavigation}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-active text-sidebar-active-foreground"
                    : "text-sidebar-muted hover:bg-muted hover:text-sidebar-foreground",
                )}
              >
                <Icon glyph={NavigationIcon} />
                {label}
              </Link>
            );
          })}
        </nav>
        {isAdministrator ? (
          <>
            <div className="px-4 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              Management
            </div>
            <nav aria-label="Management navigation" className="space-y-1 px-3">
              {managementNavigation.map(
                ({ href, label, icon: NavigationIcon }) => {
                  const active =
                    href === "/vcon"
                      ? pathname === "/vcon"
                      : pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={closeMobileNavigation}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-active text-sidebar-active-foreground"
                          : "text-sidebar-muted hover:bg-muted hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon glyph={NavigationIcon} />
                      {label}
                    </Link>
                  );
                },
              )}
            </nav>
          </>
        ) : null}
        <div className="mt-auto border-t border-border p-4">
          {user ? (
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-sidebar-foreground">
                {user.username}
              </span>
              <span className="shrink-0 text-sidebar-muted">
                {isAdministrator ? "Admin" : "User"}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-sidebar-muted">
            <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
            Foundation mode
          </div>
          <p className="mt-2 text-xs leading-5 text-sidebar-muted">Mail services are not connected.</p>
        </div>
      </aside>

      <div className="min-h-dvh md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:px-7">
          <IconButton
            id={menuButtonId}
            className="md:hidden"
            label={mobileOpen ? "Close navigation menu" : "Open navigation"}
            aria-controls="workspace-sidebar"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <Menu aria-hidden="true" />
          </IconButton>
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Icon glyph={LayoutDashboard} />
            <span className="truncate">{pathname.startsWith("/vcon") ? "Admin" : "Workspace"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">
                {user.username}
              </span>
            ) : (
              <span className="hidden text-xs text-muted-foreground sm:inline">Local foundation</span>
            )}
            <ThemeToggle />
            {signOutAction ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Icon glyph={LogOut} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-4 md:p-7">{children}</main>
      </div>
      <NotificationToaster />
    </div>
  );
}
