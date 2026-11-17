"use client";

import {
  AlertBanner,
  Badge,
  Button,
  CaptionText,
  CopyButton,
  Icon,
  PageHeader,
  Panel,
  PanelHeader,
  SectionTitle,
  StatCard,
  StatGrid,
} from "@/components/ui";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import {
  LiveWorkspaceNavigationBar,
  useUsersLiveUpdates,
} from "@/components/users/live-mail-notifier";
import {
  formatCompactTimestamp,
  formatShortInboxDate,
} from "@/components/users/user-workspace-helpers";
import type { MailboxActionResult } from "@/core/mailboxes/service";
import type {
  LiveUpdatePayload,
  UserWorkspaceOverviewSnapshot,
} from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Mail,
  MailOpen,
  Paperclip,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export interface UserOverviewProps {
  readonly snapshot?: UserWorkspaceOverviewSnapshot;
  readonly username?: string;
  readonly isAdministrator?: boolean;
  readonly createMailboxAction?: (input: {
    readonly localPart: string;
    readonly domainUuid?: string;
  }) => Promise<
    MailboxActionResult<{
      uuid: string;
      emailAddress: string;
      localPart: string;
    }>
  >;
}

const DEFAULT_SNAPSHOT: UserWorkspaceOverviewSnapshot = {
  databaseConfigured: false,
  totalMailboxes: 0,
  activeMailboxes: 0,
  disabledMailboxes: 0,
  totalMessages: 0,
  totalUnread: 0,
  lastReceivedAt: null,
  recentMessages: [],
  recentMailboxes: [],
  availableDomains: [],
  capabilities: {
    canDeleteMessages: false,
    canDeleteMailboxes: false,
  },
};

