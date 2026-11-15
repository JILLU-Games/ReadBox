"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import { LiveWorkspaceNavigationBar } from "@/components/users/live-mail-notifier";
import type {
  LiveUpdatePayload,
  UserInboxListResult,
} from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  Copy,
  Mail,
  Paperclip,
  RotateCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export interface MailboxInboxViewProps {
  readonly inboxResult: UserInboxListResult;
}

export function formatMessageByteSize(bytes: number): string {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function MailboxInboxView({ inboxResult }: MailboxInboxViewProps) {
  const { mailbox } = inboxResult;
  const [liveCounts, setLiveCounts] = useState<{
    totalMessages: number;
    unreadMessages: number;
    status: string;
  }>({
    totalMessages: mailbox.totalMessages,
    unreadMessages: mailbox.unreadMessages,
    status: mailbox.status,
  });

  function handleLivePayload(payload: LiveUpdatePayload) {
    const matched = payload.mailboxes?.find((m) => m.uuid === mailbox.uuid);
    if (matched) {
      setLiveCounts({
        totalMessages: matched.total_messages,
        unreadMessages: matched.unread_messages,
        status: matched.status,
      });
    }
  }

  async function handleCopyEmail(emailAddress: string) {
    try {
      await navigator.clipboard?.writeText(emailAddress);
      notify.success(`Copied ${emailAddress}`);
    } catch {
      notify.error("Unable to copy address.");
    }
  }

  const hasFilters =
    inboxResult.query.length > 0 ||
    inboxResult.readFilter !== "all" ||
    inboxResult.attachmentFilter !== "all";

  return (
    <div className="space-y-6">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={[mailbox.uuid]}
        pollingEnabled={true}
        onLivePayload={handleLivePayload}
      />

      <section
        aria-labelledby="mailbox-inbox-title"
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/users/mailboxes"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon glyph={ArrowLeft} className="size-3.5" />
              All mailboxes
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <h1
                id="mailbox-inbox-title"
                className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                <button
                  type="button"
                  onClick={() => handleCopyEmail(mailbox.emailAddress)}
                  className="inline-flex max-w-full items-center gap-2 break-all text-left font-mono hover:text-primary"
                  title="Copy email address"
                >
                  <span>{mailbox.emailAddress}</span>
                  <Icon glyph={Copy} className="size-4 shrink-0" />
                </button>
              </h1>
              <span
                className={cn(
                  "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize",
                  liveCounts.status === "active"
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {liveCounts.status}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-muted-foreground">
              <span data-testid="inbox-total-count" className="font-mono font-medium text-foreground">
                {liveCounts.totalMessages}
              </span>{" "}
              messages ·{" "}
              <span data-testid="inbox-unread-count" className="font-mono font-semibold text-primary">
                {liveCounts.unreadMessages}
              </span>{" "}
              unread
            </p>
          </div>
        </div>

        <form
          method="get"
          action={`/users/inbox/${mailbox.uuid}`}
          role="search"
          className="mt-5 flex flex-wrap items-center gap-2.5"
        >
          <div className="min-w-56 flex-1">
            <label htmlFor="inbox-search-q" className="sr-only">
              Search sender or subject
            </label>
            <input
              id="inbox-search-q"
              name="q"
              defaultValue={inboxResult.query}
              placeholder="Search sender name, address, or subject"
              autoComplete="off"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label htmlFor="inbox-read-filter" className="sr-only">
              Read state
            </label>
            <select
              id="inbox-read-filter"
              name="read"
              aria-label="Read state"
              defaultValue={
                inboxResult.readFilter === "all" ? "" : inboxResult.readFilter
              }
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">All messages</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>

          <div>
            <label htmlFor="inbox-attachment-filter" className="sr-only">
              Attachment filter
            </label>
            <select
              id="inbox-attachment-filter"
              name="attachments"
              aria-label="Attachment filter"
              defaultValue={
                inboxResult.attachmentFilter === "all"
                  ? ""
                  : inboxResult.attachmentFilter
              }
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Any attachment</option>
              <option value="yes">Has attachment</option>
              <option value="no">No attachment</option>
            </select>
          </div>

          <Button type="submit" variant="secondary">
            <Icon glyph={Search} />
            Filter
          </Button>

          {hasFilters ? (
            <Link
              href={`/users/inbox/${mailbox.uuid}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon glyph={RotateCcw} className="size-3.5" />
              Reset
            </Link>
          ) : null}
        </form>
      </section>

      <section
        aria-label="Inbox message list"
        className="overflow-hidden rounded-lg border border-border bg-card"
      >
        <div className="divide-y divide-border">
          {inboxResult.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <Icon glyph={Mail} className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                No messages match this view.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Incoming messages delivered to{" "}
                <span className="font-mono text-foreground">
                  {mailbox.emailAddress}
                </span>{" "}
                will appear here automatically once indexed.
              </p>
            </div>
          ) : (
            inboxResult.items.map((item) => (
              <Link
                key={item.uuid}
                href={`/users/inbox/${mailbox.uuid}/${item.uuid}`}
                data-message-uuid={item.uuid}
                className={cn(
                  "flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                  !item.isRead && "bg-primary/5",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      item.isRead ? "bg-border" : "bg-primary",
                    )}
                    aria-label={item.isRead ? "Read" : "Unread"}
                    title={item.isRead ? "Read" : "Unread"}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm text-foreground",
                          !item.isRead ? "font-semibold" : "font-medium",
                        )}
                      >
                        {item.senderName ||
                          item.senderAddress ||
                          "Unknown sender"}
                      </span>
                      {item.senderAddress && item.senderName ? (
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          &lt;{item.senderAddress}&gt;
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-sm text-foreground",
                          !item.isRead ? "font-semibold" : "font-normal",
                        )}
                      >
                        {item.subject || "(No subject)"}
                      </span>
                      {item.preview ? (
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          — {item.preview}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.hasAttachments ? (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                          <Icon glyph={Paperclip} className="size-3" />
                          Attachment
                        </span>
                      ) : null}
                      <span className="font-mono">
                        {formatMessageByteSize(item.sizeBytes)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 pl-5 text-xs text-muted-foreground sm:pl-0">
                  <Icon glyph={Clock} className="size-3.5" />
                  <time dateTime={item.receivedAt ?? undefined}>
                    {item.receivedAt
                      ? item.receivedAt.slice(0, 16).replace("T", " ")
                      : "Unknown date"}
                  </time>
                </div>
              </Link>
            ))
          )}
        </div>

        {inboxResult.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              Page {inboxResult.page} of {inboxResult.totalPages} (
              {inboxResult.totalCount} messages)
            </span>
            <div className="flex items-center gap-2">
              {inboxResult.page > 1 ? (
                <Link
                  href={`/users/inbox/${mailbox.uuid}?page=${inboxResult.page - 1}&q=${encodeURIComponent(inboxResult.query)}&read=${inboxResult.readFilter === "all" ? "" : inboxResult.readFilter}&attachments=${inboxResult.attachmentFilter === "all" ? "" : inboxResult.attachmentFilter}`}
                  className="inline-flex min-h-8 items-center rounded-md border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  Previous
                </Link>
              ) : null}
              {inboxResult.page < inboxResult.totalPages ? (
                <Link
                  href={`/users/inbox/${mailbox.uuid}?page=${inboxResult.page + 1}&q=${encodeURIComponent(inboxResult.query)}&read=${inboxResult.readFilter === "all" ? "" : inboxResult.readFilter}&attachments=${inboxResult.attachmentFilter === "all" ? "" : inboxResult.attachmentFilter}`}
                  className="inline-flex min-h-8 items-center rounded-md border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
