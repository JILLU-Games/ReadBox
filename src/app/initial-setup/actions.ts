"use server";

import { env } from "@/config/env";
import { getPrismaClient } from "@/core/database/client";
import { activateInitialAdmin } from "@/core/setup/first-admin-activation";
import { headers } from "next/headers";

export type InitialSetupActionState =
  | { readonly status: "idle" }
  | { readonly status: "invalid"; readonly message: string }
  | { readonly status: "created"; readonly resetToken: string };

export async function createFirstAdminAction(
  _previous: InitialSetupActionState,
  formData: FormData,
): Promise<InitialSetupActionState> {
  const get = (name: string, max: number) => {
    const value = formData.get(name);
    return typeof value === "string" && value.length <= max ? value.trim() : "";
  };

  const request = {
    activationToken: get("activationToken", 100),
    username: get("username", 150),
    firstName: get("firstName", 150),
    lastName: get("lastName", 150),
    email: get("email", 254),
  };
  try {
    const h = await headers();
    const result = await activateInitialAdmin(getPrismaClient(), request, {
      nodeEnv: env.nodeEnv,
      dockerRuntime: process.env.DOCKER_RUNTIME === "true",
      authEnabled: env.authEnabled,
      authSecret: env.authSecret,
      databaseUrl: env.databaseUrl,
      expectedOrigin: process.env.AUTH_URL || process.env.PUBLIC_SITE_ORIGIN,
      requestOrigin: h.get("origin"),
      requestHost: h.get("x-forwarded-host") || h.get("host"),
      activationHash: process.env.READBOX_SETUP_TOKEN_SHA256,
      expiresAt: process.env.READBOX_SETUP_TOKEN_EXPIRES_AT,
    });
    if (!result.ok) {
      return {
        status: "invalid",
        message: result.reason === "unavailable"
          ? "Initial setup is unavailable. Use the local operator recovery procedure."
          : "Invalid or expired setup code, request origin, or account details.",
      };
    }
    // Token never enters query strings, logs, cookies or redirects. The
    // authenticated-password-reset contract remains owned by reset-password.
    return { status: "created", resetToken: result.resetToken };
  } catch {
    return {
      status: "invalid",
      message: "Initial setup is unavailable. Check the private server health.",
    };
  }
}