export function UserOverview({
  snapshot = DEFAULT_SNAPSHOT,
  createMailboxAction,
}: UserOverviewProps) {
  const liveContext = useUsersLiveUpdates();
  const usesShellModal = Boolean(
    liveContext.active && liveContext.openCreateMailboxModal,
  );
  const [liveSummary, setLiveSummary] = useState({
    totalMailboxes: snapshot.totalMailboxes,
    activeMailboxes: snapshot.activeMailboxes,
    disabledMailboxes: snapshot.disabledMailboxes,
    totalMessages: snapshot.totalMessages,
    totalUnread: snapshot.totalUnread,
    lastReceivedAt: snapshot.lastReceivedAt,
  });
  const [createOpen, setCreateOpen] = useState(false);

  function handleLivePayload(payload: LiveUpdatePayload) {
    setLiveSummary({
      totalMailboxes: payload.summary.total_mailboxes,
      activeMailboxes: payload.summary.active_mailboxes,
      disabledMailboxes: payload.summary.disabled_mailboxes,
      totalMessages: payload.summary.total_messages,
      totalUnread: payload.summary.total_unread,
      lastReceivedAt: payload.summary.last_received,
    });
  }

  const visibleMailboxUuids = snapshot.recentMailboxes.map((m) => m.uuid);
  const maxMailboxes = snapshot.capabilities.maxMailboxes ?? 0;
  const canCreate =
    snapshot.capabilities.canCreateMailboxes !== false &&
    (maxMailboxes <= 0 || liveSummary.totalMailboxes < maxMailboxes);

  return (
    <div className="space-y-3">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={visibleMailboxUuids}
        pollingEnabled={snapshot.databaseConfigured}
        onLivePayload={handleLivePayload}
      />

      <PageHeader
        title="Inbox & Mailbox Workspace"
        actions={
          createMailboxAction ? (
            <Button
              type="button"
              onClick={() =>
                usesShellModal
                  ? liveContext.openCreateMailboxModal?.()
                  : setCreateOpen(true)
              }
              disabled={!snapshot.databaseConfigured || !canCreate}
            >
              <Icon glyph={Plus} />
              Create mailbox
            </Button>
          ) : undefined
        }
      />

      {snapshot.databaseError ? (
        <AlertBanner
          variant="error"
          title="Database temporarily unavailable"
        >
          {snapshot.databaseError}
        </AlertBanner>
      ) : !snapshot.databaseConfigured ? (
        <AlertBanner variant="warning">
          Database connection is not configured.
        </AlertBanner>
      ) : null}

      <StatGrid aria-label="Workspace mailbox and message summary">
        <StatCard
          label="Mailboxes"
          value={liveSummary.totalMailboxes}
          testId="summary-total-mailboxes"
        />
        <StatCard
          label="Active"
          value={liveSummary.activeMailboxes}
          tone="success"
          testId="summary-active-mailboxes"
        />
        <StatCard
          label="Disabled"
          value={liveSummary.disabledMailboxes}
          tone="muted"
          testId="summary-disabled-mailboxes"
        />
        <StatCard
          label="Messages"
          value={liveSummary.totalMessages}
          testId="summary-total-messages"
        />
        <StatCard
          label="Unread"
          value={liveSummary.totalUnread}
          tone="primary"
          testId="summary-total-unread"
        />
        <StatCard
          label="Last received"
          value={formatCompactTimestamp(
            liveSummary.lastReceivedAt,
            "No email yet",
          )}
          compact
          testId="summary-last-received"
        />
      </StatGrid>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <Panel className="min-w-0">
          <PanelHeader>
            <div className="flex items-center gap-1.5">
              <Icon glyph={MailOpen} className="text-muted-foreground" />
              <SectionTitle>Recently received</SectionTitle>
            </div>
            <CaptionText className="font-mono tabular-nums">
              {snapshot.recentMessages.length}
            </CaptionText>
          </PanelHeader>

          <div className="divide-y divide-border">
            {snapshot.recentMessages.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No messages received yet.
              </div>
            ) : (
              snapshot.recentMessages.map((msg) => (
                <Link
                  key={msg.uuid}
                  href={`/users/inbox/${msg.mailboxUuid}/${msg.uuid}`}
                  className={cn(
                    "flex items-start justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted",
                    !msg.isRead && "bg-accent",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0",
                        msg.isRead ? "bg-transparent" : "bg-primary",
                      )}
                      aria-label={msg.isRead ? "Read" : "Unread"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "truncate text-xs text-foreground",
                            !msg.isRead ? "font-medium" : "font-normal",
                          )}
                        >
                          {msg.subject || "(No subject)"}
                        </span>
                        {msg.hasAttachments ? (
                          <Icon
                            glyph={Paperclip}
                            className="size-3 shrink-0 text-muted-foreground"
                          />
                        ) : null}
                      </div>
                      <CaptionText className="block truncate">
                        {msg.senderAddress || msg.senderName || "Unknown"} ·{" "}
                        <span className="font-mono">{msg.mailboxEmail}</span>
                      </CaptionText>
                    </div>
                  </div>
                  <CaptionText className="shrink-0 font-mono tabular-nums">
                    <time dateTime={msg.receivedAt ?? undefined}>
                      {formatShortInboxDate(msg.receivedAt, "—")}
                    </time>
                  </CaptionText>
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel className="min-w-0">
          <PanelHeader>
            <div className="flex items-center gap-1.5">
              <Icon glyph={Mail} className="text-muted-foreground" />
              <SectionTitle>Assigned mailboxes</SectionTitle>
            </div>
            <Button
              asChild
              size="xs"
              variant="ghost"
              className="text-primary hover:text-primary"
            >
              <Link href="/users/mailboxes">
                View all
                <Icon glyph={ArrowRight} className="size-3" />
              </Link>
            </Button>
          </PanelHeader>

          <div className="divide-y divide-border">
            {snapshot.recentMailboxes.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No mailboxes assigned yet.
              </div>
            ) : (
              snapshot.recentMailboxes.map((mailbox) => {
                const totalNum = Number(mailbox.totalMessages) || 0;
                return (
                  <div
                    key={mailbox.uuid}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <CopyButton
                          value={mailbox.emailAddress}
                          title="Copy email address"
                          successMessage={`Copied ${mailbox.emailAddress}`}
                          errorMessage="Unable to copy address."
                          className="min-w-0 max-w-full font-mono"
                        >
                          <span className="truncate">{mailbox.emailAddress}</span>
                        </CopyButton>
                        <Badge
                          variant={
                            mailbox.status === "active" ? "success" : "default"
                          }
                        >
                          {mailbox.status}
                        </Badge>
                      </div>
                      <CaptionText className="mt-0.5 block tabular-nums">
                        {mailbox.totalMessages}{" "}
                        {totalNum === 1 ? "message" : "messages"} ·{" "}
                        <span className="font-medium text-foreground">
                          {mailbox.unreadMessages} unread
                        </span>
                      </CaptionText>
                    </div>

                    <Button asChild size="sm" variant="outline">
                      <Link href={`/users/inbox/${mailbox.uuid}`}>
                        Open inbox
                        <Icon glyph={ArrowRight} className="size-3" />
                      </Link>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      {createMailboxAction && !usesShellModal ? (
        <CreateUserMailboxModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          domains={snapshot.availableDomains}
          createAction={createMailboxAction}
        />
      ) : null}
    </div>
  );
}
