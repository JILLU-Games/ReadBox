import { env } from "@/config/env";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const CSRF_COOKIE_NAME = "vm_contact_session";
export const CSRF_HEADER_NAME = "x-readbox-csrf";
export const CSRF_TTL_SECONDS = 1200; // 20 minutes
export const MAX_BODY_BYTES = 32 * 1024; // 32 KiB
export const MIN_FORM_AGE_MS = 2_500;
export const MAX_FORM_AGE_MS = 86_400_000;

export const SERVICE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  personal: "Account & Personal Workspace",
  team: "Team Mailboxes & Quota Policy",
  business: "Custom Domain & Enterprise Setup",
  other: "Technical Support & General Inquiry",
});

export const TEAM_SIZE_VALUES = new Set(["", "1", "2-5", "6-20", "21-50", "50+"]);

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const PHONE_RE = /^[0-9+().\-\s]{6,40}$/;

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      return true;
    }
  }
  return false;
}

interface CsrfTokenEntry {
  readonly sessionHash: string;
  readonly tokenHash: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  usedAt: number | null;
}

interface SubmissionRateEntry {
  readonly requestId: string;
  readonly ipHash: string;
  readonly emailHash: string;
  readonly createdAt: number;
  readonly cleaned: CleanedContactSubmission;
}

export interface CleanedContactSubmission {
  readonly full_name: string;
  readonly work_email: string;
  readonly company: string;
  readonly phone: string;
  readonly service_type: string;
  readonly team_size: string;
  readonly message: string;
}

const csrfTokensStore = new Map<string, CsrfTokenEntry>();
const submissionsStore: SubmissionRateEntry[] = [];

function getSecretKey(): string {
  return (
    env.authSecret ||
    process.env.CONTACT_SECRET_KEY ||
    "readbox-public-contact-default-hmac-secret-key-2026"
  );
}

export function digestContactValue(value: string): string {
  return createHmac("sha256", getSecretKey()).update(value, "utf8").digest("hex");
}

function pruneExpiredState(nowSeconds: number): void {
  const cutoffCsrf = nowSeconds - 3600;
  for (const [key, entry] of csrfTokensStore.entries()) {
    if (entry.expiresAt < nowSeconds || (entry.usedAt !== null && entry.usedAt < cutoffCsrf)) {
      csrfTokensStore.delete(key);
    }
  }

  const cutoffSubmissions = nowSeconds - 86_400 * 2;
  while (submissionsStore.length > 0 && submissionsStore[0]!.createdAt < cutoffSubmissions) {
    submissionsStore.shift();
  }
}

export function resetContactServiceStateForTests(): void {
  csrfTokensStore.clear();
  submissionsStore.length = 0;
}

export function issueContactCsrfToken(nowMs: number = Date.now()): {
  readonly token: string;
  readonly sessionValue: string;
  readonly expiresIn: number;
  readonly cookieHeader: string;
} {
  const nowSeconds = Math.floor(nowMs / 1000);
  pruneExpiredState(nowSeconds);

  const sessionValue = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = nowSeconds + CSRF_TTL_SECONDS;
  const sessionHash = digestContactValue(`session:${sessionValue}`);
  const payload = `${nonce}.${expiresAt}`;
  const signature = createHmac("sha256", getSecretKey())
    .update(`${sessionHash}.${payload}`, "utf8")
    .digest("base64url");
  const token = `${payload}.${signature}`;
  const tokenHash = digestContactValue(`token:${token}`);

  csrfTokensStore.set(`${sessionHash}:${tokenHash}`, {
    sessionHash,
    tokenHash,
    createdAt: nowSeconds,
    expiresAt,
    usedAt: null,
  });

  const secureFlag = env.nodeEnv === "production" ? "Secure; " : "";
  const cookieHeader = `${CSRF_COOKIE_NAME}=${encodeURIComponent(sessionValue)}; Path=/; Max-Age=${CSRF_TTL_SECONDS}; ${secureFlag}HttpOnly; SameSite=Strict`;

  return {
    token,
    sessionValue,
    expiresIn: CSRF_TTL_SECONDS,
    cookieHeader,
  };
}

