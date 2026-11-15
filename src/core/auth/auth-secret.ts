import { env } from "@/config/env";
import { randomBytes } from "node:crypto";
import "server-only";

const globalForAuthSecret = globalThis as typeof globalThis & {
  mailstackDevAuthSecret?: string;
};

export function getAuthSecret(): string {
  if (env.authSecret) return env.authSecret;

  if (env.nodeEnv === "production" && env.authEnabled) {
    throw new Error("AUTH_SECRET is required when AUTH_ENABLED=true");
  }

  globalForAuthSecret.mailstackDevAuthSecret ??=
    randomBytes(32).toString("base64url");
  return globalForAuthSecret.mailstackDevAuthSecret;
}
