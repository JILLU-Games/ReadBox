"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotificationToaster } from "@/components/ui/notifications";
import { cn } from "@/lib/utils";
import {
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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

export interface AppShellMailboxLink {
  readonly uuid: string;
  readonly emailAddress: string;
  readonly unreadMessages: string | number;
  readonly totalMessages: string | number;
}

export interface AppShellProps {
  readonly children: ReactNode;
  readonly user?: AppShellUser | null;
  readonly branding?: AppShellBranding;
  readonly mailboxes?: readonly AppShellMailboxLink[];
  readonly signOutAction?: () => Promise<void>;
}

const workspaceNavigation = [
  { href: "/users", label: "Overview", icon: LayoutDashboard },
  { href: "/users/mailboxes", label: "My mailboxes", icon: Mail },
] as const;

const managementGroups = [
  {
    id: "overview-ops",
    label: "Overview & Ops",
    icon: LayoutDashboard,
    items: [
      { href: "/vcon", label: "Admin panel", icon: ShieldCheck },
      { href: "/vcon/operations", label: "Operations", icon: Wrench },
    ],
  },
  {
    id: "mail-domains",
    label: "Mail & Domains",
    icon: Mail,
    items: [
      { href: "/vcon/domains", label: "Domains", icon: Globe },
      { href: "/vcon/mailboxes", label: "Mailboxes", icon: Inbox },
    ],
  },
  {
    id: "users-security",
    label: "Users & Security",
    icon: Users,
    items: [
      { href: "/vcon/users", label: "Users", icon: Users },
      { href: "/vcon/audit", label: "Audit & security", icon: ScrollText },
    ],
  },
  {
    id: "system-settings",
    label: "System & Settings",
    icon: Settings,
    items: [
      { href: "/vcon/settings", label: "Settings", icon: Settings },
      { href: "/vcon/system-update", label: "System update", icon: ArrowUpCircle },
    ],
  },
] as const;

const menuButtonId = "workspace-menu-toggle";

function isManagementItemActive(pathname: string, href: string): boolean {
  return href === "/vcon"
    ? pathname === "/vcon"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  user,
  branding,
  mailboxes = [],
  signOutAction,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mailboxFilter, setMailboxFilter] = useState("");
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({});
  const firstNavigationRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isAdministrator = user?.isAdministrator === true;
  const isAdminRoute = pathname.startsWith("/vcon");

  const brandName = branding?.siteName?.trim() || "MailStack";
  const statusLabel = branding?.statusLabel?.trim() || "Workspace ready";

  const activeAdminGroupId = useMemo(() => {
    const matched = managementGroups.find((group) =>
      group.items.some((item) => isManagementItemActive(pathname, item.href)),
    );
    return matched?.id ?? managementGroups[0].id;
  }, [pathname]);

  function isGroupOpen(groupId: string): boolean {
    if (groupId in toggledGroups) {
      return toggledGroups[groupId] === true;
    }
    return groupId === activeAdminGroupId;
  }

  function toggleGroup(groupId: string) {
    const nextOpen = !isGroupOpen(groupId);
    setToggledGroups((prev) => ({
      ...prev,
      [groupId]: nextOpen,
    }));
  }

  const activeMailboxUuid = useMemo(() => {
    const match = pathname.match(/^\/users\/inbox\/([^/]+)/);
    return match?.[1] ?? "";
  }, [pathname]);

  const filteredMailboxes = useMemo(() => {
    const query = mailboxFilter.trim().toLowerCase();
    if (!query) return mailboxes;
    return mailboxes.filter((mbx) =>
      mbx.emailAddress.toLowerCase().includes(query),
    );
  }, [mailboxes, mailboxFilter]);

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
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-3">
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
          <span className="truncate text-xs font-medium text-foreground">
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

        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          {isAdministrator ? (
            <>
              <div className="px-3 pb-1.5 pt-3 text-[11px] font-medium text-sidebar-muted">
                Management
              </div>
              <nav aria-label="Management navigation" className="space-y-1 px-2">
                {managementGroups.map((group, groupIndex) => {
                  const GroupIcon = group.icon;
                  const open = isGroupOpen(group.id);
                  const hasActiveChild = group.items.some((item) =>
                    isManagementItemActive(pathname, item.href),
                  );
                  const submenuId = `admin-nav-group-${group.id}`;

                  return (
                    <div key={group.id} className="space-y-0.5">
                      <button
                        ref={
                          groupIndex === 0
                            ? (node) => {
                                firstNavigationRef.current = node;
                              }
                            : undefined
                        }
                        type="button"
                        aria-expanded={open}
                        aria-controls={submenuId}
                        onClick={() => toggleGroup(group.id)}
                        className={cn(
                          "flex min-h-8 w-full items-center justify-between gap-2 rounded-none px-2.5 text-left text-xs font-medium transition-colors",
                          hasActiveChild
                            ? "text-sidebar-foreground"
                            : "text-sidebar-muted hover:bg-muted hover:text-sidebar-foreground",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon glyph={GroupIcon} />
                          <span className="truncate">{group.label}</span>
                        </span>
                        <Icon
                          glyph={open ? ChevronDown : ChevronRight}
                          className="size-3.5 shrink-0 text-sidebar-muted"
                        />
                      </button>

                      {open ? (
                        <div
                          id={submenuId}
                          className="ml-3.5 space-y-0.5 border-l border-border pl-2"
                        >
                          {group.items.map(
                            ({ href, label, icon: NavigationIcon }) => {
                              const active = isManagementItemActive(
                                pathname,
                                href,
                              );
                              return (
                                <Link
                                  key={href}
                                  href={href}
                                  aria-current={active ? "page" : undefined}
                                  onClick={closeMobileNavigation}
                                  className={cn(
                                    "flex min-h-7 items-center gap-2 rounded-none px-2 text-xs font-medium transition-colors",
                                    active
                                      ? "bg-sidebar-active text-sidebar-active-foreground"
                                      : "text-sidebar-muted hover:bg-muted hover:text-sidebar-foreground",
                                  )}
                                >
                                  <Icon
                                    glyph={NavigationIcon}
                                    className="size-3.5 shrink-0"
                                  />
                                  <span className="truncate">{label}</span>
                                </Link>
                              );
                            },
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            </>
          ) : (
            <>
              <div className="px-3 pb-1.5 pt-3 text-[11px] font-medium text-sidebar-muted">
                Workspaces
              </div>
              <nav aria-label="Workspace navigation" className="space-y-0.5 px-2">
                {workspaceNavigation.map(({ href, label, icon: NavigationIcon }) => {
                  const active =
                    href === "/users"
                      ? pathname === "/users"
                      : pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      ref={
                        href === "/users"
                          ? (node) => {
                              firstNavigationRef.current = node;
                            }
                          : undefined
                      }
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={closeMobileNavigation}
                      className={cn(
                        "flex min-h-8 items-center gap-2.5 rounded-none px-2.5 text-xs font-medium transition-colors",
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

              {!isAdminRoute && mailboxes.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-3 pb-1.5 pt-4 text-[11px] font-medium text-sidebar-muted">
                    <span>Inboxes</span>
                    <span className="font-mono text-[10px] tabular-nums">
                      {mailboxes.length}
                    </span>
                  </div>
                  {mailboxes.length > 5 ? (
                    <div className="px-2 pb-1.5">
                      <Label htmlFor="sidebar-inbox-filter" className="sr-only">
                        Filter inboxes
                      </Label>
                      <Input
                        id="sidebar-inbox-filter"
                        value={mailboxFilter}
                        onChange={(event) => setMailboxFilter(event.target.value)}
                        placeholder="Filter inboxes..."
                        className="h-7 text-[11px]"
                      />
                    </div>
                  ) : null}
                  <nav aria-label="Assigned inboxes" className="space-y-0.5 px-2">
                    {filteredMailboxes.length === 0 ? (
                      <p className="px-2.5 py-1.5 text-[11px] text-sidebar-muted">
                        No matching inboxes
                      </p>
                    ) : (
                      filteredMailboxes.map((mbx) => {
                        const active = activeMailboxUuid === mbx.uuid;
                        const unread = Number(mbx.unreadMessages) || 0;
                        return (
                          <Link
                            key={mbx.uuid}
                            href={`/users/inbox/${mbx.uuid}`}
                            aria-current={active ? "page" : undefined}
                            onClick={closeMobileNavigation}
                            className={cn(
                              "flex min-h-8 items-center justify-between gap-2 rounded-none px-2.5 text-[11px] transition-colors",
                              active
                                ? "bg-sidebar-active font-medium text-sidebar-active-foreground"
                                : "text-sidebar-muted hover:bg-muted hover:text-sidebar-foreground",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon glyph={Inbox} className="size-3.5 shrink-0" />
                              <span className="truncate font-mono">
                                {mbx.emailAddress}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 font-mono text-[10px] tabular-nums",
                                unread > 0
                                  ? "font-medium text-primary"
                                  : "text-sidebar-muted",
                              )}
                            >
                              {unread > 0 ? unread : mbx.totalMessages}
                            </span>
                          </Link>
                        );
                      })
                    )}
                  </nav>
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-auto shrink-0 border-t border-border px-3 py-2.5">
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
            <Icon glyph={isAdminRoute || isAdministrator ? ShieldCheck : LayoutDashboard} />
            <span className="truncate font-medium text-foreground">
              {isAdminRoute || isAdministrator ? "Admin" : "Workspace"}
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
