"use client";

import {
  Badge,
  Button,
  CopyButton,
  Icon,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { LiveWorkspaceNavigationBar } from "@/components/users/live-mail-notifier";
import { MessageReaderView } from "@/components/users/message-reader-view";
import {
  buildInboxUrl,
  buildMessageUrl,
  formatMessageByteSize,
  formatShortInboxDate,
} from "@/components/users/user-workspace-helpers";
import type {
  LiveUpdatePayload,
  MessageActionResult,
  UserInboxListResult,
  UserMessageDetail,
} from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  MailOpen,
  Paperclip,
  RotateCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export { formatMessageByteSize };

export interface MailboxInboxViewProps {
  readonly inboxResult: UserInboxListResult;
  readonly activeMessage?: UserMessageDetail | null;
  readonly markUnreadAction?: (input: {
    readonly mailboxUuid: string;
    readonly messageUuid: string;
  }) => Promise<MessageActionResult<{ uuid: string; isRead: boolean }>>;
  readonly deleteMessageAction?: (input: {
    readonly mailboxUuid: string;
    readonly messageUuid: string;
  }) => Promise<MessageActionResult<{ uuid: string }>>;
}

export function MailboxInboxView({
  inboxResult,
  activeMessage = null,
  markUnreadAction,
  deleteMessageAction,
}: MailboxInboxViewProps) {
  const { mailbox } = inboxResult;
  const [readerExpanded, setReaderExpanded] = useState(false);
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

  const filterParams = {
    q: inboxResult.query,
    read: inboxResult.readFilter,
    attachments: inboxResult.attachmentFilter,
    page: inboxResult.page,
  };

  const hasFilters =
    inboxResult.query.length > 0 ||
    inboxResult.readFilter !== "all" ||
    inboxResult.attachmentFilter !== "all";

  const hasActiveReader = Boolean(
    activeMessage && markUnreadAction && deleteMessageAction,
  );

  return (
    <div className="space-y-3">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={[mailbox.uuid]}
        pollingEnabled={true}
        onLivePayload={handleLivePayload}
      />

      <div
        className={cn(
          "border border-border bg-card",
          !readerExpanded && "xl:grid xl:grid-cols-[minmax(360px,42%)_1fr]",
        )}
      >
        <section
          aria-labelledby="mailbox-inbox-title"
          className={cn(
            "flex flex-col border-border",
            !readerExpanded && "xl:border-r",
            hasActiveReader && (readerExpanded ? "hidden" : "hidden xl:flex"),
          )}
        >
          <div className="border-b border-border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/users/mailboxes"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Icon glyph={ArrowLeft} className="size-3" />
                All mailboxes
              </Link>
              <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                <span>
                  <strong
                    data-testid="inbox-total-count"
                    className="font-mono font-medium text-foreground"
                  >
                    {liveCounts.totalMessages}
                  </strong>{" "}
                  total
                </span>
                <span>·</span>
                <span>
                  <strong
                    data-testid="inbox-unread-count"
                    className="font-mono font-semibold text-primary"
                  >
                    {liveCounts.unreadMessages}
                  </strong>{" "}
                  unread
                </span>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h1
                id="mailbox-inbox-title"
                className="text-sm font-medium text-foreground"
              >
                <CopyButton
                  value={mailbox.emailAddress}
                  title="Copy email address"
                  successMessage={`Copied ${mailbox.emailAddress}`}
                  errorMessage="Unable to copy address."
                  className="max-w-full break-all text-left font-mono text-sm"
                >
                  <span>{mailbox.emailAddress}</span>
                </CopyButton>
              </h1>
              <Badge
                variant={liveCounts.status === "active" ? "success" : "default"}
              >
                {liveCounts.status}
              </Badge>
            </div>

            <form
              method="get"
              action={`/users/inbox/${mailbox.uuid}`}
              role="search"
              className="mt-2.5 flex flex-wrap items-center gap-1.5"
            >
              <div className="min-w-40 flex-1">
                <Label htmlFor="inbox-search-q" className="sr-only">
                  Search sender or subject
                </Label>
                <Input
                  id="inbox-search-q"
                  name="q"
                  defaultValue={inboxResult.query}
                  placeholder="Search sender or subject"
                  autoComplete="off"
                />
              </div>

              <div>
                <Label htmlFor="inbox-read-filter" className="sr-only">
                  Read state
                </Label>
                <Select
                  id="inbox-read-filter"
                  name="read"
                  aria-label="Read state"
                  defaultValue={
                    inboxResult.readFilter === "all"
                      ? ""
                      : inboxResult.readFilter
                  }
                >
                  <option value="">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="inbox-attachment-filter" className="sr-only">
                  Attachment filter
                </Label>
                <Select
                  id="inbox-attachment-filter"
                  name="attachments"
                  aria-label="Attachment filter"
                  defaultValue={
                    inboxResult.attachmentFilter === "all"
                      ? ""
                      : inboxResult.attachmentFilter
                  }
                >
                  <option value="">Any attachment</option>
                  <option value="yes">Has attachment</option>
                  <option value="no">No attachment</option>
                </Select>
              </div>

              <Button type="submit" variant="secondary">
                <Icon glyph={Search} />
                Filter
              </Button>

              {hasFilters ? (
                <Button asChild variant="outline">
                  <Link href={`/users/inbox/${mailbox.uuid}`}>
                    <Icon glyph={RotateCcw} className="size-3" />
                    Reset
                  </Link>
                </Button>
              ) : null}
            </form>
          </div>

          <div
            aria-label="Inbox message list"
            className="flex-1 divide-y divide-border overflow-y-auto xl:max-h-[calc(100dvh-16rem)]"
          >
            {inboxResult.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-12 text-center">
                <Icon glyph={Mail} className="size-6 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">
                  No messages match this view.
                </p>
              </div>
            ) : (
              inboxResult.items.map((item) => {
                const isSelected = activeMessage?.uuid === item.uuid;
                const href = buildMessageUrl(mailbox.uuid, item.uuid, filterParams);
                return (
                  <Link
                    key={item.uuid}
                    href={href}
                    data-message-uuid={item.uuid}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "flex items-start justify-between gap-2.5 px-3 py-2 transition-colors hover:bg-muted",
                      !item.isRead && "bg-accent/40",
                      isSelected && "bg-accent text-accent-foreground",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0",
                          item.isRead ? "bg-transparent" : "bg-primary",
                        )}
                        aria-label={item.isRead ? "Read" : "Unread"}
                        title={item.isRead ? "Read" : "Unread"}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-xs text-foreground",
                              !item.isRead ? "font-semibold" : "font-medium",
                            )}
                          >
                            {item.senderName ||
                              item.senderAddress ||
                              "Unknown sender"}
                          </span>
                          <time
                            dateTime={item.receivedAt ?? undefined}
                            className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                          >
                            {formatShortInboxDate(item.receivedAt, "—")}
                          </time>
                        </div>

                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "truncate text-xs text-foreground",
                              !item.isRead ? "font-semibold" : "font-normal",
                            )}
                          >
                            {item.subject || "(No subject)"}
                          </span>
                          {item.hasAttachments ? (
                            <Icon
                              glyph={Paperclip}
                              className="size-3 shrink-0 text-muted-foreground"
                            />
                          ) : null}
                        </div>

                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="truncate">
                            {item.preview || item.senderAddress}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums">
                            {formatMessageByteSize(item.sizeBytes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {inboxResult.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                Page {inboxResult.page} / {inboxResult.totalPages} (
                {inboxResult.totalCount})
              </span>
              <div className="flex items-center gap-1.5">
                {inboxResult.page > 1 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={buildInboxUrl(mailbox.uuid, {
                        ...filterParams,
                        page: inboxResult.page - 1,
                      })}
                    >
                      Previous
                    </Link>
                  </Button>
                ) : null}
                {inboxResult.page < inboxResult.totalPages ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={buildInboxUrl(mailbox.uuid, {
                        ...filterParams,
                        page: inboxResult.page + 1,
                      })}
                    >
                      Next
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {hasActiveReader && activeMessage && markUnreadAction && deleteMessageAction ? (
          <div className="min-w-0">
            <MessageReaderView
              message={activeMessage}
              markUnreadAction={markUnreadAction}
              deleteMessageAction={deleteMessageAction}
              filterParams={filterParams}
              embedded={true}
              expanded={readerExpanded}
              onToggleExpanded={() => setReaderExpanded((prev) => !prev)}
            />
          </div>
        ) : (
          <div className="hidden min-h-[420px] flex-col items-center justify-center gap-1.5 bg-background p-6 text-center xl:flex">
            <Icon glyph={MailOpen} className="size-7 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">
              Select a message to read
            </p>
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {liveCounts.unreadMessages} unread · {liveCounts.totalMessages}{" "}
              total
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
