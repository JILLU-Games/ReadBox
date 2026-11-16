"use client";

import {
  Badge,
  Button,
  CaptionText,
  CopyButton,
  Icon,
  Input,
  Label,
  PageTitle,
  Pagination,
} from "@/components/ui";
import { LiveWorkspaceNavigationBar } from "@/components/users/live-mail-notifier";
import { MessageReaderView } from "@/components/users/message-reader-view";
import {
  buildInboxUrl,
  buildMessageUrl,
  formatCompactTimestamp,
  formatGmailInboxDate,
  formatMessageByteSize,
  getSenderDisplayName,
  getSenderInitials,
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

const READ_FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
] as const;

export function MailboxInboxView({
  inboxResult,
  activeMessage = null,
  markUnreadAction,
  deleteMessageAction,
}: MailboxInboxViewProps) {
  const { mailbox } = inboxResult;
  const [readerExpanded, setReaderExpanded] = useState(false);
  const mailboxPropKey = `${mailbox.uuid}:${mailbox.totalMessages}:${mailbox.unreadMessages}:${mailbox.status}`;
  const [liveOverride, setLiveOverride] = useState<{
    propKey: string;
    totalMessages: number;
    unreadMessages: number;
    status: string;
  } | null>(null);

  const liveCounts =
    liveOverride && liveOverride.propKey === mailboxPropKey
      ? liveOverride
      : {
          totalMessages: mailbox.totalMessages,
          unreadMessages: mailbox.unreadMessages,
          status: mailbox.status,
        };

  function handleLivePayload(payload: LiveUpdatePayload) {
    const matched = payload.mailboxes?.find((m) => m.uuid === mailbox.uuid);
    if (matched) {
      setLiveOverride({
        propKey: mailboxPropKey,
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

  const activeIndex = activeMessage
    ? inboxResult.items.findIndex((item) => item.uuid === activeMessage.uuid)
    : -1;
  const readerNavigation =
    activeMessage && activeIndex !== -1
      ? {
          currentIndex:
            (inboxResult.page - 1) * inboxResult.pageSize + activeIndex + 1,
          totalCount: inboxResult.totalCount,
          prevHref:
            activeIndex > 0
              ? buildMessageUrl(
                  mailbox.uuid,
                  inboxResult.items[activeIndex - 1]!.uuid,
                  filterParams,
                )
              : null,
          nextHref:
            activeIndex < inboxResult.items.length - 1
              ? buildMessageUrl(
                  mailbox.uuid,
                  inboxResult.items[activeIndex + 1]!.uuid,
                  filterParams,
                )
              : null,
        }
      : null;

  const attachmentsOnly = inboxResult.attachmentFilter === "yes";

  return (
    <div className="space-y-2.5">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={[mailbox.uuid]}
        pollingEnabled={true}
        onLivePayload={handleLivePayload}
      />

      <div
        className={cn(
          "border border-border bg-card",
          !readerExpanded &&
            "xl:grid xl:min-h-[calc(100dvh-7.25rem)] xl:grid-cols-[minmax(330px,375px)_1fr]",
        )}
      >
        <section
          aria-labelledby="mailbox-inbox-title"
          data-print-hide={hasActiveReader ? "true" : undefined}
          className={cn(
            "flex flex-col border-border",
            !readerExpanded && "xl:border-r",
            hasActiveReader && (readerExpanded ? "hidden" : "hidden xl:flex"),
          )}
        >
          {/* Compact Mailbox Identity + Single-Row Search */}
          <div className="border-b border-border bg-background/50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/users/mailboxes"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon glyph={ArrowLeft} className="size-3" />
                <span>All mailboxes</span>
              </Link>
              <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                <span>
                  <strong
                    data-testid="inbox-total-count"
                    className="font-medium text-foreground"
                  >
                    {liveCounts.totalMessages}
                  </strong>{" "}
                  total
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong
                    data-testid="inbox-unread-count"
                    className="font-medium text-primary"
                  >
                    {liveCounts.unreadMessages}
                  </strong>{" "}
                  unread
                </span>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <PageTitle
                  id="mailbox-inbox-title"
                  className="truncate font-mono text-[13px] font-medium"
                  title={mailbox.emailAddress}
                >
                  {mailbox.emailAddress}
                </PageTitle>
                <CopyButton
                  value={mailbox.emailAddress}
                  variant="inline"
                  size="xs"
                  label={`Copy ${mailbox.emailAddress}`}
                  title="Copy email address"
                  successMessage={`Copied ${mailbox.emailAddress}`}
                  errorMessage="Unable to copy address."
                  className="shrink-0"
                />
              </div>
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
              className="mt-2 flex flex-nowrap items-center gap-1"
            >
              {inboxResult.readFilter !== "all" ? (
                <input
                  type="hidden"
                  name="read"
                  value={inboxResult.readFilter}
                />
              ) : null}
              {inboxResult.attachmentFilter !== "all" ? (
                <input
                  type="hidden"
                  name="attachments"
                  value={inboxResult.attachmentFilter}
                />
              ) : null}

              <div className="relative min-w-0 flex-1">
                <Label htmlFor="inbox-search-q" className="sr-only">
                  Search mail
                </Label>
                <Icon
                  glyph={Search}
                  className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="inbox-search-q"
                  name="q"
                  defaultValue={inboxResult.query}
                  placeholder="Search mail"
                  autoComplete="off"
                  className="h-7 pl-7 pr-2 text-xs"
                />
              </div>

              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="h-7 shrink-0 px-2.5"
              >
                Search
              </Button>

              {hasFilters ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Link
                    href={`/users/inbox/${mailbox.uuid}`}
                    title="Reset search and filters"
                    aria-label="Reset filters"
                  >
                    <Icon glyph={RotateCcw} className="size-3" />
                  </Link>
                </Button>
              ) : null}
            </form>
          </div>

          {/* 1-Click Outlook / Gmail-style Filter Strip */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3">
            <div
              role="group"
              aria-label="Read state"
              className="flex items-center gap-3"
            >
              {READ_FILTER_TABS.map((tab) => {
                const isActive = inboxResult.readFilter === tab.value;
                return (
                  <Link
                    key={tab.value}
                    href={buildInboxUrl(mailbox.uuid, {
                      ...filterParams,
                      read: tab.value,
                      page: 1,
                    })}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "border-b-2 py-1.5 text-xs whitespace-nowrap transition-colors",
                      isActive
                        ? "border-primary font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            <Link
              href={buildInboxUrl(mailbox.uuid, {
                ...filterParams,
                attachments: attachmentsOnly ? "all" : "yes",
                page: 1,
              })}
              aria-label="Attachment filter"
              aria-pressed={attachmentsOnly}
              title={
                attachmentsOnly
                  ? "Showing messages with attachments"
                  : "Show only messages with attachments"
              }
              className={cn(
                "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px] whitespace-nowrap transition-colors",
                attachmentsOnly
                  ? "border-primary bg-accent font-medium text-accent-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Icon glyph={Paperclip} className="size-3" />
              <span>Attachments</span>
            </Link>
          </div>

          {/* Gmail / Outlook / Yahoo-style Scannable Message Rows */}
          <div
            aria-label="Inbox message list"
            className="readbox-scrollable flex-1 divide-y divide-border overflow-y-auto xl:max-h-[calc(100dvh-14.5rem)]"
          >
            {inboxResult.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <Icon glyph={Mail} className="size-6 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">
                  No messages match this view.
                </p>
                {hasFilters ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/users/inbox/${mailbox.uuid}`}>
                      <Icon glyph={RotateCcw} className="size-3" />
                      Clear filters
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              inboxResult.items.map((item) => {
                const isSelected = activeMessage?.uuid === item.uuid;
                const href = buildMessageUrl(mailbox.uuid, item.uuid, filterParams);
                const senderLabel = getSenderDisplayName(
                  item.senderName,
                  item.senderAddress,
                );
                const senderInitials = getSenderInitials(
                  item.senderName,
                  item.senderAddress,
                );
                const fullDateTitle = formatCompactTimestamp(
                  item.receivedAt,
                  "—",
                );

                return (
                  <Link
                    key={item.uuid}
                    href={href}
                    data-message-uuid={item.uuid}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "group relative flex items-start gap-2.5 px-3 py-2.5 transition-colors",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : item.isRead
                          ? "bg-background/35 hover:bg-muted/75"
                          : "bg-card hover:bg-muted/75",
                    )}
                  >
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                      />
                    ) : null}

                    {/* Crisp 28px Sender Initial Monogram */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center border text-[11px] font-medium",
                        isSelected || !item.isRead
                          ? "border-primary/25 bg-accent text-accent-foreground"
                          : "border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      {senderInitials}
                    </span>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {!item.isRead ? (
                            <span
                              className="size-1.5 shrink-0 bg-primary"
                              aria-label="Unread"
                              title="Unread"
                            />
                          ) : (
                            <span className="sr-only">Read</span>
                          )}
                          <span
                            className={cn(
                              "truncate text-xs",
                              !item.isRead
                                ? "font-medium text-foreground"
                                : "font-normal text-foreground/85",
                            )}
                          >
                            {senderLabel}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {item.hasAttachments ? (
                            <Icon
                              glyph={Paperclip}
                              className="size-3 shrink-0 text-muted-foreground"
                              aria-label="Has attachment"
                            />
                          ) : null}
                          <time
                            dateTime={item.receivedAt ?? undefined}
                            title={fullDateTitle}
                            className={cn(
                              "text-[11px] tabular-nums whitespace-nowrap",
                              !item.isRead
                                ? "font-medium text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatGmailInboxDate(item.receivedAt, "—")}
                          </time>
                        </div>
                      </div>

                      <p
                        className={cn(
                          "truncate text-xs leading-snug",
                          !item.isRead
                            ? "font-medium text-foreground"
                            : "font-normal text-foreground/80",
                        )}
                      >
                        {item.subject || "(No subject)"}
                      </p>

                      <p className="truncate text-[11px] leading-snug text-muted-foreground">
                        {item.preview || item.senderAddress}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <Pagination
            variant="flush"
            className="mt-auto"
            page={inboxResult.page}
            totalPages={inboxResult.totalPages}
            totalCount={inboxResult.totalCount}
            prevHref={
              inboxResult.page > 1
                ? buildInboxUrl(mailbox.uuid, {
                    ...filterParams,
                    page: inboxResult.page - 1,
                  })
                : null
            }
            nextHref={
              inboxResult.page < inboxResult.totalPages
                ? buildInboxUrl(mailbox.uuid, {
                    ...filterParams,
                    page: inboxResult.page + 1,
                  })
                : null
            }
          />
        </section>

        {hasActiveReader &&
        activeMessage &&
        markUnreadAction &&
        deleteMessageAction ? (
          <div className="min-w-0">
            <MessageReaderView
              message={activeMessage}
              markUnreadAction={markUnreadAction}
              deleteMessageAction={deleteMessageAction}
              filterParams={filterParams}
              embedded={true}
              expanded={readerExpanded}
              onToggleExpanded={() => setReaderExpanded((prev) => !prev)}
              navigation={readerNavigation}
            />
          </div>
        ) : (
          <div className="hidden min-h-[460px] flex-1 flex-col items-center justify-center gap-1.5 bg-background/40 p-6 text-center xl:flex">
            <Icon glyph={MailOpen} className="size-7 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">
              Select a message to read
            </p>
            <CaptionText className="tabular-nums">
              {liveCounts.unreadMessages} unread · {liveCounts.totalMessages}{" "}
              total
            </CaptionText>
          </div>
        )}
      </div>
    </div>
  );
}
