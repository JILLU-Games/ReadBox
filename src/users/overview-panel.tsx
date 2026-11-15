"use client";

import {
  AlertBanner,
  Badge,
  Button,
  CopyButton,
  Icon,
  PageTitle,
  Panel,
  PanelHeader,
  SectionTitle,
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

  return (
    <div className="space-y-3">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={visibleMailboxUuids}
        pollingEnabled={snapshot.databaseConfigured}
        onLivePayload={handleLivePayload}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2">
        <PageTitle>Inbox &amp; Mailbox Workspace</PageTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/users/mailboxes">
              <Icon glyph={Mail} />
              My mailboxes
            </Link>
          </Button>
          {createMailboxAction ? (
            <Button
              type="button"
              onClick={() =>
                usesShellModal
                  ? liveContext.openCreateMailboxModal?.()
                  : setCreateOpen(true)
              }
              disabled={!snapshot.databaseConfigured}
            >
              <Icon glyph={Plus} />
              Create mailbox
            </Button>
          ) : null}
        </div>
      </div>

      {!snapshot.databaseConfigured ? (
        <AlertBanner variant="warning">
          Database connection is not configured.
        </AlertBanner>
      ) : null}

      <section
        aria-label="Workspace mailbox and message summary"
        className="grid grid-cols-2 border border-border bg-card sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-border"
      >
        <div className="px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Mailboxes</span>
          <p
            data-testid="summary-total-mailboxes"
            className="mt-0.5 text-lg font-medium tabular-nums text-foreground"
          >
            {liveSummary.totalMailboxes}
          </p>
        </div>
        <div className="px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Active</span>
          <p
            data-testid="summary-active-mailboxes"
            className="mt-0.5 text-lg font-medium tabular-nums text-success"
          >
            {liveSummary.activeMailboxes}
          </p>
        </div>
        <div className="px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Disabled</span>
          <p
            data-testid="summary-disabled-mailboxes"
            className="mt-0.5 text-lg font-medium tabular-nums text-muted-foreground"
          >
            {liveSummary.disabledMailboxes}
          </p>
        </div>
        <div className="px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Messages</span>
          <p
            data-testid="summary-total-messages"
            className="mt-0.5 text-lg font-medium tabular-nums text-foreground"
          >
            {liveSummary.totalMessages}
          </p>
        </div>
        <div className="px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Unread</span>
          <p
            data-testid="summary-total-unread"
            className="mt-0.5 text-lg font-medium tabular-nums text-primary"
          >
            {liveSummary.totalUnread}
          </p>
        </div>
        <div className="px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            Last received
          </span>
          <p
            data-testid="summary-last-received"
            className="mt-1 truncate font-mono text-xs tabular-nums text-foreground"
          >
            {formatCompactTimestamp(liveSummary.lastReceivedAt, "No email yet")}
          </p>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-1.5">
              <Icon glyph={MailOpen} className="text-muted-foreground" />
              <SectionTitle>Recently received</SectionTitle>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {snapshot.recentMessages.length}
            </span>
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
                    !msg.isRead && "bg-accent/50",
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
                            !msg.isRead ? "font-semibold" : "font-normal",
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
                      <p className="truncate text-[11px] text-muted-foreground">
                        {msg.senderAddress || msg.senderName || "Unknown"} ·{" "}
                        <span className="font-mono">{msg.mailboxEmail}</span>
                      </p>
                    </div>
                  </div>
                  <time className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatShortInboxDate(msg.receivedAt, "—")}
                  </time>
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-1.5">
              <Icon glyph={Mail} className="text-muted-foreground" />
              <SectionTitle>Assigned mailboxes</SectionTitle>
            </div>
            <Link
              href="/users/mailboxes"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <Icon glyph={ArrowRight} className="size-3" />
            </Link>
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
                      <div className="flex items-center gap-2">
                        <CopyButton
                          value={mailbox.emailAddress}
                          title="Copy email address"
                          successMessage={`Copied ${mailbox.emailAddress}`}
                          errorMessage="Unable to copy address."
                          className="max-w-full font-mono"
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
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {mailbox.totalMessages}{" "}
                        {totalNum === 1 ? "message" : "messages"} ·{" "}
                        <span className="font-medium text-foreground">
                          {mailbox.unreadMessages} unread
                        </span>
                      </p>
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