export function consumeContactCsrfToken(
  sessionValue: string | null | undefined,
  tokenValue: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const session = (sessionValue ?? "").trim();
  const token = (tokenValue ?? "").trim();
  if (!session || !token) {
    return false;
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  pruneExpiredState(nowSeconds);

  const sessionHash = digestContactValue(`session:${session}`);
  const tokenHash = digestContactValue(`token:${token}`);
  const storeKey = `${sessionHash}:${tokenHash}`;
  const stored = csrfTokensStore.get(storeKey);

  if (stored) {
    if (stored.usedAt !== null || stored.expiresAt < nowSeconds) {
      return false;
    }
    stored.usedAt = nowSeconds;
    return true;
  }

  // Fallback stateless verification if token was issued before a worker reload,
  // then mark it as used so it cannot be replayed.
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [nonce, expiresRaw, signature] = parts;
  if (!nonce || !expiresRaw || !signature) {
    return false;
  }
  const expiresAt = Number.parseInt(expiresRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < nowSeconds) {
    return false;
  }

  const expectedSig = createHmac("sha256", getSecretKey())
    .update(`${sessionHash}.${nonce}.${expiresRaw}`, "utf8")
    .digest("base64url");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  csrfTokensStore.set(storeKey, {
    sessionHash,
    tokenHash,
    createdAt: expiresAt - CSRF_TTL_SECONDS,
    expiresAt,
    usedAt: nowSeconds,
  });

  return true;
}

function cleanTextField(
  payload: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
  required = true,
): { readonly value: string; readonly error: string | null } {
  const raw = payload[field] ?? "";
  if (typeof raw !== "string") {
    return { value: "", error: "Invalid value." };
  }

  const value = raw.trim();
  if (required && !value) {
    return { value: "", error: "This field is required." };
  }
  if (!value) {
    return { value: "", error: null };
  }
  if (value.length < minimum) {
    return { value: "", error: `Enter at least ${minimum} characters.` };
  }
  if (value.length > maximum) {
    return { value: "", error: `Enter no more than ${maximum} characters.` };
  }
  if (hasControlCharacters(value)) {
    return { value: "", error: "Unsupported characters were detected." };
  }

  return { value, error: null };
}

export function validateContactPayload(
  payload: Record<string, unknown>,
  options?: { readonly nowMs?: number; readonly bypassTimingCheck?: boolean },
): {
  readonly cleaned: CleanedContactSubmission;
  readonly errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const nowMs = options?.nowMs ?? Date.now();

  const fullNameResult = cleanTextField(payload, "full_name", 2, 100, true);
  if (fullNameResult.error) {
    errors.full_name = fullNameResult.error;
  }

  const workEmailResult = cleanTextField(payload, "work_email", 5, 254, true);
  let normalizedEmail = "";
  if (workEmailResult.error) {
    errors.work_email = workEmailResult.error;
  } else {
    normalizedEmail = workEmailResult.value.toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      errors.work_email = "Enter a valid email address.";
    }
  }

  const companyResult = cleanTextField(payload, "company", 1, 120, false);
  if (companyResult.error) {
    errors.company = companyResult.error;
  }

  const phoneResult = cleanTextField(payload, "phone", 1, 40, false);
  if (phoneResult.error) {
    errors.phone = phoneResult.error;
  } else if (phoneResult.value && !PHONE_RE.test(phoneResult.value)) {
    errors.phone = "Enter a valid phone number.";
  }

  const rawServiceType = payload.service_type;
  const serviceType =
    typeof rawServiceType === "string" && rawServiceType in SERVICE_LABELS
      ? rawServiceType
      : "";
  if (!serviceType) {
    errors.service_type = "Select a valid mailbox requirement.";
  }

  const rawTeamSize = payload.team_size ?? "";
  const teamSize =
    typeof rawTeamSize === "string" && TEAM_SIZE_VALUES.has(rawTeamSize)
      ? rawTeamSize
      : null;
  if (teamSize === null) {
    errors.team_size = "Select a valid team size.";
  }

  const messageResult = cleanTextField(payload, "message", 20, 2_000, true);
  if (messageResult.error) {
    errors.message = messageResult.error;
  }

  if (payload.consent !== true) {
    errors.consent = "Consent is required.";
  }

  const honeypot = payload.website ?? "";
  if (typeof honeypot !== "string" || honeypot.trim().length > 0) {
    errors._spam = "Submission rejected.";
  }

  if (!options?.bypassTimingCheck) {
    const startedRaw = payload.form_started_at;
    const startedMs =
      typeof startedRaw === "number"
        ? startedRaw
        : typeof startedRaw === "string" && startedRaw.trim() !== ""
          ? Number.parseInt(startedRaw, 10)
          : Number.NaN;

    if (!Number.isFinite(startedMs)) {
      errors._spam = "Submission timing was invalid.";
    } else {
      const ageMs = nowMs - startedMs;
      if (ageMs < MIN_FORM_AGE_MS || ageMs > MAX_FORM_AGE_MS) {
        errors._spam = "Submission timing was invalid.";
      }
    }
  }

  return {
    cleaned: {
      full_name: fullNameResult.value,
      work_email: normalizedEmail,
      company: companyResult.value,
      phone: phoneResult.value,
      service_type: serviceType,
      team_size: teamSize ?? "",
      message: messageResult.value,
    },
    errors,
  };
}

