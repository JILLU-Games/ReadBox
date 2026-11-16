"use client";

import {
  AlertBanner,
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Icon,
  notify,
} from "@/components/ui";
import { LiveWorkspaceNavigationBar } from "@/components/users/live-mail-notifier";
import {
  buildInboxUrl,
  formatCompactTimestamp,
  formatMessageByteSize,
  type InboxUrlParams,
} from "@/components/users/user-workspace-helpers";
import type {
  MessageActionResult,
  UserMessageDetail,
} from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Code2,
  Download,
  FileText,
  Mail,
  Maximize2,
  Minimize2,
  Paperclip,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

const subscribeNoop = () => () => {};

export interface MessageReaderViewProps {
  readonly message: UserMessageDetail;
  readonly markUnreadAction: (input: {
    readonly mailboxUuid: string;
    readonly messageUuid: string;
  }) => Promise<MessageActionResult<{ uuid: string; isRead: boolean }>>;
  readonly deleteMessageAction: (input: {
    readonly mailboxUuid: string;
    readonly messageUuid: string;
  }) => Promise<MessageActionResult<{ uuid: string }>>;
  readonly filterParams?: InboxUrlParams;
  readonly embedded?: boolean;
  readonly expanded?: boolean;
  readonly onToggleExpanded?: () => void;
}

