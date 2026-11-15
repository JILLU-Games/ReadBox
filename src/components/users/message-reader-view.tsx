"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import { LiveWorkspaceNavigationBar } from "@/components/users/live-mail-notifier";
import { formatMessageByteSize } from "@/components/users/mailbox-inbox-view";
import type {
  MessageActionResult,
  UserMessageDetail,
} from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Code2,
  Copy,
  Download,
  FileText,
  Mail,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
}

export function MessageReaderView({
  message,
  markUnreadAction,
  deleteMessageAction,
}: MessageReaderViewProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"html" | "text">(
    message.hasHtmlBody ? "html" : "text",
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { mailbox } = message;
  const senderDisplay =
    message.senderName || message.senderAddress || "Unknown sender";
  const avatarInitial = senderDisplay.slice(0, 1).toUpperCase() || "?";

  async function handleCopyText(value: string) {
    try {
      await navigator.clipboard?.writeText(value);
      notify.success(`Copied ${value}`);
    } catch {
      notify.error("Unable to copy address.");
    }
  }

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
      router.push(`/users/inbox/${mailbox.uuid}`);
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

      notify.success(
        result.message ??
          "Message deleted. The source email remains preserved.",
      );
      setDeleteDialogOpen(false);
      router.push(`/users/inbox/${mailbox.uuid}`);
    });
  }

  return (
    <div className="space-y-6">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={[mailbox.uuid]}
        pollingEnabled={true}
      />

      <article
        aria-labelledby="message-reader-subject"
        className="space-y-6 rounded-lg border border-border bg-card p-6"
      >
        <header className="space-y-4 border-b border-border pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/users/inbox/${mailbox.uuid}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon glyph={ArrowLeft} className="size-3.5" />
              Back to {mailbox.emailAddress}
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
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
            className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
          >
            {message.subject || "(No subject)"}
          </h1>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/25 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {avatarInitial}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="break-all text-sm font-semibold text-foreground">
                    {senderDisplay}
                  </strong>
                  {message.senderAddress && message.senderName ? (
                    <span className="break-all font-mono text-xs text-muted-foreground">
                      &lt;{message.senderAddress}&gt;
                    </span>
                  ) : null}
                  {message.senderAddress ? (
                    <button
                      type="button"
                      onClick={() => handleCopyText(message.senderAddress)}
                      className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Icon glyph={Copy} className="size-3" />
                      Copy
                    </button>
                  ) : null}
                </div>

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium hover:text-foreground">
                    to{" "}
                    {message.recipientAddresses.length > 0
                      ? message.recipientAddresses.join(", ")
                      : mailbox.emailAddress}
                  </summary>
                  <dl className="mt-2.5 grid gap-1.5 rounded-md border border-border bg-card p-3 font-mono text-[11px]">
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-20 font-semibold text-muted-foreground">
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
                      <dt className="w-20 font-semibold text-muted-foreground">
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
                        <dt className="w-20 font-semibold text-muted-foreground">
                          CC:
                        </dt>
                        <dd className="min-w-0 flex-1 break-all text-foreground">
                          {message.ccAddresses.join(", ")}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-20 font-semibold text-muted-foreground">
                        Mailbox:
                      </dt>
                      <dd className="min-w-0 flex-1 break-all text-foreground">
                        {mailbox.emailAddress}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-20 font-semibold text-muted-foreground">
                        Received:
                      </dt>
                      <dd className="text-foreground">
                        {message.receivedAt
                          ? message.receivedAt.replace("T", " ").slice(0, 19) +
                            " UTC"
                          : "Unknown"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-20 font-semibold text-muted-foreground">
                        Size:
                      </dt>
                      <dd className="text-foreground">
                        {formatMessageByteSize(message.sizeBytes)}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-20 font-semibold text-muted-foreground">
                        Status:
                      </dt>
                      <dd className="uppercase text-foreground">
                        {message.parseStatus}
                      </dd>
                    </div>
                  </dl>
                </details>
              </div>
            </div>

            <time
              dateTime={message.receivedAt ?? undefined}
              className="shrink-0 font-mono text-xs text-muted-foreground"
            >
              {message.receivedAt
                ? message.receivedAt.slice(0, 16).replace("T", " ")
                : "Unknown date"}
            </time>
          </div>

          {message.parseWarning ? (
            <div
              role="note"
              className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-xs text-foreground"
            >
              <Icon
                glyph={AlertTriangle}
                className="mt-0.5 shrink-0 text-warning"
              />
              <div>
                <strong className="font-semibold">Parsing warning:</strong>{" "}
                {message.parseWarning}
              </div>
            </div>
          ) : null}
        </header>

        <section aria-label="Email body" className="space-y-3">
          {message.hasHtmlBody && message.textBody.trim().length > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode("html")}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                  viewMode === "html"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon glyph={Code2} className="size-3.5" />
                Sanitized HTML
              </button>
              <button
                type="button"
                onClick={() => setViewMode("text")}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                  viewMode === "text"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon glyph={FileText} className="size-3.5" />
                Plain text
              </button>
            </div>
          ) : null}

          {message.hasHtmlBody && viewMode === "html" ? (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <iframe
                title="Email message content"
                sandbox=""
                referrerPolicy="no-referrer"
                loading="eager"
                src={`/api/messages/html/${message.uuid}`}
                className="min-h-[420px] w-full border-0 bg-white"
              />
            </div>
          ) : message.textBody.trim().length > 0 ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-5 font-mono text-sm leading-6 text-foreground">
              {message.textBody}
            </pre>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No readable message body is available.
            </div>
          )}
        </section>

        <section
          aria-labelledby="attachments-heading"
          className="space-y-3 border-t border-border pt-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon glyph={Paperclip} className="text-muted-foreground" />
              <h2
                id="attachments-heading"
                className="text-sm font-semibold text-foreground"
              >
                Attachments ({message.attachments.length})
              </h2>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Not antivirus scanned
            </span>
          </div>

          {message.attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attachments.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {message.attachments.map((attachment) => (
                <div
                  key={attachment.uuid}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold text-foreground">
                      {attachment.safeFilename}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {attachment.detectedMimeType || "application/octet-stream"}{" "}
                      · {formatMessageByteSize(attachment.sizeBytes)}
                    </p>
                  </div>

                  <a
                    href={`/api/messages/attachment/${attachment.uuid}`}
                    download={attachment.safeFilename}
                    className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted"
                  >
                    <Icon glyph={Download} className="size-3.5" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </article>

      {deleteDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-message-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-destructive">
                <Icon glyph={AlertTriangle} />
                <h2
                  id="delete-message-dialog-title"
                  className="text-base font-semibold"
                >
                  Delete message from workspace?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                aria-label="Close delete message dialog"
                className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
              >
                <Icon glyph={X} />
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              This removes{" "}
              <strong className="text-foreground">
                {message.subject || "(No subject)"}
              </strong>{" "}
              from the inbox view and updates mailbox counters. The original raw
              Maildir email file on disk remains untouched and preserved.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
