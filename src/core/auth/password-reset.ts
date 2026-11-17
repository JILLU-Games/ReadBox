import {
  hasStrongPasswordCharacters,
  type UserPasswordPolicySummary,
} from "@/core/accounts/user-profile-schema";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import {
  completeDevDemoPasswordReset,
  issueDevDemoPasswordResetToken,
} from "@/core/auth/dev-demo-auth";
import {
  createOpaqueToken,
  hashOpaqueToken,
  isOpaqueToken,
} from "@/core/auth/opaque-token";
import { hashPassword } from "@/core/auth/password";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RESET_TOKEN_TTL_MS,
  passwordConfirmationMatches,
} from "@/core/auth/password-policy";
import type { PrismaClient } from "@prisma/client";
import "server-only";

export interface PasswordResetOptions {
  readonly policy?: UserPasswordPolicySummary;
  readonly devDemoActive?: boolean;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
}

export interface PasswordResetRequestResult {
  readonly ok: boolean;
  readonly token?: string;
  readonly username?: string;
  readonly error?: string;
}

export interface PasswordResetCompletionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
}

interface AdminPasswordResetRecord {
  readonly adminId: bigint;
  readonly username: string;
  readonly tokenHash: string;
  readonly expiresAt: number;
}

const globalForAdminResetTokens = globalThis as typeof globalThis & {
  __readboxAdminResetTokens?: Map<string, AdminPasswordResetRecord>;
};

function getAdminResetTokenStore(): Map<string, AdminPasswordResetRecord> {
  globalForAdminResetTokens.__readboxAdminResetTokens ??= new Map();
  return globalForAdminResetTokens.__readboxAdminResetTokens;
}

export function clearAdminResetTokenStore(): void {
  getAdminResetTokenStore().clear();
}

async function resolveResetPasswordPolicy(
  prisma: PrismaClient | null,
  explicitPolicy?: UserPasswordPolicySummary,
): Promise<UserPasswordPolicySummary> {
  if (explicitPolicy) {
    return {
      minLength: Math.max(8, explicitPolicy.minLength),
      requireStrongPassword: explicitPolicy.requireStrongPassword,
    };
  }

  if (
    prisma &&
    "userControlSettings" in prisma &&
    prisma.userControlSettings &&
    typeof prisma.userControlSettings.findFirst === "function"
  ) {
    try {
      const row = await prisma.userControlSettings.findFirst({
        orderBy: { id: "asc" },
        select: {
          minPasswordLength: true,
          requireStrongPassword: true,
        },
      });
      if (row) {
        return {
          minLength: Math.max(8, row.minPasswordLength),
          requireStrongPassword: row.requireStrongPassword,
        };
      }
    } catch {
      // Fallback to default baseline below
    }
  }

  return {
    minLength: MIN_PASSWORD_LENGTH,
    requireStrongPassword: false,
  };
}

export async function issuePasswordResetToken(
  prisma: PrismaClient,
  userId: bigint,
  options: Pick<PasswordResetOptions, "clientIp" | "userAgent"> = {},
): Promise<string> {
  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!user) throw new Error("Reset target not found");

    await transaction.user.update({
      where: { id: userId },
      data: { passwordResetRequired: true },
    });
    await transaction.appSession.deleteMany({ where: { userId } });
    await transaction.passwordResetToken.deleteMany({ where: { userId } });
    await transaction.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    if ("auditLog" in transaction && transaction.auditLog) {
      await recordAudit(transaction as unknown as AuditWriteClient, {
        actorId: user.id,
        action: "password_reset_requested",
        targetType: "user",
        targetIdentifier: user.username ?? user.id.toString(),
        clientIp: options.clientIp,
        userAgent: options.userAgent,
        details: { forced: true },
      });
    }
  });

  return token;
}

