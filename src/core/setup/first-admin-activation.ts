import {
  bootstrapInitialAdminAccount,
  type InitialAccountInput,
} from "@/core/auth/operator-bootstrap";
import type { PrismaClient } from "@prisma/client";
import { createHash, timingSafeEqual } from "node:crypto";
import "server-only";

/**
 * QIS-01: Browser-only initial-admin activation.
 * Existing R-04 transaction owns duplicate-admin checks and the AdminAccount
 * source of truth; this module only authorizes its one-time invocation.
 * A successful call returns the existing 15-minute reset token to the owner
 * through the HTTPS server action response (never a URL or a server log).
 */
export interface InitialAdminContext {
  readonly nodeEnv: string;
  readonly dockerRuntime: boolean;
  readonly authEnabled: boolean;
  readonly authSecret: string | undefined;
  readonly databaseUrl: string | undefined;
  readonly expectedOrigin: string | undefined;
  readonly requestOrigin: string | null;
  readonly requestHost: string | null;
  readonly activationHash: string | undefined;
  readonly expiresAt: string | undefined;
  readonly now?: number;
}

const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export function isInitialAdminActivationAllowed(
  token: string,
  context: InitialAdminContext,
): boolean {
  if (
    context.nodeEnv !== "production" ||
    !context.dockerRuntime ||
    !context.authEnabled ||
    (context.authSecret?.length ?? 0) < 32 ||
    !OPAQUE_TOKEN.test(token) ||
    !SHA256.test(context.activationHash ?? "") ||
    !/^[0-9]{10,13}$/.test(context.expiresAt ?? "")
  ) return false;

  const expirySeconds = Number(context.expiresAt);
  const now = context.now ?? Date.now();
  if (!Number.isSafeInteger(expirySeconds) || expirySeconds * 1000 <= now ||
      expirySeconds * 1000 > now + 24 * 60 * 60 * 1000) return false;

  try {
    const db = new URL(context.databaseUrl ?? "");
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      db.hostname !== "postgres" || db.port !== "5432" ||
      !/^\/[A-Za-z0-9_]+$/.test(db.pathname)
    ) return false;

    const observed = new URL(context.requestOrigin ?? "");
    if (observed.protocol !== "https:" || observed.username || observed.password ||
        observed.pathname !== "/" || observed.search || observed.hash ||
        observed.host !== context.requestHost) return false;

    if (context.expectedOrigin) {
      const expected = new URL(context.expectedOrigin);
      if (expected.protocol !== "https:" || expected.origin !== observed.origin ||
          expected.pathname !== "/" || expected.search || expected.hash) return false;
    }
  } catch {
    return false;
  }

  const candidate = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  const expected = Buffer.from(context.activationHash!, "hex");
  return timingSafeEqual(candidate, expected);
}

export interface ActivateInitialAdminRequest extends InitialAccountInput {
  readonly activationToken: string;
}

export type ActivateInitialAdminResult =
  | { readonly ok: true; readonly resetToken: string }
  | { readonly ok: false; readonly reason: "unavailable" | "invalid" };

export async function activateInitialAdmin(
  prisma: PrismaClient,
  request: ActivateInitialAdminRequest,
  context: InitialAdminContext,
): Promise<ActivateInitialAdminResult> {
  if (
    !isInitialAdminActivationAllowed(request.activationToken, context) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(request.username) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email) ||
    request.email.length > 254 ||
    request.firstName.length > 150 ||
    request.lastName.length > 150
  ) return { ok: false, reason: "invalid" };

  try {
    // This function takes the R-04 PostgreSQL advisory transaction lock and
    // refuses any existing admin/legacy superuser or colliding username.
    const result = await bootstrapInitialAdminAccount(prisma, request);
    return result
      ? { ok: true, resetToken: result.resetToken }
      : { ok: false, reason: "unavailable" };
  } catch {
    // No DB diagnostics or credential material reach an anonymous response.
    return { ok: false, reason: "unavailable" };
  }
}
