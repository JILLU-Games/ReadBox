"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import type {
  LiveUpdateMessageItem,
  LiveUpdatePayload,
} from "@/core/messages/service";
import { Bell, LayoutDashboard, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const MAX_NOTIFIED_MESSAGE_UUIDS = 200;
export const NOTIFIED_STORAGE_KEY = "readbox-notified-message-uuids";
export const LIVE_BROADCAST_CHANNEL_NAME = "readbox-live-notifications";

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
      `readbox-notification-${messageUuid}`,
      async () => {
        claimed = attemptClaim();
      },
    );
    return claimed;
  }

  return attemptClaim();
}

interface UsersLiveContextValue {
  readonly active: boolean;
  readonly latestPayload: LiveUpdatePayload | null;
  readonly syncDegraded: boolean;
  readonly openCreateMailboxModal?: () => void;
}

const UsersLiveContext = createContext<UsersLiveContextValue>({
  active: false,
  latestPayload: null,
  syncDegraded: false,
});

export function useUsersLiveUpdates(): UsersLiveContextValue {
  return useContext(UsersLiveContext);
}

export function useLiveMailPoller({
  visibleMailboxUuids = [],
  pollingEnabled = true,
  onLivePayload,
}: {
  readonly visibleMailboxUuids?: readonly string[];
  readonly pollingEnabled?: boolean;
  readonly onLivePayload?: (payload: LiveUpdatePayload) => void;
}) {
  const router = useRouter();
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported",
  );
  const [syncDegraded, setSyncDegraded] = useState(false);
  const cursorRef = useRef<number>(0);
  const bootstrappedRef = useRef<boolean>(false);
  const lastSnapshotSignatureRef = useRef<string | null>(null);
  const pollingRef = useRef<boolean>(false);
  const backoffRef = useRef<number>(5000);
  const consecutiveFailuresRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const sessionExpiredNotifiedRef = useRef<boolean>(false);
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
              tag: `readbox-${message.uuid}`,
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
              "X-ReadBox-Live-Request": "1",
            },
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (response.status === 401) {
          cancelled = true;
          setSyncDegraded(true);
          if (!sessionExpiredNotifiedRef.current) {
            sessionExpiredNotifiedRef.current = true;
            notify.error(
              "Your session has expired. Sign in again to resume live mailbox updates.",
            );
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Live poll HTTP ${response.status}`);
        }

        const payload = (await response.json()) as LiveUpdatePayload;
        if (cancelled) return;

        const firstPoll = !bootstrappedRef.current;
        cursorRef.current = Number(payload.cursor || 0);
        bootstrappedRef.current = true;

        const nextSignature = JSON.stringify({
          summary: payload.summary,
          mailboxes: (payload.mailboxes ?? []).map((m) => [
            m.uuid,
            m.status,
            m.total_messages,
            m.unread_messages,
          ]),
        });
        const stateChanged =
          !firstPoll &&
          lastSnapshotSignatureRef.current !== null &&
          lastSnapshotSignatureRef.current !== nextSignature;
        lastSnapshotSignatureRef.current = nextSignature;

        onLivePayloadRef.current?.(payload);
        if (Array.isArray(payload.mailboxes)) {
          window.dispatchEvent(
            new CustomEvent("readbox:live-mailboxes-updated", {
              detail: payload.mailboxes,
            }),
          );
        }

        if (!firstPoll && payload.messages.length > 0) {
          for (const msg of payload.messages) {
            await dispatchMessageNotification(msg);
          }
          router.refresh();
        } else if (stateChanged) {
          router.refresh();
        }

        consecutiveFailuresRef.current = 0;
        setSyncDegraded(false);
        backoffRef.current = 5000;
        const nextDelay = payload.has_more
          ? 250
          : document.hidden
            ? 15_000
            : 5000;
        scheduleNext(nextDelay);
      } catch {
        consecutiveFailuresRef.current += 1;
        if (!cancelled && consecutiveFailuresRef.current >= 2) {
          setSyncDegraded(true);
        }
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

  const handleEnableNotifications = useCallback(async () => {
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
  }, []);

  return {
    notificationPermission,
    handleEnableNotifications,
    syncDegraded,
  };
}

export function UsersLiveProvider({
  visibleMailboxUuids,
  pollingEnabled,
  openCreateMailboxModal,
  children,
}: {
  readonly visibleMailboxUuids: readonly string[];
  readonly pollingEnabled: boolean;
  readonly openCreateMailboxModal?: () => void;
  readonly children: (controls: {
    notificationPermission: NotificationPermission | "unsupported";
    handleEnableNotifications: () => Promise<void>;
    syncDegraded: boolean;
  }) => ReactNode;
}) {
  const [latestPayload, setLatestPayload] = useState<LiveUpdatePayload | null>(
    null,
  );
  const { notificationPermission, handleEnableNotifications, syncDegraded } =
    useLiveMailPoller({
      visibleMailboxUuids,
      pollingEnabled,
      onLivePayload: setLatestPayload,
    });

  return (
    <UsersLiveContext.Provider
      value={{
        active: true,
        latestPayload,
        syncDegraded,
        openCreateMailboxModal,
      }}
    >
      {children({
        notificationPermission,
        handleEnableNotifications,
        syncDegraded,
      })}
    </UsersLiveContext.Provider>
  );
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
  const liveContext = useUsersLiveUpdates();
  const onLivePayloadRef = useRef(onLivePayload);
  useEffect(() => {
    onLivePayloadRef.current = onLivePayload;
  }, [onLivePayload]);

  const { notificationPermission, handleEnableNotifications } =
    useLiveMailPoller({
      visibleMailboxUuids,
      pollingEnabled: pollingEnabled && !liveContext.active,
      onLivePayload,
    });

  useEffect(() => {
    if (liveContext.active && liveContext.latestPayload) {
      onLivePayloadRef.current?.(liveContext.latestPayload);
    }
  }, [liveContext.active, liveContext.latestPayload]);

  // When mounted inside UsersWorkspaceShell, the unified top bar handles nav & notifications.
  if (liveContext.active) {
    return null;
  }

  const isOverview = pathname === "/users";
  const isMailboxes =
    pathname === "/users/mailboxes" || pathname.startsWith("/users/inbox/");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-2.5 py-1.5">
      <nav
        aria-label="User workspace sections"
        className="flex flex-wrap items-center gap-1"
      >
        <Button
          asChild
          size="sm"
          variant={isOverview ? "default" : "ghost"}
        >
          <Link href="/users" aria-current={isOverview ? "page" : undefined}>
            <Icon glyph={LayoutDashboard} />
            Overview
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={isMailboxes ? "default" : "ghost"}
        >
          <Link
            href="/users/mailboxes"
            aria-current={isMailboxes ? "page" : undefined}
          >
            <Icon glyph={Mail} />
            My Mailboxes
          </Link>
        </Button>
      </nav>

      {notificationPermission === "default" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleEnableNotifications}
          >
            <Icon glyph={Bell} />
            Enable notifications
          </Button>
        </div>
      ) : null}
    </div>
  );
}
