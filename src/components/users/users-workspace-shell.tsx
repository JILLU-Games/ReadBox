"use client";

import { Button, Icon } from "@/components/ui";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import { UsersLiveProvider } from "@/components/users/live-mail-notifier";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import type { UserMailboxSummaryItem } from "@/core/messages/service";
import { Bell, BellRing, Plus } from "lucide-react";
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
  const [createOpen, setCreateOpen] = useState(false);

  const visibleUuids = useMemo(
    () => mailboxes.slice(0, 50).map((m) => m.uuid),
    [mailboxes],
  );

  return (
    <UsersLiveProvider
      visibleMailboxUuids={visibleUuids}
      pollingEnabled={databaseConfigured}
      openCreateMailboxModal={() => setCreateOpen(true)}
    >
      {({ notificationPermission, handleEnableNotifications, syncDegraded }) => (
        <div className="border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
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
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {mailboxes.length}{" "}
                {mailboxes.length === 1 ? "inbox" : "inboxes"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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

          <div className="min-w-0 bg-background p-3">{children}</div>

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