export async function issueAdminPasswordResetToken(
  prisma: PrismaClient,
  adminId: bigint,
  options: Pick<PasswordResetOptions, "clientIp" | "userAgent"> = {},
): Promise<string> {
  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction(async (transaction) => {
    const admin = await transaction.adminAccount.findUnique({
      where: { id: adminId },
      select: { id: true, username: true },
    });
    if (!admin) throw new Error("Reset target not found");

    await transaction.adminAccount.update({
      where: { id: adminId },
      data: { passwordResetRequired: true },
    });
    if ("adminSession" in transaction && transaction.adminSession) {
      await transaction.adminSession.deleteMany({ where: { adminId } });
    }

    if ("adminResetToken" in transaction && transaction.adminResetToken) {
      await transaction.adminResetToken.deleteMany({ where: { adminId } });
      await transaction.adminResetToken.create({
        data: { adminId, tokenHash, expiresAt },
      });
    } else {
      const store = getAdminResetTokenStore();
      for (const [key, entry] of store.entries()) {
        if (entry.adminId === admin.id || entry.expiresAt <= Date.now()) {
          store.delete(key);
        }
      }
      store.set(tokenHash, {
        adminId: admin.id,
        username: admin.username,
        tokenHash,
        expiresAt: expiresAt.getTime(),
      });
    }

    if ("auditLog" in transaction && transaction.auditLog) {
      await recordAudit(transaction as unknown as AuditWriteClient, {
        actorId: null,
        authSource: "admin_table",
        actorUsername: admin.username,
        action: "password_reset_requested",
        targetType: "admin_account",
        targetIdentifier: admin.username,
        clientIp: options.clientIp,
        userAgent: options.userAgent,
        details: { forced: true, account_table: "admin_accounts" },
      });
    }
  });

  return token;
}

