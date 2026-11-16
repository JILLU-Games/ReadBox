"use server";

import { getCurrentServerSessionId } from "@/app/(workspace)/users/settings/current-session";
import { env } from "@/config/env";
import { getDemoUserControlSettings } from "@/core/accounts/user-control-policy";
import {
  revokeOtherUserSessions,
  revokeUserSessionById,
  updateUserPassword,
  updateUserProfile,
} from "@/core/accounts/user-profile";
import {
  type UserProfileActionResult,
  type UserProfileRecord,
  validateUserProfileInput,
} from "@/core/accounts/user-profile-schema";
import {
  revokeDevDemoOtherUserSessions,
  revokeDevDemoUserSessionById,
  updateDevDemoPassword,
  updateDevDemoProfile,
} from "@/core/auth/dev-demo-auth";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { isDemoPreviewWorkspaceActive } from "@/core/messages/demo-workspace";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export interface UpdateUserProfileActionInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
}

export interface UpdateUserPasswordActionInput {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
  readonly revokeOtherSessions: boolean;
}

function revalidateUserProfilePaths() {
  revalidatePath("/users", "layout");
  revalidatePath("/users");
  revalidatePath("/users/settings");
}

function parseUserBigIntId(rawId: string | bigint): bigint {
  try {
    return BigInt(rawId);
  } catch {
    return BigInt(0);
  }
}

export async function updateUserProfileAction(
  input: UpdateUserProfileActionInput,
): Promise<UserProfileActionResult<UserProfileRecord>> {
  const user = await requireWorkspaceUser();

  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const validated = validateUserProfileInput(input);
      if (!validated.ok) {
        return {
          ok: false,
          code: "validation",
          error: validated.error,
          fieldErrors: validated.fieldErrors,
        };
      }
      const updated = updateDevDemoProfile(user.id.toString(), validated.data);
      if (!updated) {
        return {
          ok: false,
          code: "not_found",
          error: "Account not found.",
        };
      }

      revalidateUserProfilePaths();
      return {
        ok: true,
        data: updated,
        message: "Profile settings saved.",
      };
    }

    return {
      ok: false,
      code: "unavailable",
      error: "Database is not configured in this environment.",
    };
  }

  const reqHeaders = await headers();
  const result = await updateUserProfile(
    getPrismaClient(),
    {
      userId: parseUserBigIntId(user.id),
      authSource: user.authSource,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    input,
  );

  if (result.ok) {
    revalidateUserProfilePaths();
  }

  return result;
}

export async function updateUserPasswordAction(
  input: UpdateUserPasswordActionInput,
): Promise<UserProfileActionResult<{ readonly revokedOtherSessions: number }>> {
  const user = await requireWorkspaceUser();
  const currentSessionId = await getCurrentServerSessionId();

  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const demoControl = getDemoUserControlSettings();
      const result = updateDevDemoPassword(
        user.id.toString(),
        input,
        currentSessionId,
        {
          minLength: Math.max(8, demoControl.minPasswordLength),
          requireStrongPassword: demoControl.requireStrongPassword,
        },
      );
      if (result.ok) {
        revalidateUserProfilePaths();
      }
      return result;
    }

    return {
      ok: false,
      code: "unavailable",
      error: "Database is not configured in this environment.",
    };
  }

  const reqHeaders = await headers();
  const result = await updateUserPassword(
    getPrismaClient(),
    {
      userId: parseUserBigIntId(user.id),
      authSource: user.authSource,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    input,
    { currentSessionId },
  );

  if (result.ok) {
    revalidateUserProfilePaths();
  }

  return result;
}

export async function revokeUserSessionAction(
  sessionId: string,
): Promise<UserProfileActionResult<{ readonly revoked: number }>> {
  const user = await requireWorkspaceUser();
  const currentSessionId = await getCurrentServerSessionId();

  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const result = revokeDevDemoUserSessionById(
        user.id.toString(),
        sessionId,
        currentSessionId,
      );
      if (result.ok) {
        revalidateUserProfilePaths();
      }
      return result;
    }

    return {
      ok: false,
      code: "unavailable",
      error: "Database is not configured in this environment.",
    };
  }

  const reqHeaders = await headers();
  const result = await revokeUserSessionById(
    getPrismaClient(),
    {
      userId: parseUserBigIntId(user.id),
      authSource: user.authSource,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    sessionId,
    { currentSessionId },
  );

  if (result.ok) {
    revalidateUserProfilePaths();
  }

  return result;
}

export async function revokeOtherUserSessionsAction(): Promise<
  UserProfileActionResult<{ readonly revoked: number }>
> {
  const user = await requireWorkspaceUser();
  const currentSessionId = await getCurrentServerSessionId();

  if (!env.databaseUrl) {
    if (isDemoPreviewWorkspaceActive()) {
      const result = revokeDevDemoOtherUserSessions(
        user.id.toString(),
        currentSessionId,
      );
      if (result.ok) {
        revalidateUserProfilePaths();
      }
      return result;
    }

    return {
      ok: false,
      code: "unavailable",
      error: "Database is not configured in this environment.",
    };
  }

  const reqHeaders = await headers();
  const result = await revokeOtherUserSessions(
    getPrismaClient(),
    {
      userId: parseUserBigIntId(user.id),
      authSource: user.authSource,
      headers: reqHeaders,
      trustProxyHeaders: env.trustProxyHeaders,
    },
    { currentSessionId },
  );

  if (result.ok) {
    revalidateUserProfilePaths();
  }

  return result;
}
