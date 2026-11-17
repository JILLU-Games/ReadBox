"use client";

import {
  AlertBanner,
  Badge,
  Button,
  CaptionText,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Icon,
  PageTitle,
  SectionTitle,
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Maximize2,
  Minimize2,
  Paperclip,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

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

const HTML_IFRAME_LOAD_TIMEOUT_MS = 12_000;
const HTML_IFRAME_MIN_HEIGHT_PX = 260;

type IframeLoadStatus = "loading" | "loaded" | "error";

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
  const { resolvedTheme } = useTheme();
  const activeTheme = resolvedTheme === "dark" ? "dark" : "light";

  const [retryCounter, setRetryCounter] = useState(0);
  const currentIframeKey = `${message.uuid}:${activeTheme}:${retryCounter}`;
  const [iframeLoadState, setIframeLoadState] = useState<{
    readonly key: string;
    readonly status: IframeLoadStatus;
  }>({
    key: currentIframeKey,
    status: message.hasHtmlBody ? "loading" : "loaded",
  });
  const [iframePlainText, setIframePlainText] = useState<{
    readonly key: string;
    readonly text: string;
  }>({
    key: currentIframeKey,
    text: "",
  });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const effectiveIframeStatus: IframeLoadStatus = !message.hasHtmlBody
    ? "loaded"
    : iframeLoadState.key === currentIframeKey
      ? iframeLoadState.status
      : "loading";

  const htmlFetchFailed =
    message.hasHtmlBody && effectiveIframeStatus === "error";
  const showHtmlIframe = message.hasHtmlBody && !htmlFetchFailed;
  const iframeSrc = `/api/messages/html/${message.uuid}?theme=${activeTheme}`;

  const syncIframeDimensions = useCallback((iframe: HTMLIFrameElement) => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const measuredHeight = Math.max(
      HTML_IFRAME_MIN_HEIGHT_PX,
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
    );
    iframe.style.height = `${measuredHeight}px`;
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !message.hasHtmlBody) {
      return;
    }
    const handleNativeError = () => {
      setIframeLoadState({
        key: currentIframeKey,
        status: "error",
      });
    };
    iframe.addEventListener("error", handleNativeError);
    return () => {
      iframe.removeEventListener("error", handleNativeError);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [currentIframeKey, htmlFetchFailed, message.hasHtmlBody]);

  useEffect(() => {
    if (!message.hasHtmlBody || effectiveIframeStatus !== "loading") {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const timerId = window.setTimeout(() => {
      setIframeLoadState({
        key: currentIframeKey,
        status: "error",
      });
    }, HTML_IFRAME_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [currentIframeKey, effectiveIframeStatus, message.hasHtmlBody]);

  function handleIframeLoad() {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const hasMarker = Boolean(
      doc?.querySelector('meta[name="readbox-html-body"]'),
    );

    if (!iframe || !doc || !hasMarker) {
      setIframeLoadState({
        key: currentIframeKey,
        status: "error",
      });
      return;
    }

    setIframeLoadState({
      key: currentIframeKey,
      status: "loaded",
    });

    const extractedText = (doc.body?.innerText ?? doc.body?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (extractedText) {
      setIframePlainText({
        key: currentIframeKey,
        text: extractedText,
      });
    }

    syncIframeDimensions(iframe);
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;

    if (typeof ResizeObserver !== "undefined" && doc.body) {
      const observer = new ResizeObserver(() => {
        if (iframeRef.current) {
          syncIframeDimensions(iframeRef.current);
        }
      });
      observer.observe(doc.body);
      resizeObserverRef.current = observer;
    }
  }

  function handleIframeError() {
    setIframeLoadState({
      key: currentIframeKey,
      status: "error",
    });
  }

  function handleRetryHtmlLoad() {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    setRetryCounter((c) => c + 1);
  }

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
    if (
      iframePlainText.key === currentIframeKey &&
      iframePlainText.text.length > 0
    ) {
      return iframePlainText.text;
    }
    return message.subject || "";
  }, [
    currentIframeKey,
    iframePlainText.key,
    iframePlainText.text,
    message.subject,
    message.textBody,
  ]);

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
        <div data-print-hide="true">
          <LiveWorkspaceNavigationBar
            visibleMailboxUuids={[mailbox.uuid]}
            pollingEnabled={true}
          />
        </div>
      ) : null}

      <article
        data-print-region="message-reader"
        aria-labelledby="message-reader-subject"
        className={cn(
          "flex flex-col border border-border bg-card",
          embedded && "border-0",
        )}
      >
        {/* Gmail-style Top Action Bar */}
        <div
          data-print-hide="true"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2"
        >
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
              variant="outline"
              size="sm"
              label="Copy email content"
              successMessage="Copied email content"
              errorMessage="Unable to copy content."
              className="font-normal"
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
                <CaptionText className="px-1 font-mono text-muted-foreground">
                  {navigation.currentIndex} of {navigation.totalCount}
                </CaptionText>
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
            {embedded ? (
              <SectionTitle
                id="message-reader-subject"
                className="break-words text-base leading-snug"
              >
                {message.subject || "(No subject)"}
              </SectionTitle>
            ) : (
              <PageTitle
                id="message-reader-subject"
                className="break-words leading-snug"
              >
                {message.subject || "(No subject)"}
              </PageTitle>
            )}
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
                className="grid size-8 shrink-0 place-items-center border border-border bg-accent text-xs font-medium text-accent-foreground"
              >
                {avatarInitial}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="break-all text-xs font-medium text-foreground">
                    {senderDisplay}
                  </strong>
                  {message.senderAddress && message.senderName ? (
                    <CaptionText className="break-all font-mono">
                      &lt;{message.senderAddress}&gt;
                    </CaptionText>
                  ) : null}
                  {message.senderAddress ? (
                    <CopyButton
                      value={message.senderAddress}
                      variant="outline"
                      size="xs"
                      label={`Copy ${message.senderAddress}`}
                      successMessage={`Copied ${message.senderAddress}`}
                      errorMessage="Unable to copy address."
                      className="font-normal"
                    >
                      Copy
                    </CopyButton>
                  ) : null}
                </div>

                <details className="group text-xs text-muted-foreground">
                  <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-[11px] hover:text-foreground">
                    <span>to {primaryRecipients}</span>
                    <Icon
                      glyph={ChevronDown}
                      className="size-3 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <dl className="mt-2 grid max-w-xl gap-1.5 border border-border bg-muted p-2.5 font-mono text-[11px]">
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

        {/* Isolated Sandboxed Email Content Canvas */}
        <section
          aria-label="Email body"
          data-testid="email-body-content"
          className="min-h-[260px] flex-1 select-text bg-card px-4 py-4 text-foreground"
        >
          {htmlFetchFailed ? (
            <AlertBanner
              variant="warning"
              className="mb-3"
              action={
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleRetryHtmlLoad}
                >
                  <Icon glyph={RotateCcw} className="size-3" />
                  Retry
                </Button>
              }
            >
              Formatted HTML body could not be loaded. Displaying text fallback.
            </AlertBanner>
          ) : null}

          {showHtmlIframe ? (
            <div className="space-y-2">
              {effectiveIframeStatus === "loading" ? (
                <p
                  role="status"
                  className="text-xs text-muted-foreground"
                >
                  Loading formatted email…
                </p>
              ) : null}
              <iframe
                key={currentIframeKey}
                ref={iframeRef}
                title="Formatted email message"
                data-testid="message-html-iframe"
                src={iframeSrc}
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                className="block min-h-[260px] w-full border-0 bg-card"
              />
            </div>
          ) : message.textBody.trim().length > 0 ? (
            <div className="readbox-mail-body space-y-2 whitespace-pre-wrap break-words text-foreground">
              {message.textBody.split("\n").map((line, index) => (
                <div key={`line-${index}`} className="min-h-[1.25rem]">
                  {renderLinkifiedTextLine(line, `l-${index}`)}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-border bg-muted p-6 text-center text-xs text-muted-foreground">
              No readable message body is available.
            </div>
          )}
        </section>

        {/* Attachments Section */}
        {message.attachments.length > 0 ? (
          <section
            aria-labelledby="attachments-heading"
            className="space-y-2 border-t border-border bg-muted px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Icon glyph={Paperclip} className="size-3.5 text-muted-foreground" />
                <SectionTitle id="attachments-heading">
                  {message.attachments.length}{" "}
                  {message.attachments.length === 1
                    ? "Attachment"
                    : "Attachments"}
                </SectionTitle>
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
        <footer
          data-print-hide="true"
          className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-4 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {message.senderAddress ? (
              <CopyButton
                value={message.senderAddress}
                variant="secondary"
                size="sm"
                label={`Copy sender ${message.senderAddress}`}
                successMessage={`Copied ${message.senderAddress}`}
                errorMessage="Unable to copy sender address."
                className="font-normal"
              >
                <span>Copy sender address</span>
              </CopyButton>
            ) : null}
            <CopyButton
              value={plainTextCopyValue}
              variant="secondary"
              size="sm"
              label="Copy message text"
              successMessage="Copied message text"
              errorMessage="Unable to copy message text."
              className="font-normal"
            >
              <span>Copy message text</span>
            </CopyButton>
          </div>

          <CaptionText className="font-mono">
            Delivered to {mailbox.emailAddress}
          </CaptionText>
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
