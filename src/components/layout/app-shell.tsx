"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { NotificationToaster } from "@/components/ui/notifications";
import { cn } from "@/lib/utils";
import {
  ArrowUpCircle,
  Globe,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  ScrollText,
  Settings,
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

export interface AppShellBranding {
  readonly siteName?: string;
  readonly siteTagline?: string;
  readonly logoUrl?: string;
  readonly statusLabel?: string;
  readonly statusDescription?: string;
}

export interface AppShellProps {
  readonly children: ReactNode;
  readonly user?: AppShellUser | null;
  readonly branding?: AppShellBranding;
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
  { href: "/vcon/settings", label: "Settings", icon: Settings },
  { href: "/vcon/system-update", label: "System update", icon: ArrowUpCircle },
] as const;

const menuButtonId = "workspace-menu-toggle";

export function AppShell({
  children,
  user,
  branding,
  signOutAction,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const firstNavigationRef = useRef<HTMLAnchorElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isAdministrator = user?.isAdministrator === true;

  const brandName = branding?.siteName?.trim() || "MailStack";
  const statusLabel = branding?.statusLabel?.trim() || "Workspace ready";

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
          "invisible fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform md:visible md:translate-x-0",
          mobileOpen ? "visible translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-12 items-center gap-2.5 border-b border-border px-3">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${brandName} logo`}
              referrerPolicy="no-referrer"
              className="size-7 shrink-0 rounded-none border border-border object-contain p-0.5"
            />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-none bg-primary text-primary-foreground">
              <Icon glyph={Inbox} />
            </span>
          )}
          <span className="truncate text-xs font-semibold text-foreground">
            {brandName}
          </span>
          <IconButton
            className="ml-auto md:hidden"
            label="Close navigation drawer"
            onClick={closeMobileNavigation}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>

        <div className="px-3 pb-1.5 pt-3 text-[11px] font-medium text-sidebar-muted">
          Workspaces
        </div>
        <nav aria-label="Workspace navigation" className="space-y-0.5 px-2">
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
                  "flex min-h-9 items-center gap-2.5 rounded-none px-2.5 text-xs font-medium transition-colors",
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
            <div className="px-3 pb-1.5 pt-4 text-[11px] font-medium text-sidebar-muted">
              Management
            </div>
            <nav aria-label="Management navigation" className="space-y-0.5 px-2">
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
                        "flex min-h-9 items-center gap-2.5 rounded-none px-2.5 text-xs font-medium transition-colors",
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

        <div className="mt-auto border-t border-border px-3 py-2.5">
          {user ? (
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-sidebar-foreground">
                {user.username}
              </span>
              <span className="shrink-0 text-[11px] text-sidebar-muted">
                {isAdministrator ? "Admin" : "User"}
              </span>
            </div>
          ) : null}
          <div className="text-[11px] text-sidebar-muted">{statusLabel}</div>
        </div>
      </aside>

      <div className="min-h-dvh md:pl-56">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2.5 border-b border-border bg-card px-3 md:px-4">
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
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Icon glyph={LayoutDashboard} />
            <span className="truncate font-medium text-foreground">
              {pathname.startsWith("/vcon") ? "Admin" : "Workspace"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">
                {user.username}
              </span>
            ) : null}
            <ThemeToggle />
            {signOutAction ? (
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="default">
                  <Icon glyph={LogOut} />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </form>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-3 md:p-4">{children}</main>
      </div>
      <NotificationToaster />
    </div>
  );
}
