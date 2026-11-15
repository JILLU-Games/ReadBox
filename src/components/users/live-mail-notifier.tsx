"use client";

import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import type { LiveUpdateMessageItem, LiveUpdatePayload } from "@/core/messages/service";
import { cn } from "@/lib/utils";
import { Bell, BellRing, Inbox, LayoutDashboard, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_NOTIFIED_MESSAGE_UUIDS = 200;
export const NOTIFIED_STORAGE_KEY = "vibmail-notified-message-uuids";
export const LIVE_BROADCAST_CHANNEL_NAME = "vibmail-live-notifications";

export function loadNotifiedMessageUuids(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window !==
  "undefined"
    ? window.localStorage
    : null,
): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(NOTIFIED_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return new Set();
    const strings = parsed.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    return new Set(strings.slice(-MAX_NOTIFIED_MESSAGE_UUIDS));
  } catch {
    return new Set();
  }
}

export function saveNotifiedMessageUuids(
  uuids: Set<string>,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof window !==
  "undefined"
    ? window.localStorage
    : null,
): void {
  if (!storage) return;
  try {
    const bounded = Array.from(uuids).slice(-MAX_NOTIFIED_MESSAGE_UUIDS);
    storage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Private browsing or storage quota errors must not interrupt live updates.
  }
}

export async function claimMessageNotification(
  messageUuid: string,
  options: {
    readonly storage?: Pick<Storage, "getItem" | "setItem"> | null;
    readonly channel?: Pick<BroadcastChannel, "postMessage"> | null;
  } = {},
): Promise<boolean> {
  const storage =
    options.storage !== undefined
      ? options.storage
      : typeof window !== "undefined"
        ? window.localStorage
        : null;

  const attemptClaim = (): boolean => {
    const notified = loadNotifiedMessageUuids(storage);
    if (notified.has(messageUuid)) {
      return false;
    }
    notified.add(messageUuid);
    while (notified.size > MAX_NOTIFIED_MESSAGE_UUIDS) {
      const oldest = notified.values().next().value;
      if (!oldest) break;
      notified.delete(oldest);
    }
    saveNotifiedMessageUuids(notified, storage);
    options.channel?.postMessage({ type: "notified", uuid: messageUuid });
    return true;
  };

  if (
    typeof navigator !== "undefined" &&
    navigator.locks &&
    typeof navigator.locks.request === "function"
  ) {
    let claimed = false;
    await navigator.locks.request(
      `vibmail-notification-${messageUuid}`,
      async () => {
        claimed = attemptClaim();
      },
    );
    return claimed;
  }

  return attemptClaim();
}

export interface LiveWorkspaceNavigationBarProps {
  readonly visibleMailboxUuids?: readonly string[];
  readonly pollingEnabled?: boolean;
  readonly onLivePayload?: (payload: LiveUpdatePayload) => void;
}

