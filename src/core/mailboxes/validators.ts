import { isIP } from "node:net";

export const LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
export const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const RESERVED_LOCAL_PARTS = new Set<string>([
  "root",
  "admin",
  "administrator",
  "webmaster",
  "hostmaster",
  "mailer-daemon",
  "noreply",
  "no-reply",
  "security",
  "system",
  "support-system",
  "postmaster",
  "abuse",
]);

export const SYSTEM_MAILBOX_LOCAL_PARTS = ["postmaster", "abuse"] as const;
export type SystemMailboxLocalPart =
  (typeof SYSTEM_MAILBOX_LOCAL_PARTS)[number];

export class MailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailValidationError";
  }
}

export function normalizeLocalPart(value: string): string {
  return (value ?? "").trim().toLowerCase();
}

export function validateLocalPart(
  value: string,
  options: { readonly allowReserved?: boolean } = {},
): string {
  const normalized = normalizeLocalPart(value);
  if (!normalized) {
    throw new MailValidationError("Mailbox local part is required.");
  }
  if (normalized.length > 64) {
    throw new MailValidationError(
      "Mailbox local part must not exceed 64 characters.",
    );
  }
  if (normalized.includes("..")) {
    throw new MailValidationError("Consecutive dots are not allowed.");
  }
  if (
    /\s/.test(normalized) ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new MailValidationError(
      "Whitespace and path separators are not allowed.",
    );
  }
  if (!LOCAL_PART_PATTERN.test(normalized)) {
    throw new MailValidationError(
      "Use lowercase letters, numbers, dot, underscore, or hyphen; begin and end with a letter or number.",
    );
  }
  if (!options.allowReserved && RESERVED_LOCAL_PARTS.has(normalized)) {
    throw new MailValidationError("This mailbox local part is reserved.");
  }
  return normalized;
}

export function normalizeDomain(value: string): string {
  return (value ?? "").trim().replace(/\.+$/, "").toLowerCase();
}

export function validateDomain(value: string): string {
  const normalized = normalizeDomain(value);
  if (!normalized) {
    throw new MailValidationError("Domain name is required.");
  }
  if (
    normalized.length > 253 ||
    normalized.includes("@") ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    /\s/.test(normalized)
  ) {
    throw new MailValidationError("Enter a valid DNS hostname.");
  }
  if (isIP(normalized) !== 0) {
    throw new MailValidationError("IP literals cannot be used as mail domains.");
  }
  const labels = normalized.split(".");
  if (
    labels.length < 2 ||
    labels.some((label) => !HOSTNAME_LABEL_PATTERN.test(label))
  ) {
    throw new MailValidationError(
      "Enter a valid DNS hostname with safe labels.",
    );
  }
  return normalized;
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}