export async function requestPasswordReset(
  prisma: PrismaClient | null,
  identifier: string,
  options: PasswordResetOptions = {},
): Promise<PasswordResetRequestResult> {
  const normalized = identifier.trim();
  if (!normalized) {
    return {
      ok: false,
      error: "Enter your username or email address.",
    };
  }

  if (options.devDemoActive || !prisma) {
    return issueDevDemoPasswordResetToken(normalized, options.clientIp ?? null);
  }

  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { username: { equals: normalized, mode: "insensitive" } },
        ...(normalized.includes("@")
          ? [{ email: { equals: normalized.toLowerCase(), mode: "insensitive" as const } }]
          : []),
      ],
    },
    select: { id: true, username: true },
  });

  if (user) {
    const token = createOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });
      await transaction.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      if ("auditLog" in transaction && transaction.auditLog) {
        await recordAudit(transaction as unknown as AuditWriteClient, {
          actorId: user.id,
          action: "password_reset_requested",
          targetType: "user",
          targetIdentifier: user.username,
          clientIp: options.clientIp,
          userAgent: options.userAgent,
          details: { self_service: true },
        });
      }
    });

    return {
      ok: true,
      token,
      username: user.username,
    };
  }

  if ("adminAccount" in prisma && prisma.adminAccount) {
    const admin = await prisma.adminAccount.findFirst({
      where: {
        isActive: true,
        OR: [
          { username: { equals: normalized, mode: "insensitive" } },
          ...(normalized.includes("@")
            ? [{ email: { equals: normalized.toLowerCase(), mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: { id: true, username: true },
    });

    if (admin) {
      const token = createOpaqueToken();
      const tokenHash = hashOpaqueToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.$transaction(async (transaction) => {
        if ("adminResetToken" in transaction && transaction.adminResetToken) {
          await transaction.adminResetToken.deleteMany({
            where: { adminId: admin.id },
          });
          await transaction.adminResetToken.create({
            data: { adminId: admin.id, tokenHash, expiresAt },
          });
        } else {
          const store = getAdminResetTokenStore();
          for (const [key, entry] of store.entries()) {
            if (entry.adminId === admin.id || entry.expiresAt <= Date.now()) {
              store.delete(key);
            }
          }
          store.set(tokenHash, {
            adminId: admin.id,
            username: admin.username,
            tokenHash,
            expiresAt: expiresAt.getTime(),
          });
        }

        if ("auditLog" in transaction && transaction.auditLog) {
          await recordAudit(transaction as unknown as AuditWriteClient, {
            actorId: null,
            authSource: "admin_table",
            actorUsername: admin.username,
            action: "password_reset_requested",
            targetType: "admin_account",
            targetIdentifier: admin.username,
            clientIp: options.clientIp,
            userAgent: options.userAgent,
            details: { self_service: true, account_table: "admin_accounts" },
          });
        }
      });

      return {
        ok: true,
        token,
        username: admin.username,
      };
    }
  }

  return {
    ok: false,
    error: "No active account matched that username or email address.",
  };
}

export async function completePasswordResetDetailed(
  prisma: PrismaClient | null,
  token: string,
  newPassword: string,
  confirmation: string,
  options: PasswordResetOptions = {},
): Promise<PasswordResetCompletionResult> {
  const policy = await resolveResetPasswordPolicy(prisma, options.policy);

  if (options.devDemoActive || !prisma) {
    return completeDevDemoPasswordReset(
      token,
      newPassword,
      confirmation,
      policy,
      options.clientIp ?? null,
    );
  }

  const trimmedToken = token.trim();
  if (!isOpaqueToken(trimmedToken)) {
    return {
      ok: false,
      error: "Reset token is invalid or has expired.",
      fieldErrors: { token: "Enter a valid reset token." },
    };
  }

  const minLen = Math.max(8, policy.minLength);
  if (newPassword.length < minLen) {
    return {
      ok: false,
      error: `Password must be at least ${minLen} characters.`,
      fieldErrors: {
        password: `Password must be at least ${minLen} characters.`,
      },
    };
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`,
      fieldErrors: {
        password: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`,
      },
    };
  }
  if (policy.requireStrongPassword && !hasStrongPasswordCharacters(newPassword)) {
    return {
      ok: false,
      error:
        "Password must include uppercase, lowercase, number, and symbol characters.",
      fieldErrors: {
        password:
          "Password must include uppercase, lowercase, number, and symbol characters.",
      },
    };
  }
  if (!passwordConfirmationMatches(newPassword, confirmation)) {
    return {
      ok: false,
      error: "Password confirmation does not match.",
      fieldErrors: { confirmation: "Password confirmation does not match." },
    };
  }

  const tokenHash = hashOpaqueToken(trimmedToken);
  const now = new Date();

  if ("adminResetToken" in prisma && prisma.adminResetToken) {
    const dbAdminResetToken = await prisma.adminResetToken.findUnique({
      where: { tokenHash },
      select: {
        adminId: true,
        expiresAt: true,
        admin: { select: { username: true } },
      },
    });
    if (dbAdminResetToken) {
      if (dbAdminResetToken.expiresAt <= now) {
        return {
          ok: false,
          error: "Reset token is invalid or has expired.",
          fieldErrors: { token: "Reset token is invalid or has expired." },
        };
      }

      const passwordHash = await hashPassword(newPassword);
      const completedAdminReset = await prisma.$transaction(
        async (transaction) => {
          const claimed = await transaction.adminResetToken.deleteMany({
            where: {
              adminId: dbAdminResetToken.adminId,
              tokenHash,
              expiresAt: { gt: new Date() },
            },
          });
          if (claimed.count !== 1) return false;

          const updatedAdmin = await transaction.adminAccount.update({
            where: { id: dbAdminResetToken.adminId },
            data: { passwordHash, passwordResetRequired: false },
          });
          if ("adminSession" in transaction && transaction.adminSession) {
            await transaction.adminSession.deleteMany({
              where: { adminId: dbAdminResetToken.adminId },
            });
          }
          if ("auditLog" in transaction && transaction.auditLog) {
            const adminUsername =
              updatedAdmin &&
              typeof updatedAdmin === "object" &&
              "username" in updatedAdmin &&
              typeof updatedAdmin.username === "string"
                ? updatedAdmin.username
                : dbAdminResetToken.admin?.username ??
                  dbAdminResetToken.adminId.toString();

            await recordAudit(transaction as unknown as AuditWriteClient, {
              actorId: null,
              authSource: "admin_table",
              actorUsername: adminUsername,
              action: "password_reset_completed",
              targetType: "admin_account",
              targetIdentifier: adminUsername,
              clientIp: options.clientIp,
              userAgent: options.userAgent,
              details: { account_table: "admin_accounts" },
            });
          }
          return true;
        },
      );

      if (!completedAdminReset) {
        return {
          ok: false,
          error: "Reset token is invalid or has already been used.",
          fieldErrors: {
            token: "Reset token is invalid or has already been used.",
          },
        };
      }

      return { ok: true };
    }
  }

  const adminTokenStore = getAdminResetTokenStore();
  const adminResetEntry = adminTokenStore.get(tokenHash);
  if (
    adminResetEntry &&
    "adminAccount" in prisma &&
    prisma.adminAccount
  ) {
    adminTokenStore.delete(tokenHash);
    if (adminResetEntry.expiresAt <= now.getTime()) {
      return {
        ok: false,
        error: "Reset token is invalid or has expired.",
        fieldErrors: { token: "Reset token has expired." },
      };
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (transaction) => {
      if ("adminAccount" in transaction && transaction.adminAccount) {
        await transaction.adminAccount.update({
          where: { id: adminResetEntry.adminId },
          data: { passwordHash, passwordResetRequired: false },
        });
      }
      if ("adminSession" in transaction && transaction.adminSession) {
        await transaction.adminSession.deleteMany({
          where: { adminId: adminResetEntry.adminId },
        });
      }
      if ("auditLog" in transaction && transaction.auditLog) {
        await recordAudit(transaction as unknown as AuditWriteClient, {
          actorId: null,
          authSource: "admin_table",
          actorUsername: adminResetEntry.username,
          action: "password_reset_completed",
          targetType: "admin_account",
          targetIdentifier: adminResetEntry.username,
          clientIp: options.clientIp,
          userAgent: options.userAgent,
          details: { account_table: "admin_accounts" },
        });
      }
    });

    return { ok: true };
  }

  const resetToken =
    "passwordResetToken" in prisma && prisma.passwordResetToken
      ? await prisma.passwordResetToken.findUnique({
          where: { tokenHash },
          select: { userId: true, expiresAt: true },
        })
      : null;
  if (!resetToken || resetToken.expiresAt <= now) {
    return {
      ok: false,
      error: "Reset token is invalid or has expired.",
      fieldErrors: { token: "Reset token is invalid or has expired." },
    };
  }

  const passwordHash = await hashPassword(newPassword);

  const completed = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.passwordResetToken.deleteMany({
      where: {
        userId: resetToken.userId,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
    if (claimed.count !== 1) return false;

    const updatedUser = await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, passwordResetRequired: false },
    });
    await transaction.appSession.deleteMany({
      where: { userId: resetToken.userId },
    });

    if ("auditLog" in transaction && transaction.auditLog) {
      const targetUsername =
        updatedUser &&
        typeof updatedUser === "object" &&
        "username" in updatedUser &&
        typeof updatedUser.username === "string"
          ? updatedUser.username
          : resetToken.userId.toString();

      await recordAudit(transaction as unknown as AuditWriteClient, {
        actorId: resetToken.userId,
        action: "password_reset_completed",
        targetType: "user",
        targetIdentifier: targetUsername,
        clientIp: options.clientIp,
        userAgent: options.userAgent,
      });
    }

    return true;
  });

  if (!completed) {
    return {
      ok: false,
      error: "Reset token is invalid or has already been used.",
      fieldErrors: { token: "Reset token is invalid or has already been used." },
    };
  }

  return { ok: true };
}

export async function completePasswordReset(
  prisma: PrismaClient,
  token: string,
  newPassword: string,
  confirmation: string,
  options: PasswordResetOptions = {},
): Promise<boolean> {
  const result = await completePasswordResetDetailed(
    prisma,
    token,
    newPassword,
    confirmation,
    options,
  );
  return result.ok;
}
