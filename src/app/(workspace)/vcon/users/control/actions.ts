"use server";

import { env } from "@/config/env";
import {
  updateUserControlSettings,
  updateUserExtendedPolicy,
  type ExtendedUserAccessPolicyShape,
  type UserControlSettingsShape,
} from "@/core/accounts/user-control-policy";
import { extractClientIp } from "@/core/auth/proxy-request";
import { requireAdminUser } from "@/core/auth/route-guards";
import { updatePendingUserVerification } from "@/core/auth/sign-up";
import { getPrismaClient } from "@/core/database/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export interface SaveUserControlSettingsActionResult {
  readonly ok: boolean;
  readonly settings?: UserControlSettingsShape;
  readonly message?: string;
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
}

export async function saveUserControlSettingsAction(
  input: unknown,
): Promise<SaveUserControlSettingsActionResult> {
  const admin = await requireAdminUser();
  const reqHeaders = await headers();
  const prisma = env.databaseUrl ? getPrismaClient() : null;

  const result = await updateUserControlSettings(prisma, input, {
    actorId: admin.id,
    clientIp: extractClientIp(reqHeaders, {
      trustProxyHeaders: env.trustProxyHeaders,
    }),
    userAgent: reqHeaders.get("user-agent") ?? "",
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/vcon/users/control");
  revalidatePath("/sign-up");
  revalidatePath("/users");
  revalidatePath("/users/mailboxes");

  return {
    ok: true,
    settings: result.settings,
    message: "Users control policy saved.",
  };
}

export async function decidePendingUserAction(
  userId: string,
  decision: "verified" | "rejected",
): Promise<{ readonly ok: boolean; readonly message?: string; readonly error?: string }> {
  const admin = await requireAdminUser();
  const reqHeaders = await headers();
  const prisma = env.databaseUrl ? getPrismaClient() : null;
  const devDemoActive =
    !env.databaseUrl ||
    (env.nodeEnv === "development" && env.devAuthMode === "demo");

  const result = await updatePendingUserVerification(prisma, userId, decision, {
    devDemoActive,
    actorId: admin.id,
    clientIp: extractClientIp(reqHeaders, {
      trustProxyHeaders: env.trustProxyHeaders,
    }),
    userAgent: reqHeaders.get("user-agent") ?? "",
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Could not update user registration status.",
    };
  }

  revalidatePath("/vcon/users/control");
  revalidatePath("/vcon/users");

  return {
    ok: true,
    message:
      decision === "verified"
        ? "User registration approved and account activated."
        : "User registration rejected.",
  };
}

export async function saveUserPolicyOverrideAction(
  userId: string,
  input: unknown,
): Promise<{
  readonly ok: boolean;
  readonly policy?: ExtendedUserAccessPolicyShape;
  readonly message?: string;
  readonly error?: string;
}> {
  const admin = await requireAdminUser();
  const reqHeaders = await headers();
  const prisma = env.databaseUrl ? getPrismaClient() : null;

  const result = await updateUserExtendedPolicy(prisma, userId, input, {
    actorId: admin.id,
    clientIp: extractClientIp(reqHeaders, {
      trustProxyHeaders: env.trustProxyHeaders,
    }),
    userAgent: reqHeaders.get("user-agent") ?? "",
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  revalidatePath("/vcon/users/control");
  revalidatePath("/vcon/users");
  revalidatePath("/users");
  revalidatePath("/users/mailboxes");

  return {
    ok: true,
    policy: result.policy,
    message: "User permission override updated.",
  };
}
