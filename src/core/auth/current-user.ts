import { auth } from "@/auth";
import { env } from "@/config/env";
import { getAccountRoleFlags } from "@/core/accounts/policy";
import {
  getDevBypassUser,
  getDevDemoUserById,
} from "@/core/auth/dev-demo-auth";
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
  if (env.nodeEnv === "development" && env.devAuthMode === "bypass") {
    return getDevBypassUser(env.devAuthRole);
  }

  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId || !/^[1-9]\d*$/.test(sessionUserId)) return null;

    if (env.nodeEnv === "development" && env.devAuthMode === "demo") {
      return getDevDemoUserById(env.nodeEnv, sessionUserId);
    }

    const prisma = getPrismaClient();
    const numericId = BigInt(sessionUserId);

    if (
      session?.user?.authSource === "admin_table" &&
      "adminAccount" in prisma &&
      prisma.adminAccount
    ) {
      const admin = await prisma.adminAccount.findUnique({
        where: { id: numericId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          isSuperuser: true,
          passwordResetRequired: true,
        },
      });
      if (!admin?.isActive || admin.passwordResetRequired) return null;
      return {
        ...admin,
        isAdministrator: true,
        isSuperuser: admin.isSuperuser,
        authSource: "admin_table" as const,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: numericId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        passwordResetRequired: true,
        administratorProfile: {
          select: { isSuperuser: true },
        },
      },
    });

    if (!user?.isActive || user.passwordResetRequired) return null;
    const roleFlags = getAccountRoleFlags(user);
    const { administratorProfile: _administratorProfile, ...identity } = user;
    void _administratorProfile;
    return {
      ...identity,
      isAdministrator: roleFlags.isAdministrator,
      isSuperuser: roleFlags.isSuperuser,
      authSource: "user_table" as const,
    };
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
  if (!user.isAdministrator) throw new AuthorizationDeniedError();
  return user;
}

export async function requireSuperuser() {
  const user = await requireCurrentUser();
  if (!user.isSuperuser) throw new AuthorizationDeniedError();
  return user;
}
