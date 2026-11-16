"use server";

import { env } from "@/config/env";
import { extractClientIp } from "@/core/auth/proxy-request";
import {
  registerUserAccount,
  type RegisterUserResult,
  type SignUpFormInput,
} from "@/core/auth/sign-up";
import { getPrismaClient } from "@/core/database/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function registerUserSignupAction(
  input: SignUpFormInput,
): Promise<RegisterUserResult> {
  const devDemoActive =
    !env.databaseUrl ||
    (env.nodeEnv === "development" && env.devAuthMode === "demo");
  const prisma = env.databaseUrl ? getPrismaClient() : null;
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