export function MessageReaderView({
  message,
  markUnreadAction,
  deleteMessageAction,
  filterParams = {},
  embedded = false,
  expanded = false,
  onToggleExpanded,
}: MessageReaderViewProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const [viewMode, setViewMode] = useState<"html" | "text">(
    message.hasHtmlBody ? "html" : "text",
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { mailbox } = message;
  const senderDisplay =
    message.senderName || message.senderAddress || "Unknown sender";
  const avatarInitial = senderDisplay.slice(0, 1).toUpperCase() || "?";
  const backToInboxUrl = buildInboxUrl(mailbox.uuid, filterParams);
  const htmlIframeSrc = `/api/messages/html/${message.uuid}${mounted && resolvedTheme === "dark" ? "?theme=dark" : ""}`;

  function handleMarkUnread() {
    startTransition(async () => {
      const result = await markUnreadAction({
        mailboxUuid: mailbox.uuid,
        messageUuid: message.uuid,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      notify.success(result.message ?? "Message marked as unread.");
      router.push(backToInboxUrl);
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteMessageAction({
        mailboxUuid: mailbox.uuid,
        messageUuid: message.uuid,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      notify.success(result.message ?? "Message deleted.");
      setDeleteDialogOpen(false);
      router.push(backToInboxUrl);
      router.refresh();
    });
  }

  return (
    <div className={embedded ? "space-y-0" : "space-y-3"}>
      {!embedded ? (
        <LiveWorkspaceNavigationBar
          visibleMailboxUuids={[mailbox.uuid]}
          pollingEnabled={true}
        />
      ) : null}

      <article
        aria-labelledby="message-reader-subject"
        className={cn(
          "border border-border bg-card",
          embedded && "border-0",
        )}
      >
        <header className="border-b border-border px-3 py-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={backToInboxUrl}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon glyph={ArrowLeft} className="size-3.5" />
              Back to {mailbox.emailAddress}
            </Link>

            <div className="flex flex-wrap items-center gap-1.5">
              {onToggleExpanded ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onToggleExpanded}
                  className="hidden xl:inline-flex"
                >
                  <Icon glyph={expanded ? Minimize2 : Maximize2} />
                  {expanded ? "Split view" : "Expand"}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={handleMarkUnread}
              >
                <Icon glyph={Mail} />
                Mark unread
              </Button>
              {message.canDeleteMessage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Icon glyph={Trash2} />
                  Delete
                </Button>
              ) : null}
            </div>
          </div>

          <h1
            id="message-reader-subject"
            className="break-words text-base font-medium text-foreground"
          >
            {message.subject || "(No subject)"}
          </h1>

          <div className="flex flex-col gap-2 border border-border bg-muted/40 p-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center bg-primary text-xs font-medium text-primary-foreground"
              >
                {avatarInitial}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="break-all text-xs font-medium text-foreground">
                    {senderDisplay}
                  </strong>
                  {message.senderAddress && message.senderName ? (
                    <span className="break-all font-mono text-[11px] text-muted-foreground">
                      &lt;{message.senderAddress}&gt;
                    </span>
                  ) : null}
                  {message.senderAddress ? (
                    <CopyButton
                      value={message.senderAddress}
                      label={`Copy ${message.senderAddress}`}
                      successMessage={`Copied ${message.senderAddress}`}
                      errorMessage="Unable to copy address."
                      className="border border-border bg-card px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground hover:text-foreground"
                    >
                      Copy
                    </CopyButton>
                  ) : null}
                </div>

                <details className="text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-foreground">
                    to{" "}
                    {message.recipientAddresses.length > 0
                      ? message.recipientAddresses.join(", ")
                      : mailbox.emailAddress}
                  </summary>
                  <dl className="mt-2 grid gap-1 border border-border bg-card p-2.5 font-mono text-[11px]">
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 font-medium text-muted-foreground">
                        From:
                      </dt>
                      <dd className="min-w-0 flex-1 break-all text-foreground">
                        {message.senderName}
                        {message.senderAddress
                          ? ` <${message.senderAddress}>`
                          : ""}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 font-medium text-muted-foreground">
                        To:
                      </dt>
                      <dd className="min-w-0 flex-1 break-all text-foreground">
                        {message.recipientAddresses.length > 0
                          ? message.recipientAddresses.join(", ")
                          : "Not available"}
                      </dd>
                    </div>
                    {message.ccAddresses.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="w-16 font-medium text-muted-foreground">
                          CC:
                        </dt>
                        <dd className="min-w-0 flex-1 break-all text-foreground">
                          {message.ccAddresses.join(", ")}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 font-medium text-muted-foreground">
                        Mailbox:
                      </dt>
                      <dd className="min-w-0 flex-1 break-all text-foreground">
                        {mailbox.emailAddress}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 font-medium text-muted-foreground">
                        Received:
                      </dt>
                      <dd className="tabular-nums text-foreground">
                        {message.receivedAt
                          ? formatCompactTimestamp(message.receivedAt) + " UTC"
                          : "Unknown"}
                      </dd>
                    </div>
                     <div className="flex flex-wrap gap-2">
                      <dt className="w-16 font-medium text-muted-foreground">
                        Size:
                      </dt>
                      <dd className="tabular-nums text-foreground">
                        {formatMessageByteSize(message.sizeBytes)}
                      </dd>
                    </div>
                  </dl>
                </details>
              </div>
            </div>

            <time
              dateTime={message.receivedAt ?? undefined}
              className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
            >
              {formatCompactTimestamp(message.receivedAt, "Unknown date")}
            </time>
          </div>

          {message.parseWarning ? (
            <AlertBanner variant="warning" role="note">
              <strong className="font-medium">Parsing warning:</strong>{" "}
              {message.parseWarning}
            </AlertBanner>
          ) : null}
        </header>

        <section aria-label="Email body" className="space-y-2.5 p-3">
          {message.hasHtmlBody && message.textBody.trim().length > 0 ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "html" ? "default" : "outline"}
                onClick={() => setViewMode("html")}
              >
                <Icon glyph={Code2} />
                Sanitized HTML
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "text" ? "default" : "outline"}
                onClick={() => setViewMode("text")}
              >
                <Icon glyph={FileText} />
                Plain text
              </Button>
            </div>
          ) : null}

          {message.hasHtmlBody && viewMode === "html" ? (
            <div className="border border-border bg-card">
              <iframe
                title="Email message content"
                sandbox=""
                referrerPolicy="no-referrer"
                loading="eager"
                src={htmlIframeSrc}
                className="min-h-[380px] w-full border-0 bg-card"
              />
            </div>
          ) : message.textBody.trim().length > 0 ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-border bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground">
              {message.textBody}
            </pre>
          ) : (
            <div className="border border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
              No readable message body is available.
            </div>
          )}
        </section>

        <section
          aria-labelledby="attachments-heading"
          className="space-y-2 border-t border-border px-3 py-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Icon glyph={Paperclip} className="text-muted-foreground" />
              <h2
                id="attachments-heading"
                className="text-xs font-medium text-foreground"
              >
                Attachments ({message.attachments.length})
              </h2>
            </div>
          </div>

          {message.attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attachments.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {message.attachments.map((attachment) => (
                <div
                  key={attachment.uuid}
                  className="flex items-center justify-between gap-2 border border-border bg-background px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium text-foreground">
                      {attachment.safeFilename}
                    </p>
                    <p className="truncate text-[11px] tabular-nums text-muted-foreground">
                      {attachment.detectedMimeType || "application/octet-stream"}{" "}
                      · {formatMessageByteSize(attachment.sizeBytes)}
                    </p>
                  </div>

                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                  >
                    <a
                      href={`/api/messages/attachment/${attachment.uuid}`}
                      download={attachment.safeFilename}
                    >
                      <Icon glyph={Download} className="size-3" />
                      Download
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </article>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => (!open ? setDeleteDialogOpen(false) : undefined)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Delete message from workspace?</DialogTitle>
          <DialogDescription>
            Removes{" "}
            <strong className="text-foreground">
              {message.subject || "(No subject)"}
            </strong>{" "}
            from your inbox.
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              <Icon glyph={Trash2} />
              Delete message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
