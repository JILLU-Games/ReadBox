"use client";

import { Button, Icon } from "@/components/ui";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import { UsersLiveProvider } from "@/components/users/live-mail-notifier";
import type { UserAccessCapabilities } from "@/core/accounts/policy";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import type { UserMailboxSummaryItem } from "@/core/messages/service";
import { Bell, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export interface UsersWorkspaceShellProps {
  readonly mailboxes: readonly UserMailboxSummaryItem[];
  readonly domains: readonly MailboxCreationDomainOption[];
  readonly capabilities?: UserAccessCapabilities;
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
  capabilities,
  databaseConfigured,
  createMailboxAction,
  children,
}: UsersWorkspaceShellProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const visibleUuids = useMemo(
    () => mailboxes.slice(0, 50).map((m) => m.uuid),
    [mailboxes],
  );

  const maxMailboxes = capabilities?.maxMailboxes ?? 0;
  const canCreate =
    capabilities?.canCreateMailboxes !== false &&
    (maxMailboxes <= 0 || mailboxes.length < maxMailboxes);

  return (
    <UsersLiveProvider
      visibleMailboxUuids={visibleUuids}
      pollingEnabled={databaseConfigured}
      openCreateMailboxModal={() => {
        if (canCreate) setCreateOpen(true);
      }}
    >
      {({ notificationPermission, handleEnableNotifications }) => (
        <div className="border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!databaseConfigured || !canCreate}
                onClick={() => setCreateOpen(true)}
              >
                <Icon glyph={Plus} />
                Create mailbox
              </Button>
            </div>

            {notificationPermission === "default" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleEnableNotifications}
                >
                  <Icon glyph={Bell} />
                  Enable notifications
                </Button>
              </div>
            ) : null}
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