export function LiveWorkspaceNavigationBar({
  visibleMailboxUuids = [],
  pollingEnabled = true,
  onLivePayload,
}: LiveWorkspaceNavigationBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported",
  );
  const cursorRef = useRef<number>(0);
  const bootstrappedRef = useRef<boolean>(false);
  const pollingRef = useRef<boolean>(false);
  const backoffRef = useRef<number>(5000);
  const timerRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onLivePayloadRef = useRef(onLivePayload);

  const visibleMailboxesKey = visibleMailboxUuids.slice(0, 50).join(",");

  useEffect(() => {
    onLivePayloadRef.current = onLivePayload;
  }, [onLivePayload]);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }
    try {
      const channel = new BroadcastChannel(LIVE_BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event) => {
        const data = event.data as { type?: string; uuid?: string } | null;
        if (data?.type === "notified" && typeof data.uuid === "string") {
          const notified = loadNotifiedMessageUuids();
          notified.add(data.uuid);
          saveNotifiedMessageUuids(notified);
        }
      };
      channelRef.current = channel;
      return () => {
        channel.close();
        channelRef.current = null;
      };
    } catch {
      return;
    }
  }, []);

  const dispatchMessageNotification = useCallback(
    async (message: LiveUpdateMessageItem) => {
      const claimed = await claimMessageNotification(message.uuid, {
        channel: channelRef.current,
      });
      if (!claimed) return;

      const subject = message.subject || "(No subject)";
      notify.success(`${message.mailbox}: ${subject}`);

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        window.Notification.permission === "granted"
      ) {
        try {
          const browserNotification = new window.Notification(
            `New email in ${message.mailbox}`,
            {
              body: `${message.sender_address || "Unknown sender"} — ${subject}`,
              tag: `vibmail-${message.uuid}`,
            },
          );
          browserNotification.onclick = () => {
            window.focus();
            router.push(message.detail_url);
          };
        } catch {
          // Browser notification errors must never interrupt UI updates.
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (!pollingEnabled || typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        void executePoll();
      }, delayMs);
    };

    const executePoll = async () => {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

      try {
        const params = new URLSearchParams({
          cursor: String(cursorRef.current),
        });
        if (!bootstrappedRef.current) {
          params.set("bootstrap", "1");
        }
        if (visibleMailboxesKey.length > 0) {
          params.set("mailboxes", visibleMailboxesKey);
        }

        const response = await fetch(
          `/api/messages/live?${params.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "X-MailStack-Live-Request": "1",
            },
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Live poll HTTP ${response.status}`);
        }

        const payload = (await response.json()) as LiveUpdatePayload;
        if (cancelled) return;

        const firstPoll = !bootstrappedRef.current;
        cursorRef.current = Number(payload.cursor || 0);
        bootstrappedRef.current = true;

        onLivePayloadRef.current?.(payload);

        if (!firstPoll && payload.messages.length > 0) {
          for (const msg of payload.messages) {
            await dispatchMessageNotification(msg);
          }
          router.refresh();
        }

        backoffRef.current = 5000;
        const nextDelay = payload.has_more
          ? 250
          : document.hidden
            ? 15_000
            : 5000;
        scheduleNext(nextDelay);
      } catch {
        backoffRef.current = Math.min(backoffRef.current * 2, 60_000);
        scheduleNext(backoffRef.current);
      } finally {
        window.clearTimeout(timeoutId);
        pollingRef.current = false;
      }
    };

    void executePoll();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [
    dispatchMessageNotification,
    pollingEnabled,
    router,
    visibleMailboxesKey,
  ]);

  async function handleEnableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const result = await window.Notification.requestPermission();
      setNotificationPermission(result);
      if (result === "granted") {
        notify.success("Desktop notifications enabled for new incoming mail.");
      } else if (result === "denied") {
        notify.error("Desktop notifications were blocked by your browser.");
      }
    } catch {
      notify.error("Unable to request browser notification permission.");
    }
  }

  const isOverview = pathname === "/users";
  const isMailboxes =
    pathname === "/users/mailboxes" || pathname.startsWith("/users/inbox/");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
      <nav
        aria-label="User workspace sections"
        className="flex flex-wrap items-center gap-1.5"
      >
        <Link
          href="/users"
          aria-current={isOverview ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors",
            isOverview
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon glyph={LayoutDashboard} />
          Overview
        </Link>
        <Link
          href="/users/mailboxes"
          aria-current={isMailboxes ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors",
            isMailboxes
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon glyph={Mail} />
          My Mailboxes
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Icon glyph={Inbox} className="size-3.5" />
          Receive-only mode
        </span>
        {notificationPermission === "default" ? (
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Icon glyph={Bell} className="size-3.5" />
            Enable notifications
          </button>
        ) : notificationPermission === "granted" ? (
          <span
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2.5 text-xs font-medium text-success"
            title="Desktop notifications active"
          >
            <Icon glyph={BellRing} className="size-3.5" />
            Notifications active
          </span>
        ) : null}
      </div>
    </div>
  );
}
