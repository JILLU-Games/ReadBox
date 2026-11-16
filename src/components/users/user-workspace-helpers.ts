export const USA_FIRST_NAMES = [
  "james",
  "olivia",
  "liam",
  "emma",
  "noah",
  "charlotte",
  "ethan",
  "amelia",
  "lucas",
  "sophia",
  "mason",
  "isabella",
  "logan",
  "harper",
  "elijah",
  "evelyn",
  "aiden",
  "abigail",
  "jackson",
  "emily",
  "henry",
  "elizabeth",
  "alex",
  "chloe",
] as const;

export const USA_LAST_NAMES = [
  "smith",
  "johnson",
  "williams",
  "brown",
  "jones",
  "miller",
  "davis",
  "garcia",
  "rodriguez",
  "wilson",
  "martinez",
  "anderson",
  "taylor",
  "thomas",
  "moore",
  "jackson",
  "martin",
  "lee",
  "perez",
  "thompson",
  "white",
  "harris",
  "clark",
] as const;

export function sanitizeLocalPartInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._+-]/g, "");
}

export function generateUsaMailboxSuggestions(
  count = 3,
  randomFn: () => number = Math.random,
): string[] {
  const target = Math.max(1, Math.min(count, 10));
  const generated: string[] = [];
  let attempts = 0;

  while (generated.length < target && attempts < target * 12) {
    attempts += 1;
    const first =
      USA_FIRST_NAMES[Math.floor(randomFn() * USA_FIRST_NAMES.length)] ??
      "james";
    const last =
      USA_LAST_NAMES[Math.floor(randomFn() * USA_LAST_NAMES.length)] ?? "smith";
    const suffix = Math.floor(10 + randomFn() * 89);
    const formats = [
      `${first}.${last}`,
      `${first.slice(0, 1)}.${last}`,
      `${first}${suffix}`,
    ];
    const candidate =
      formats[Math.floor(randomFn() * formats.length)] ?? `${first}.${last}`;
    if (!generated.includes(candidate)) {
      generated.push(candidate);
    }
  }

  return generated;
}

export function generateRandomUsaLocalPart(
  randomFn: () => number = Math.random,
): string {
  const first =
    USA_FIRST_NAMES[Math.floor(randomFn() * USA_FIRST_NAMES.length)] ?? "logan";
  const last =
    USA_LAST_NAMES[Math.floor(randomFn() * USA_LAST_NAMES.length)] ?? "clark";
  const num = Math.floor(10 + randomFn() * 90);
  return `${first}.${last}${num}`;
}

export function formatMessageByteSize(bytes: number | string): string {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCompactTimestamp(
  value: string | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function formatShortInboxDate(
  value: string | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

export interface MailboxesUrlParams {
  readonly q?: string;
  readonly status?: string;
  readonly page?: number;
}

export function buildMailboxesUrl(params: MailboxesUrlParams = {}): string {
  const search = new URLSearchParams();
  const q = params.q?.trim();
  if (q) search.set("q", q);
  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }
  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }
  const qs = search.toString();
  return qs ? `/users/mailboxes?${qs}` : "/users/mailboxes";
}

export interface InboxUrlParams {
  readonly q?: string;
  readonly read?: string;
  readonly attachments?: string;
  readonly page?: number;
}

export function buildInboxQueryString(params: InboxUrlParams = {}): string {
  const search = new URLSearchParams();
  const q = params.q?.trim();
  if (q) search.set("q", q);
  if (params.read && params.read !== "all") {
    search.set("read", params.read);
  }
  if (params.attachments && params.attachments !== "all") {
    search.set("attachments", params.attachments);
  }
  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }
  return search.toString();
}

export function buildInboxUrl(
  mailboxUuid: string,
  params: InboxUrlParams = {},
): string {
  const qs = buildInboxQueryString(params);
  return qs
    ? `/users/inbox/${mailboxUuid}?${qs}`
    : `/users/inbox/${mailboxUuid}`;
}

export function buildMessageUrl(
  mailboxUuid: string,
  messageUuid: string,
  params: InboxUrlParams = {},
): string {
  const qs = buildInboxQueryString(params);
  return qs
    ? `/users/inbox/${mailboxUuid}/${messageUuid}?${qs}`
    : `/users/inbox/${mailboxUuid}/${messageUuid}`;
}

export async function copyTextWithFallback(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback to execCommand below.
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  } catch {
    return false;
  }
}
