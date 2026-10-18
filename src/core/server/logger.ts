import { env } from "@/config/env";
import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const sensitiveParts = [
  "password",
  "secret",
  "token",
  "cookie",
  "session",
  "authorization",
  "credential",
  "private_key",
  "privatekey",
  "message_body",
  "attachment_content",
  "contact_message",
];

function redact(value: unknown, key = ""): unknown {
  const normalizedKey = key.toLowerCase().replaceAll("-", "_");
  if (sensitiveParts.some((part) => normalizedKey.includes(part)))
    return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey),
      ]),
    );
  }
  return value;
}

function write(level: LogLevel, event: string, context: LogContext = {}) {
  if (levelWeight[level] < levelWeight[env.logLevel]) return;
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...(redact(context) as LogContext) })}\n`,
  );
}

export const logger = {
  debug: (event: string, context?: LogContext) =>
    write("debug", event, context),
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) =>
    write("error", event, context),
};
