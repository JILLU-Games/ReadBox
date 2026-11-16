"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NavLink } from "@/components/ui/nav-link";
import { NotificationToaster } from "@/components/ui/notifications";
import { CaptionText } from "@/components/ui/text";
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
  SlidersHorizontal,
  Users,
  Wrench,
  X,
} from "lucide-react";
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
      {
        href: "/vcon/users/control",
        label: "Users control",
        icon: SlidersHorizontal,
      },
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
  if (href === "/vcon") return pathname === "/vcon";
  if (href === "/vcon/users") {
    return (
      pathname === "/vcon/users" ||
      (pathname.startsWith("/vcon/users/") &&
        !pathname.startsWith("/vcon/users/control"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const sidebarRef = useRef<HTMLElement>(null);
  const isAdministrator = user?.isAdministrator === true;
  const isAdminRoute = pathname.startsWith("/vcon");

  const [liveBrandingOverride, setLiveBrandingOverride] =
    useState<AppShellBranding | null>(null);

  useEffect(() => {
    function handleBrandingUpdated(event: Event) {
      const detail = (
        event as CustomEvent<{
          siteName?: string;
          siteTagline?: string;
          logoUrl?: string;
        }>
      ).detail;
      if (detail) {
        setLiveBrandingOverride({
          siteName: detail.siteName,
          siteTagline: detail.siteTagline,
          logoUrl: detail.logoUrl,
        });
      }
    }
    window.addEventListener(
      "readbox:site-settings-updated",
      handleBrandingUpdated,
    );
    return () =>
      window.removeEventListener(
        "readbox:site-settings-updated",
        handleBrandingUpdated,
      );
  }, []);

  const effectiveBranding = liveBrandingOverride ?? branding;
  const brandName = effectiveBranding?.siteName?.trim() || "ReadBox";

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

    sidebarRef.current
      ?.querySelector<HTMLElement>('[data-drawer-initial-focus="true"]')
      ?.focus();
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
        <Button
          type="button"
          variant="ghost"
          className="fixed inset-0 z-40 h-auto w-auto bg-overlay p-0 hover:bg-overlay md:hidden"
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
          <BrandLogo
            siteName={brandName}
            logoUrl={effectiveBranding?.logoUrl}
            size="md"
            fallbackIcon={Inbox}
            className="min-w-0 flex-1"
          />
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
              <div className="px-3 pb-1.5 pt-3">
                <CaptionText className="font-medium text-sidebar-muted">
                  Management
                </CaptionText>
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
                      <Button
                        data-drawer-initial-focus={
                          groupIndex === 0 ? "true" : undefined
                        }
                        type="button"
                        variant="ghost"
                        aria-expanded={open}
                        aria-controls={submenuId}
                        onClick={() => toggleGroup(group.id)}
                        className={cn(
                          "h-auto min-h-8 w-full justify-between gap-2 px-2.5 text-left",
                          hasActiveChild
                            ? "text-sidebar-foreground"
                            : "text-sidebar-muted hover:text-sidebar-foreground",
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
                      </Button>

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
                                <NavLink
                                  key={href}
                                  href={href}
                                  variant="sidebarSub"
                                  active={active}
                                  onClick={closeMobileNavigation}
                                >
                                  <Icon
                                    glyph={NavigationIcon}
                                    className="size-3.5 shrink-0"
                                  />
                                  <span className="truncate">{label}</span>
                                </NavLink>
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
              <div className="px-3 pb-1.5 pt-3">
                <CaptionText className="font-medium text-sidebar-muted">
                  Workspaces
                </CaptionText>
              </div>
              <nav aria-label="Workspace navigation" className="space-y-0.5 px-2">
                {workspaceNavigation.map(({ href, label, icon: NavigationIcon }) => {
                  const active =
                    href === "/users"
                      ? pathname === "/users"
                      : pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <NavLink
                      key={href}
                      data-drawer-initial-focus={
                        href === "/users" ? "true" : undefined
                      }
                      href={href}
                      variant="sidebar"
                      active={active}
                      onClick={closeMobileNavigation}
                      className="gap-2.5"
                    >
                      <Icon glyph={NavigationIcon} />
                      {label}
                    </NavLink>
                  );
                })}
              </nav>

              {!isAdminRoute && mailboxes.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-3 pb-1.5 pt-4">
                    <CaptionText className="font-medium text-sidebar-muted">
                      Inboxes
                    </CaptionText>
                    <CaptionText className="font-mono text-sidebar-muted tabular-nums">
                      {mailboxes.length}
                    </CaptionText>
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
                        className="h-7 text-xs"
                      />
                    </div>
                  ) : null}
                  <nav aria-label="Assigned inboxes" className="space-y-0.5 px-2">
                    {filteredMailboxes.length === 0 ? (
                      <p className="px-2.5 py-1.5">
                        <CaptionText className="text-sidebar-muted">
                          No matching inboxes
                        </CaptionText>
                      </p>
                    ) : (
                      filteredMailboxes.map((mbx) => {
                        const active = activeMailboxUuid === mbx.uuid;
                        const unread = Number(mbx.unreadMessages) || 0;
                        return (
                          <NavLink
                            key={mbx.uuid}
                            href={`/users/inbox/${mbx.uuid}`}
                            variant="sidebar"
                            active={active}
                            onClick={closeMobileNavigation}
                            className="justify-between font-normal"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon glyph={Inbox} className="size-3.5 shrink-0" />
                              <span className="truncate font-mono">
                                {mbx.emailAddress}
                              </span>
                            </span>
                            <CaptionText
                              className={cn(
                                "shrink-0 font-mono tabular-nums",
                                unread > 0
                                  ? "font-medium text-primary"
                                  : "text-sidebar-muted",
                              )}
                            >
                              {unread > 0 ? unread : mbx.totalMessages}
                            </CaptionText>
                          </NavLink>
                        );
                      })
                    )}
                  </nav>
                </>
              ) : null}
            </>
          )}
        </div>

        {user ? (
          <div className="mt-auto shrink-0 border-t border-border px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-sidebar-foreground">
                {user.username}
              </span>
            </div>
          </div>
        ) : null}
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
          {isAdminRoute ? (
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Icon glyph={ShieldCheck} />
              <span className="truncate font-medium text-foreground">
                Admin
              </span>
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
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
