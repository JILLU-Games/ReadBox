"use server";

import { env } from "@/config/env";
import { getUserControlSettings } from "@/core/accounts/user-control-policy";
import {
  completePasswordResetDetailed,
  requestPasswordReset,
} from "@/core/auth/password-reset";
import { extractClientIp } from "@/core/auth/proxy-request";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import { headers } from "next/headers";

export interface PasswordResetRequestState {
  readonly status: "idle" | "issued" | "invalid";
  readonly token?: string;
  readonly username?: string;
  readonly error?: string;
}

export interface PasswordResetState {
  readonly status: "idle" | "success" | "invalid";
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
}

export async function requestPasswordResetAction(
  _previousState: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const identifier = formData.get("identifier");
  if (typeof identifier !== "string" || !identifier.trim()) {
    return {
      status: "invalid",
      error: "Enter your username or email address.",
    };
  }

  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const prisma = !devDemoActive && env.databaseUrl ? getPrismaClient() : null;

  try {
    const reqHeaders = await headers();
    const clientIp = extractClientIp(reqHeaders, {
      trustProxyHeaders: env.trustProxyHeaders,
    });
    const userAgent = reqHeaders.get("user-agent") ?? "";

    const result = await requestPasswordReset(prisma, identifier, {
      devDemoActive,
      clientIp,
      userAgent,
    });

    if (!result.ok || !result.token) {
      return {
        status: "invalid",
        error:
          result.error ??
          "No active account matched that username or email address.",
      };
    }

    return {
      status: "issued",
      token: result.token,
      username: result.username,
    };
  } catch {
    logger.error("password_reset_request_failed");
    return {
      status: "invalid",
      error: "Could not issue a password reset token right now.",
    };
  }
}

export async function completePasswordResetAction(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  if (
    typeof token !== "string" ||
    typeof password !== "string" ||
    typeof confirmation !== "string"
  ) {
    return {
      status: "invalid",
      error: "Enter your reset token and new password.",
    };
  }

  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const prisma = !devDemoActive && env.databaseUrl ? getPrismaClient() : null;

  try {
    const [reqHeaders, userControl] = await Promise.all([
      headers(),
      getUserControlSettings(prisma),
    ]);
    const clientIp = extractClientIp(reqHeaders, {
      trustProxyHeaders: env.trustProxyHeaders,
    });
    const userAgent = reqHeaders.get("user-agent") ?? "";

    const result = await completePasswordResetDetailed(
      prisma,
      token,
      password,
      confirmation,
      {
        devDemoActive,
        clientIp,
        userAgent,
        policy: {
          minLength: Math.max(8, userControl.minPasswordLength),
          requireStrongPassword: userControl.requireStrongPassword,
        },
      },
    );

    if (!result.ok) {
      return {
        status: "invalid",
        error:
          result.error ??
          "Reset could not be completed. Check the token and password requirements.",
        fieldErrors: result.fieldErrors,
      };
    }

    return { status: "success" };
  } catch {
    logger.error("password_reset_completion_failed");
    return {
      status: "invalid",
      error:
        "Reset could not be completed. Check the token and password requirements.",
    };
  }
}
