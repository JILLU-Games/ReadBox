"use client";

import { Button, Icon, notify } from "@/components/ui";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import { UsersLiveProvider } from "@/components/users/live-mail-notifier";
import type { UserAccessCapabilities } from "@/core/accounts/policy";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import type { UserMailboxSummaryItem } from "@/core/messages/service";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

export interface UsersWorkspaceShellProps {
  readonly mailboxes: readonly UserMailboxSummaryItem[];
  readonly totalMailboxCount?: number;
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
  totalMailboxCount,
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

  const effectiveMailboxCount = totalMailboxCount ?? mailboxes.length;
  const maxMailboxes = capabilities?.maxMailboxes ?? 0;
  const canCreate =
    capabilities?.canCreateMailboxes !== false &&
    (maxMailboxes <= 0 || effectiveMailboxCount < maxMailboxes);

  const openCreateModal = useCallback(() => {
    if (canCreate) {
      setCreateOpen(true);
      return;
    }

    const message =
      capabilities?.canCreateMailboxes === false
        ? "Mailbox creation is disabled for your account by User Control policy."
        : `Mailbox limit reached (${effectiveMailboxCount}/${maxMailboxes}). Contact an administrator to increase your quota.`;
    notify.error(message);
  }, [
    canCreate,
    capabilities?.canCreateMailboxes,
    effectiveMailboxCount,
    maxMailboxes,
  ]);

  useEffect(() => {
    function handleOpenCreateMailbox() {
      openCreateModal();
    }
    window.addEventListener(
      "readbox:open-create-mailbox",
      handleOpenCreateMailbox,
    );
    return () =>
      window.removeEventListener(
        "readbox:open-create-mailbox",
        handleOpenCreateMailbox,
      );
  }, [openCreateModal]);

  return (
    <UsersLiveProvider
      visibleMailboxUuids={visibleUuids}
      pollingEnabled={databaseConfigured}
      openCreateMailboxModal={openCreateModal}
    >
      {({ notificationPermission, handleEnableNotifications }) => (
        <div className="border border-border bg-card">
          {notificationPermission === "default" ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border bg-card px-3 py-1.5">
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
