"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import { LiveWorkspaceNavigationBar } from "@/components/users/live-mail-notifier";
import type { MailboxActionResult } from "@/core/mailboxes/service";
import type {
  LiveUpdatePayload,
  UserWorkspaceOverviewSnapshot,
} from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Clock,
  Copy,
  Database,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  Plus,
  ShieldCheck,
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

function formatDateTime(value: string | null): string {
  if (!value) return "No email yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No email yet";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function UserOverview({
  snapshot = DEFAULT_SNAPSHOT,
  username,
  isAdministrator = false,
  createMailboxAction,
}: UserOverviewProps) {
  const [liveSummary, setLiveSummary] = useState<{
    totalMailboxes: number;
    activeMailboxes: number;
    disabledMailboxes: number;
    totalMessages: number;
    totalUnread: number;
    lastReceivedAt: string | null;
  }>({
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

  async function handleCopyEmail(emailAddress: string) {
    try {
      await navigator.clipboard?.writeText(emailAddress);
      notify.success(`Copied ${emailAddress}`);
    } catch {
      notify.error("Unable to copy address.");
    }
  }

  const visibleMailboxUuids = snapshot.recentMailboxes.map((m) => m.uuid);

  return (
    <div className="space-y-6">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={visibleMailboxUuids}
        pollingEnabled={snapshot.databaseConfigured}
        onLivePayload={handleLivePayload}
      />

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <Icon glyph={Inbox} />
              <span>User Workspace</span>
              {username ? (
                <span className="rounded bg-muted px-2 py-0.5 font-mono text-foreground">
                  {username}
                </span>
              ) : null}
              {isAdministrator ? (
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary">
                  <Icon glyph={ShieldCheck} className="size-3" />
                  Administrator scope
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Inbox & Mailbox Workspace
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Monitor assigned receive-only mailboxes, inspect sanitized HTML
              and plain-text messages, download confined attachments, and
              receive live delivery updates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/users/mailboxes"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
            >
              <Icon glyph={Mail} />
              My mailboxes
            </Link>
            {createMailboxAction ? (
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!snapshot.databaseConfigured}
              >
                <Icon glyph={Plus} />
                Create mailbox
              </Button>
            ) : null}
          </div>
        </div>

        {!snapshot.databaseConfigured ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-md border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-xs text-foreground">
            <Icon glyph={Database} className="text-warning" />
            <span>
              Database connection is not configured in this preview environment.
              Showing zero-state workspace telemetry.
            </span>
          </div>
        ) : null}
      </section>

      <section
        aria-label="Workspace mailbox and message summary"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
      >
        <article className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            Total mailboxes
          </span>
          <p
            data-testid="summary-total-mailboxes"
            className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
          >
            {liveSummary.totalMailboxes}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            Active
          </span>
          <p
            data-testid="summary-active-mailboxes"
            className="mt-2 text-2xl font-semibold tracking-tight text-success"
          >
            {liveSummary.activeMailboxes}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            Disabled
          </span>
          <p
            data-testid="summary-disabled-mailboxes"
            className="mt-2 text-2xl font-semibold tracking-tight text-muted-foreground"
          >
            {liveSummary.disabledMailboxes}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            Received emails
          </span>
          <p
            data-testid="summary-total-messages"
            className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
          >
            {liveSummary.totalMessages}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            Unread
          </span>
          <p
            data-testid="summary-total-unread"
            className="mt-2 text-2xl font-semibold tracking-tight text-primary"
          >
            {liveSummary.totalUnread}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">
            Last received
          </span>
          <p
            data-testid="summary-last-received"
            className="mt-2 truncate font-mono text-xs font-medium text-foreground"
          >
            {formatDateTime(liveSummary.lastReceivedAt)}
          </p>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Icon glyph={MailOpen} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Recently received
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Latest {snapshot.recentMessages.length}
            </span>
          </div>

          <div className="divide-y divide-border">
            {snapshot.recentMessages.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No messages have been indexed for your assigned mailboxes yet.
              </div>
            ) : (
              snapshot.recentMessages.map((msg) => (
                <Link
                  key={msg.uuid}
                  href={`/users/inbox/${msg.mailboxUuid}/${msg.uuid}`}
                  className={cn(
                    "flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50",
                    !msg.isRead && "bg-primary/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!msg.isRead ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread message"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "truncate text-sm text-foreground",
                          !msg.isRead ? "font-semibold" : "font-medium",
                        )}
                      >
                        {msg.subject || "(No subject)"}
                      </span>
                      {msg.hasAttachments ? (
                        <Icon
                          glyph={Paperclip}
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {msg.senderAddress || msg.senderName || "Unknown sender"}{" "}
                      ·{" "}
                      <span className="font-mono text-foreground/80">
                        {msg.mailboxEmail}
                      </span>
                    </p>
                    {msg.preview ? (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {msg.preview}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Icon glyph={Clock} className="size-3" />
                    <span>
                      {msg.receivedAt
                        ? msg.receivedAt.slice(0, 16).replace("T", " ")
                        : "Unknown"}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Icon glyph={Mail} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Assigned mailboxes
              </h2>
            </div>
            <Link
              href="/users/mailboxes"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <Icon glyph={ArrowRight} className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {snapshot.recentMailboxes.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No mailboxes are assigned to your workspace yet.
              </div>
            ) : (
              snapshot.recentMailboxes.map((mailbox) => (
                <div
                  key={mailbox.uuid}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyEmail(mailbox.emailAddress)}
                        className="inline-flex max-w-full items-center gap-1.5 truncate font-mono text-sm font-medium text-foreground hover:text-primary"
                        title="Copy email address"
                      >
                        <span className="truncate">{mailbox.emailAddress}</span>
                        <Icon glyph={Copy} className="size-3.5 shrink-0" />
                      </button>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium capitalize",
                          mailbox.status === "active"
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {mailbox.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span>{mailbox.totalMessages} messages</span> ·{" "}
                      <span className="font-medium text-foreground">
                        {mailbox.unreadMessages} unread
                      </span>
                    </p>
                  </div>

                  <Link
                    href={`/users/inbox/${mailbox.uuid}`}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Open inbox
                    <Icon glyph={ArrowRight} className="size-3.5" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {createMailboxAction ? (
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
