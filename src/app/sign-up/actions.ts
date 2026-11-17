"use server";

import { env } from "@/config/env";
import { extractClientIp } from "@/core/auth/proxy-request";
import {
  registerUserAccount,
  type RegisterUserResult,
  type SignUpFormInput,
} from "@/core/auth/sign-up";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function registerUserSignupAction(
  input: SignUpFormInput,
): Promise<RegisterUserResult> {
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";

  if (!env.databaseUrl && !devDemoActive) {
    return {
      ok: false,
      code: "unavailable",
      error:
        "Account registration is currently unavailable because the database is not configured.",
    };
  }

  let prisma = null;
  if (env.databaseUrl) {
    try {
      prisma = getPrismaClient();
    } catch (error) {
      logger.error("signup_database_unavailable", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      return {
        ok: false,
        code: "unavailable",
        error:
          "Account registration is temporarily unavailable. Please try again later.",
      };
    }
  }

  const reqHeaders = await headers();

  const result = await registerUserAccount(prisma, input, {
    devDemoActive,
    clientIp: extractClientIp(reqHeaders, {
      trustProxyHeaders: env.trustProxyHeaders,
    }),
    userAgent: reqHeaders.get("user-agent") ?? "",
  });

  if (result.ok) {
    revalidatePath("/vcon/users/control");
    revalidatePath("/vcon/users");
  }

  return result;
}