export function checkContactRateLimit(
  ipHash: string,
  emailHash: string,
  nowMs: number = Date.now(),
): { readonly allowed: boolean; readonly retryAfterSeconds: number } {
  const nowSeconds = Math.floor(nowMs / 1000);
  pruneExpiredState(nowSeconds);

  let ip15m = 0;
  let ipDay = 0;
  let emailHour = 0;

  for (const item of submissionsStore) {
    if (item.ipHash === ipHash) {
      if (item.createdAt >= nowSeconds - 900) {
        ip15m += 1;
      }
      if (item.createdAt >= nowSeconds - 86_400) {
        ipDay += 1;
      }
    }
    if (item.emailHash === emailHash && item.createdAt >= nowSeconds - 3_600) {
      emailHour += 1;
    }
  }

  if (ip15m >= 5) {
    return { allowed: false, retryAfterSeconds: 900 };
  }
  if (ipDay >= 20) {
    return { allowed: false, retryAfterSeconds: 86_400 };
  }
  if (emailHour >= 3) {
    return { allowed: false, retryAfterSeconds: 3_600 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordContactSubmission(options: {
  readonly requestIp: string;
  readonly cleaned: CleanedContactSubmission;
  readonly headers?: Pick<Headers, "get">;
  readonly prisma?: AuditWriteClient | null;
  readonly nowMs?: number;
}): Promise<{
  readonly ok: true;
  readonly requestId: string;
} | {
  readonly ok: false;
  readonly status: 429;
  readonly retryAfterSeconds: number;
  readonly message: string;
}> {
  const nowMs = options.nowMs ?? Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  const ipHash = digestContactValue(`ip:${options.requestIp || "127.0.0.1"}`);
  const emailHash = digestContactValue(`email:${options.cleaned.work_email}`);

  const rateLimit = checkContactRateLimit(ipHash, emailHash, nowMs);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      message: "Too many inquiries were submitted. Please wait before trying again.",
    };
  }

  const requestId = randomBytes(16).toString("hex");
  submissionsStore.push({
    requestId,
    ipHash,
    emailHash,
    createdAt: nowSeconds,
    cleaned: options.cleaned,
  });

  const client =
    options.prisma !== undefined
      ? options.prisma
      : env.databaseUrl
        ? (getPrismaClient() as unknown as AuditWriteClient)
        : null;

  if (client) {
    try {
      await recordAudit(client, {
        actorId: null,
        action: "public_contact_submitted",
        targetType: "contact_inquiry",
        targetIdentifier: requestId,
        headers: options.headers,
        details: {
          service_type: options.cleaned.service_type,
          service_label: SERVICE_LABELS[options.cleaned.service_type] ?? options.cleaned.service_type,
          team_size: options.cleaned.team_size || "not_specified",
          work_email_domain: options.cleaned.work_email.split("@")[1] ?? "",
          has_company: Boolean(options.cleaned.company),
          has_phone: Boolean(options.cleaned.phone),
        },
      });
    } catch (error) {
      logger.warn("contact_inquiry_audit_fallback", {
        request_id: requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      });
    }
  }

  logger.info("public_contact_inquiry_received", {
    request_id: requestId,
    service_type: options.cleaned.service_type,
  });

  return {
    ok: true,
    requestId,
  };
}
