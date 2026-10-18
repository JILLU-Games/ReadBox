"use server";

import { completePasswordReset } from "@/core/auth/password-reset";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";

export interface PasswordResetState {
  status: "idle" | "success" | "invalid";
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
    return { status: "invalid" };
  }

  try {
    const completed = await completePasswordReset(
      getPrismaClient(),
      token,
      password,
      confirmation,
    );
    return { status: completed ? "success" : "invalid" };
  } catch {
    logger.error("password_reset_completion_failed");
    return { status: "invalid" };
  }
}
