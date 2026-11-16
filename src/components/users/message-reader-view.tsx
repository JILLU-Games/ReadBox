"use client";

import {
  AlertBanner,
  Badge,
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
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Maximize2,
  Minimize2,
  Paperclip,
  Printer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useMemo, useState, useTransition } from "react";

export interface MessageReaderNavigation {
  readonly currentIndex: number;
  readonly totalCount: number;
  readonly prevHref: string | null;
  readonly nextHref: string | null;
}

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
  readonly navigation?: MessageReaderNavigation | null;
}

function extractAndScopeEmailHtml(rawHtml: string, scopeClass: string): string {
  if (!rawHtml || !rawHtml.trim()) {
    return "";
  }

  let working = rawHtml.trim();

  // If full HTML document was returned by API endpoint, extract style tags and body innerHTML
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(working);
  if (bodyMatch) {
    const styleMatches = working.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
    const bodyInner = bodyMatch[1] ?? "";
    working = `${styleMatches.join("\n")}${bodyInner}`;
  }

  // Scope <style> rules to the email container class so email styles never leak outside
  working = working.replace(
    /<style[^>]*>([\s\S]*?)<\/style>/gi,
    (_full, cssText: string) => {
      const scopedCss = cssText.replace(
        /(^|\}|\{)\s*([^{}@]+?)\s*\{/g,
        (match, delimiter: string, selectorGroup: string) => {
          const trimmedGroup = selectorGroup.trim();
          if (!trimmedGroup || trimmedGroup.startsWith("@")) {
            return match;
          }
          const scopedSelectors = trimmedGroup
            .split(",")
            .map((sel) => {
              const s = sel.trim();
              if (!s) return "";
              if (/^(html|body)\b/i.test(s)) {
                return s.replace(/^(html|body)\b/i, `.${scopeClass}`);
              }
              return `.${scopeClass} ${s}`;
            })
            .filter(Boolean)
            .join(", ");
          return `${delimiter} ${scopedSelectors} {`;
        },
      );
      return `<style>${scopedCss}</style>`;
    },
  );

  // Ensure all anchor links open safely and remain interactive + right-click copyable
  working = working.replace(
    /<a\b([^>]*?)>/gi,
    (fullTag, attrs: string) => {
      const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
        attrs,
      );
      const href = (
        hrefMatch?.[1] ??
        hrefMatch?.[2] ??
        hrefMatch?.[3] ??
        ""
      ).trim();
      if (!href) {
        return fullTag;
      }
      const isMailtoOrHash =
        href.toLowerCase().startsWith("mailto:") || href.startsWith("#");
      let cleanedAttrs = attrs
        .replace(/\btarget\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\brel\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .trim();
      if (!isMailtoOrHash) {
        cleanedAttrs = `${cleanedAttrs} target="_blank" rel="noopener noreferrer"`.trim();
      }
      return `<a ${cleanedAttrs}>`;
    },
  );

  return working;
}

const URL_OR_EMAIL_TOKEN_RE =
  /(https?:\/\/[^\s<>"')]+|mailto:[^\s<>"')]+|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/gi;

function renderLinkifiedTextLine(line: string, lineKey: string): ReactNode[] {
  const parts = line.split(URL_OR_EMAIL_TOKEN_RE);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={`${lineKey}-${idx}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-85 break-all"
        >
          {part}
        </a>
      );
    }
    if (/^mailto:/i.test(part)) {
      return (
        <a
          key={`${lineKey}-${idx}`}
          href={part}
          className="text-primary underline underline-offset-2 hover:opacity-85 break-all"
        >
          {part.replace(/^mailto:/i, "")}
        </a>
      );
    }
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
      return (
        <a
          key={`${lineKey}-${idx}`}
          href={`mailto:${part}`}
          className="text-primary underline underline-offset-2 hover:opacity-85 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={`${lineKey}-${idx}`}>{part}</span>;
  });
}

export function MessageReaderView({
  message,
  markUnreadAction,
  deleteMessageAction,
  filterParams = {},
  embedded = false,
  expanded = false,
  onToggleExpanded,
  navigation = null,
}: MessageReaderViewProps) {
  const router = useRouter();
  const rawScopeId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const scopeClass = `readbox-mail-scope-${rawScopeId}`;

  const [fetchedHtmlByUuid, setFetchedHtmlByUuid] = useState<
    Record<string, string>
  >({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const directHtml = (message.htmlBody ?? "").trim();
  const fetchedHtml = (fetchedHtmlByUuid[message.uuid] ?? "").trim();

  useEffect(() => {
    if (directHtml.length > 0 || !message.hasHtmlBody) {
      return;
    }
    if (typeof window === "undefined" || typeof window.fetch !== "function") {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    window
      .fetch(`/api/messages/html/${message.uuid}`, {
        method: "GET",
        credentials: "same-origin",
        signal: controller.signal,
      })
      .then(async (res) => {
        if (!res.ok) return "";
        return res.text();
      })
      .then((htmlText) => {
        if (!cancelled && htmlText && htmlText.trim().length > 0) {
          setFetchedHtmlByUuid((prev) => ({
            ...prev,
            [message.uuid]: htmlText,
          }));
        }
      })
      .catch(() => {
        // Fallback to textBody if HTML endpoint is unreachable
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [directHtml, message.hasHtmlBody, message.uuid]);

  const effectiveHtml = directHtml || fetchedHtml;
  const scopedHtml = useMemo(
    () =>
      effectiveHtml ? extractAndScopeEmailHtml(effectiveHtml, scopeClass) : "",
    [effectiveHtml, scopeClass],
  );

  const { mailbox } = message;
  const senderDisplay =
    message.senderName || message.senderAddress || "Unknown sender";
  const avatarInitial = senderDisplay.slice(0, 1).toUpperCase() || "?";
  const backToInboxUrl = buildInboxUrl(mailbox.uuid, filterParams);
  const primaryRecipients =
    message.recipientAddresses.length > 0
      ? message.recipientAddresses.join(", ")
      : mailbox.emailAddress;

  const plainTextCopyValue = useMemo(() => {
    if (message.textBody && message.textBody.trim().length > 0) {
      return message.textBody.trim();
    }
    if (effectiveHtml) {
      return effectiveHtml
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return message.subject || "";
  }, [effectiveHtml, message.subject, message.textBody]);

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

  function handlePrintMessage() {
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
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
          "flex flex-col border border-border bg-card",
          embedded && "border-0",
        )}
      >
        {/* Gmail-style Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="px-2 text-muted-foreground hover:text-foreground"
            >
              <Link
                href={backToInboxUrl}
                title={`Back to ${mailbox.emailAddress}`}
              >
                <Icon glyph={ArrowLeft} className="size-3.5" />
                <span>Inbox</span>
              </Link>
            </Button>

            <span aria-hidden="true" className="h-4 w-px bg-border" />

            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={handleMarkUnread}
            >
              <Icon glyph={Mail} className="size-3.5" />
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
                <Icon glyph={Trash2} className="size-3.5" />
                Delete
              </Button>
            ) : null}

            <CopyButton
              value={plainTextCopyValue}
              label="Copy email content"
              successMessage="Copied email content"
              errorMessage="Unable to copy content."
              className="inline-flex h-7 items-center gap-1 border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span>Copy text</span>
            </CopyButton>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handlePrintMessage}
              title="Print email"
              className="hidden sm:inline-flex px-2 text-muted-foreground hover:text-foreground"
            >
              <Icon glyph={Printer} className="size-3.5" />
              <span className="sr-only">Print</span>
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            {navigation && navigation.totalCount > 0 ? (
              <div className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <span className="px-1 font-mono text-[11px]">
                  {navigation.currentIndex} of {navigation.totalCount}
                </span>
                {navigation.prevHref ? (
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0"
                  >
                    <Link href={navigation.prevHref} title="Newer message">
                      <Icon glyph={ChevronLeft} className="size-3.5" />
                      <span className="sr-only">Newer message</span>
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled
                    className="size-7 p-0 opacity-40"
                  >
                    <Icon glyph={ChevronLeft} className="size-3.5" />
                    <span className="sr-only">Newer message</span>
                  </Button>
                )}
                {navigation.nextHref ? (
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0"
                  >
                    <Link href={navigation.nextHref} title="Older message">
                      <Icon glyph={ChevronRight} className="size-3.5" />
                      <span className="sr-only">Older message</span>
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled
                    className="size-7 p-0 opacity-40"
                  >
                    <Icon glyph={ChevronRight} className="size-3.5" />
                    <span className="sr-only">Older message</span>
                  </Button>
                )}
              </div>
            ) : null}

            {onToggleExpanded ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onToggleExpanded}
                className="hidden xl:inline-flex"
              >
                <Icon glyph={expanded ? Minimize2 : Maximize2} />
                {expanded ? "Split view" : "Full view"}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Gmail-style Subject + Sender Header */}
        <header className="space-y-3 border-b border-border px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              id="message-reader-subject"
              className="break-words text-base font-medium leading-snug text-foreground"
            >
              {message.subject || "(No subject)"}
            </h1>
            <Badge variant="default" className="font-normal">
              Inbox
            </Badge>
            {message.attachments.length > 0 ? (
              <Badge variant="default" className="font-normal">
                <Icon glyph={Paperclip} className="mr-1 size-3" />
                {message.attachments.length}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center border border-border bg-primary/10 text-xs font-medium text-primary"
              >
                {avatarInitial}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
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
                      className="border border-border bg-background px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Copy
                    </CopyButton>
                  ) : null}
                </div>

                <details className="group text-[11px] text-muted-foreground">
                  <summary className="inline-flex cursor-pointer select-none items-center gap-1 hover:text-foreground">
                    <span>to {primaryRecipients}</span>
                    <span aria-hidden="true" className="text-[10px]">
                      ▾
                    </span>
                  </summary>
                  <dl className="mt-2 grid max-w-xl gap-1.5 border border-border bg-muted/30 p-2.5 font-mono text-[11px]">
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 shrink-0 text-muted-foreground">
                        from:
                      </dt>
                      <dd className="min-w-0 flex-1 break-all text-foreground">
                        {message.senderName}
                        {message.senderAddress
                          ? ` <${message.senderAddress}>`
                          : ""}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 shrink-0 text-muted-foreground">
                        to:
                      </dt>
                      <dd className="min-w-0 flex-1 break-all text-foreground">
                        {primaryRecipients}
                      </dd>
                    </div>
                    {message.ccAddresses.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="w-16 shrink-0 text-muted-foreground">
                          cc:
                        </dt>
                        <dd className="min-w-0 flex-1 break-all text-foreground">
                          {message.ccAddresses.join(", ")}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 shrink-0 text-muted-foreground">
                        date:
                      </dt>
                      <dd className="tabular-nums text-foreground">
                        {message.receivedAt
                          ? `${formatCompactTimestamp(message.receivedAt)} UTC`
                          : "Unknown"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 shrink-0 text-muted-foreground">
                        mailbox:
                      </dt>
                      <dd className="min-w-0 flex-1 break-all text-foreground">
                        {mailbox.emailAddress}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="w-16 shrink-0 text-muted-foreground">
                        size:
                      </dt>
                      <dd className="tabular-nums text-foreground">
                        {formatMessageByteSize(message.sizeBytes)}
                      </dd>
                    </div>
                  </dl>
                </details>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
              <time dateTime={message.receivedAt ?? undefined}>
                {formatCompactTimestamp(message.receivedAt, "Unknown date")}
              </time>
              <span>·</span>
              <span>{formatMessageByteSize(message.sizeBytes)}</span>
            </div>
          </div>

          {message.parseWarning ? (
            <AlertBanner variant="warning" role="note">
              <strong className="font-medium">Parsing warning:</strong>{" "}
              {message.parseWarning}
            </AlertBanner>
          ) : null}
        </header>

        {/* Unified Gmail-style Email Content Canvas (No HTML/Plain Text toggle, No broken sub-iframe) */}
        <section
          aria-label="Email body"
          data-testid="email-body-content"
          className="min-h-[260px] flex-1 select-text bg-card px-4 py-4 text-foreground"
        >
          <style>{`
            .${scopeClass} {
              font-family: "Segoe UI", "Segoe UI Web", system-ui, -apple-system, "Helvetica Neue", sans-serif;
              font-size: 13px;
              line-height: 1.6;
              color: inherit;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .${scopeClass} img {
              max-width: 100%;
              height: auto;
              display: inline-block;
            }
            .${scopeClass} table {
              max-width: 100%;
              border-collapse: collapse;
            }
            .${scopeClass} a {
              color: var(--primary);
              text-decoration: underline;
              text-underline-offset: 2px;
              cursor: pointer;
            }
            .${scopeClass} blockquote {
              margin: 8px 0;
              padding-left: 12px;
              border-left: 2px solid var(--border);
              color: var(--muted-foreground);
            }
            .${scopeClass} pre, .${scopeClass} code {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 12px;
            }
            .${scopeClass} pre {
              white-space: pre-wrap;
              overflow-x: auto;
              padding: 10px;
              border: 1px solid var(--border);
              background: var(--muted);
            }
          `}</style>

          {scopedHtml ? (
            <div
              className={cn(scopeClass, "max-w-full overflow-x-auto")}
              dangerouslySetInnerHTML={{ __html: scopedHtml }}
            />
          ) : message.textBody.trim().length > 0 ? (
            <div
              className={cn(
                scopeClass,
                "space-y-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground",
              )}
            >
              {message.textBody.split("\n").map((line, index) => (
                <div key={`line-${index}`} className="min-h-[1.25rem]">
                  {renderLinkifiedTextLine(line, `l-${index}`)}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              No readable message body is available.
            </div>
          )}
        </section>

        {/* Attachments Section */}
        {message.attachments.length > 0 ? (
          <section
            aria-labelledby="attachments-heading"
            className="space-y-2 border-t border-border bg-muted/15 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Icon glyph={Paperclip} className="size-3.5 text-muted-foreground" />
                <h2
                  id="attachments-heading"
                  className="text-xs font-medium text-foreground"
                >
                  {message.attachments.length}{" "}
                  {message.attachments.length === 1
                    ? "Attachment"
                    : "Attachments"}
                </h2>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {message.attachments.map((attachment) => (
                <div
                  key={attachment.uuid}
                  className="flex items-center justify-between gap-2 border border-border bg-card px-2.5 py-2"
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
          </section>
        ) : null}

        {/* Gmail-style Bottom Action Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/10 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {message.senderAddress ? (
              <CopyButton
                value={message.senderAddress}
                label={`Copy sender ${message.senderAddress}`}
                successMessage={`Copied ${message.senderAddress}`}
                errorMessage="Unable to copy sender address."
                className="inline-flex h-7 items-center gap-1.5 border border-border bg-background px-2.5 text-xs text-foreground hover:bg-muted"
              >
                <span>Copy sender address</span>
              </CopyButton>
            ) : null}
            <CopyButton
              value={plainTextCopyValue}
              label="Copy message text"
              successMessage="Copied message text"
              errorMessage="Unable to copy message text."
              className="inline-flex h-7 items-center gap-1.5 border border-border bg-background px-2.5 text-xs text-foreground hover:bg-muted"
            >
              <span>Copy message text</span>
            </CopyButton>
          </div>

          <span className="font-mono text-[11px] text-muted-foreground">
            Delivered to {mailbox.emailAddress}
          </span>
        </footer>
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
