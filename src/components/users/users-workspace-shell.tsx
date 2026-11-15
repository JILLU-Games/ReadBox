"use client";

import { Button, Icon, Input, Label, Select } from "@/components/ui";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import { UsersLiveProvider } from "@/components/users/live-mail-notifier";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import type { UserMailboxSummaryItem } from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellRing,
  Inbox,
  LayoutDashboard,
  Mail,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

export interface UsersWorkspaceShellProps {
  readonly mailboxes: readonly UserMailboxSummaryItem[];
  readonly domains: readonly MailboxCreationDomainOption[];
  readonly databaseConfigured: boolean;
  readonly createMailboxAction: (input: {
    readonly localPart: string;
    readonly domainUuid?: string;
  }) => Promise<
    MailboxActionResult<{
      uuid: string;
      emailAddress: string;
      localPart: string;
    }>
  >;
  readonly children: ReactNode;
}

export function UsersWorkspaceShell({
  mailboxes,
  domains,
  databaseConfigured,
  createMailboxAction,
  children,
}: UsersWorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [railFilter, setRailFilter] = useState("");

  const activeMailboxUuid = useMemo(() => {
    const match = pathname.match(/^\/users\/inbox\/([^/]+)/);
    return match?.[1] ?? "";
  }, [pathname]);

  const filteredMailboxes = useMemo(() => {
    const query = railFilter.trim().toLowerCase();
    if (!query) return mailboxes;
    return mailboxes.filter(
      (mbx) =>
        mbx.emailAddress.toLowerCase().includes(query) ||
        mbx.localPart.toLowerCase().includes(query),
    );
  }, [mailboxes, railFilter]);

  const visibleUuids = useMemo(
    () => mailboxes.slice(0, 50).map((m) => m.uuid),
    [mailboxes],
  );

  const isOverview = pathname === "/users";
  const isMailboxes = pathname === "/users/mailboxes";

  return (
    <UsersLiveProvider
      visibleMailboxUuids={visibleUuids}
      pollingEnabled={databaseConfigured}
      openCreateMailboxModal={() => setCreateOpen(true)}
    >
      {({ notificationPermission, handleEnableNotifications, syncDegraded }) => (
        <div className="border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
            <nav
              aria-label="User workspace navigation"
              className="flex flex-wrap items-center gap-1"
            >
              <Button
                asChild
                size="sm"
                variant={isOverview ? "default" : "ghost"}
              >
                <Link
                  href="/users"
                  aria-current={isOverview ? "page" : undefined}
                >
                  <Icon glyph={LayoutDashboard} />
                  Overview
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={isMailboxes ? "default" : "ghost"}
              >
                <Link
                  href="/users/mailboxes"
                  aria-current={isMailboxes ? "page" : undefined}
                >
                  <Icon glyph={Mail} />
                  Mailboxes
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!databaseConfigured}
                onClick={() => setCreateOpen(true)}
              >
                <Icon glyph={Plus} />
                Create mailbox
              </Button>
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              {mailboxes.length > 0 ? (
                <div className="lg:hidden">
                  <Label htmlFor="mobile-mailbox-jump" className="sr-only">
                    Switch mailbox
                  </Label>
                  <Select
                    id="mobile-mailbox-jump"
                    value={activeMailboxUuid}
                    onChange={(e) => {
                      const nextUuid = e.target.value;
                      if (nextUuid) {
                        router.push(`/users/inbox/${nextUuid}`);
                      } else {
                        router.push("/users/mailboxes");
                      }
                    }}
                    className="h-7 max-w-44 font-mono text-[11px]"
                  >
                    <option value="">Jump to mailbox...</option>
                    {mailboxes.map((mbx) => (
                      <option key={mbx.uuid} value={mbx.uuid}>
                        {mbx.emailAddress} ({mbx.unreadMessages})
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {notificationPermission === "default" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleEnableNotifications}
                >
                  <Icon glyph={Bell} />
                  Enable notifications
                </Button>
              ) : notificationPermission === "granted" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                  <Icon glyph={BellRing} />
                  Alerts on
                </span>
              ) : null}

              {syncDegraded ? (
                <span className="text-[11px] font-medium text-warning">
                  Live sync paused
                </span>
              ) : null}

              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Receive-only
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[210px_1fr]">
            <aside
              aria-label="Assigned mailboxes rail"
              className="hidden flex-col border-r border-border bg-sidebar lg:flex"
            >
              <div className="border-b border-border p-2">
                <Label htmlFor="mailbox-rail-filter" className="sr-only">
                  Filter mailboxes
                </Label>
                <Input
                  id="mailbox-rail-filter"
                  value={railFilter}
                  onChange={(e) => setRailFilter(e.target.value)}
                  placeholder="Filter mailboxes..."
                  className="h-7 text-[11px]"
                />
              </div>

              <div className="max-h-[calc(100dvh-10rem)] flex-1 overflow-y-auto divide-y divide-border">
                {filteredMailboxes.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">
                    No mailboxes
                  </div>
                ) : (
                  filteredMailboxes.map((mbx) => {
                    const selected = activeMailboxUuid === mbx.uuid;
                    const unread = Number(mbx.unreadMessages) || 0;
                    return (
                      <Link
                        key={mbx.uuid}
                        href={`/users/inbox/${mbx.uuid}`}
                        aria-current={selected ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between gap-2 px-2.5 py-2 text-xs transition-colors",
                          selected
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Icon
                            glyph={Inbox}
                            className="size-3.5 shrink-0 text-muted-foreground"
                          />
                          <span className="truncate font-mono text-[11px]">
                            {mbx.emailAddress}
                          </span>
                        </span>
                        {unread > 0 ? (
                          <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-primary">
                            {unread}
                          </span>
                        ) : (
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                            {mbx.totalMessages}
                          </span>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </aside>

            <div className="min-w-0 bg-background p-3">{children}</div>
          </div>

          <CreateUserMailboxModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            domains={domains}
            createAction={createMailboxAction}
          />
        </div>
      )}
    </UsersLiveProvider>
  );
}
