import { auth } from "@/auth";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import "server-only";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationDeniedError extends Error {
  constructor() {
    super("Authorization denied");
    this.name = "AuthorizationDeniedError";
  }
}

export async function getCurrentUser() {
  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId || !/^[1-9]\d*$/.test(sessionUserId)) return null;

    const user = await getPrismaClient().user.findUnique({
      where: { id: BigInt(sessionUserId) },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        isStaff: true,
        isSuperuser: true,
        passwordResetRequired: true,
      },
    });

    if (!user?.isActive || user.passwordResetRequired) return null;
    return user;
  } catch {
    logger.error("auth_current_user_lookup_failed");
    return null;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

export async function requireStaffUser() {
  const user = await requireCurrentUser();
  if (!user.isStaff) throw new AuthorizationDeniedError();
  return user;
}

export async function requireSuperuser() {
  const user = await requireCurrentUser();
  if (!user.isSuperuser) throw new AuthorizationDeniedError();
  return user;
}
