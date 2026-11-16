import { getAccountRoleFlags } from "@/core/accounts/policy";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import { verifyPassword } from "@/core/auth/password";
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_LOCKOUT_MS,
} from "@/core/auth/password-policy";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import { isIP } from "node:net";
import "server-only";
import { z } from "zod";

export type LoginScope = "admin" | "user";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(1024),
  loginScope: z.enum(["admin", "user"]).optional(),
});

export interface AuthorizeCredentialsOptions {
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly failureLimit?: number;
  readonly failureWindowMs?: number;
  readonly lockoutMs?: number;
  readonly now?: Date;
  readonly loginScope?: LoginScope;
}

function normalizeClientIp(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed && isIP(trimmed) !== 0 ? trimmed : null;
}

export async function authorizeCredentials(
  prisma: PrismaClient,
  credentials: Partial<
    Record<"username" | "password" | "loginScope", unknown>
  >,
  options: AuthorizeCredentialsOptions = {},
) {
  const parsed = credentialsSchema.safeParse({
    username: credentials.username,
    password: credentials.password,
    loginScope:
      credentials.loginScope === "admin" || credentials.loginScope === "user"
        ? credentials.loginScope
        : options.loginScope,
  });
  if (!parsed.success) return null;

  const usernameNormalized = parsed.data.username.toLowerCase();
  const password = parsed.data.password;
  const loginScope = parsed.data.loginScope;
  const ipAddress = normalizeClientIp(options.clientIp);
  const failureLimit = options.failureLimit ?? LOGIN_FAILURE_LIMIT;
  const failureWindowMs = options.failureWindowMs ?? LOGIN_FAILURE_WINDOW_MS;
  const lockoutMs = options.lockoutMs ?? LOGIN_LOCKOUT_MS;
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const lookupStart = new Date(nowMs - (failureWindowMs + lockoutMs));
  const retentionMs = Math.max(failureWindowMs, lockoutMs) * 8;
  const retentionCutoff = new Date(nowMs - retentionMs);
  const lockKey = `${usernameNormalized}|${ipAddress ?? ""}`;

  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      `;

      await transaction.loginAttempt.deleteMany({
        where: { createdAt: { lt: retentionCutoff } },
      });

      const recentFailures = await transaction.loginAttempt.findMany({
        where: {
          usernameNormalized,
          ipAddress,
          succeeded: false,
          createdAt: { gte: lookupStart },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const latestFailure = recentFailures[0]?.createdAt;
      const latestFailureMs = latestFailure?.getTime() ?? 0;
      const burstWindowStartMs = latestFailureMs - failureWindowMs;
      const burstCount = recentFailures.filter(
        (attempt) => attempt.createdAt.getTime() >= burstWindowStartMs,
      ).length;
      const isLocked =
        burstCount >= failureLimit &&
        Boolean(latestFailure && latestFailureMs + lockoutMs > nowMs);

      if (isLocked) {
        await verifyPassword(null, password);
        if ("auditLog" in transaction && transaction.auditLog) {
          await recordAudit(transaction as unknown as AuditWriteClient, {
            action: "login_failure",
            targetType: loginScope === "admin" ? "admin_account" : "user",
            targetIdentifier: usernameNormalized,
            clientIp: ipAddress,
            userAgent: options.userAgent,
            details: { reason: "lockout", username: usernameNormalized },
          });
        }
        return null;
      }

      // 1. Check dedicated AdminAccount table (`admin_accounts`) when scope is "admin" or unspecified
      if (
        loginScope !== "user" &&
        "adminAccount" in transaction &&
        transaction.adminAccount
      ) {
        const adminAccount = await transaction.adminAccount.findFirst({
          where: {
            username: { equals: usernameNormalized, mode: "insensitive" },
          },
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

        if (adminAccount) {
          let adminStoredHash: string | null = null;
          if (adminAccount.isActive && !adminAccount.passwordResetRequired) {
            const adminCredential = await transaction.adminAccount.findUnique({
              where: { id: adminAccount.id },
              select: { passwordHash: true },
            });
            adminStoredHash = adminCredential?.passwordHash ?? null;
          }

          const adminPasswordMatches = await verifyPassword(
            adminStoredHash,
            password,
          );
          const adminSucceeded = Boolean(
            adminAccount.isActive &&
              !adminAccount.passwordResetRequired &&
              adminPasswordMatches,
          );

          if (adminSucceeded) {
            await transaction.loginAttempt.deleteMany({
              where: { usernameNormalized, ipAddress, succeeded: false },
            });
            await transaction.adminAccount.update({
              where: { id: adminAccount.id },
              data: { lastLogin: now },
            });
          }

          await transaction.loginAttempt.create({
            data: {
              usernameNormalized,
              ipAddress,
              succeeded: adminSucceeded,
              createdAt: now,
            },
          });

          if ("auditLog" in transaction && transaction.auditLog) {
            await recordAudit(transaction as unknown as AuditWriteClient, {
              actorId: null,
              action: adminSucceeded ? "login_success" : "login_failure",
              targetType: "admin_account",
              targetIdentifier: adminAccount.username,
              clientIp: ipAddress,
              userAgent: options.userAgent,
              details: adminSucceeded
                ? {
                    username: adminAccount.username,
                    auth_source: "admin_table",
                  }
                : {
                    reason: !adminAccount.isActive
                      ? "inactive_account"
                      : adminAccount.passwordResetRequired
                        ? "password_reset_required"
                        : "invalid_password",
                    username: usernameNormalized,
                  },
            });
          }

          if (!adminSucceeded) return null;

          return {
            id: adminAccount.id.toString(),
            username: adminAccount.username,
            name: [adminAccount.firstName, adminAccount.lastName]
              .filter(Boolean)
              .join(" "),
            email: adminAccount.email || null,
            isAdministrator: true,
            isSuperuser: adminAccount.isSuperuser,
            authSource: "admin_table" as const,
          };
        }
      }

      // 2. Check User table (`users`)
      const account = await transaction.user.findFirst({
        where: {
          username: { equals: usernameNormalized, mode: "insensitive" },
        },
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

      const roleFlags = getAccountRoleFlags(account);
      const verificationStatus =
        account &&
        "verificationStatus" in account &&
        typeof (account as { verificationStatus?: unknown })
          .verificationStatus === "string"
          ? ((account as { verificationStatus: string }).verificationStatus)
          : "verified";

      const scopeAllowed =
        loginScope === "admin"
          ? roleFlags.isAdministrator
          : loginScope === "user"
            ? !roleFlags.isAdministrator
            : true;

      const verificationAllowed = verificationStatus === "verified";

      let storedHash: string | null = null;
      if (
        account?.isActive &&
        !account.passwordResetRequired &&
        scopeAllowed &&
        verificationAllowed
      ) {
        const credential = await transaction.user.findUnique({
          where: { id: account.id },
          select: { passwordHash: true },
        });
        storedHash = credential?.passwordHash ?? null;
      }

      const passwordMatches = await verifyPassword(storedHash, password);
      const succeeded = Boolean(
        account?.isActive &&
          !account.passwordResetRequired &&
          scopeAllowed &&
          verificationAllowed &&
          passwordMatches,
      );

      if (succeeded && account) {
        await transaction.loginAttempt.deleteMany({
          where: { usernameNormalized, ipAddress, succeeded: false },
        });
        await transaction.user.update({
          where: { id: account.id },
          data: { lastLogin: now },
        });
      }

      await transaction.loginAttempt.create({
        data: { usernameNormalized, ipAddress, succeeded, createdAt: now },
      });

      if ("auditLog" in transaction && transaction.auditLog) {
        await recordAudit(transaction as unknown as AuditWriteClient, {
          actorId: account?.id ?? null,
          action: succeeded ? "login_success" : "login_failure",
          targetType: "user",
          targetIdentifier: account?.username ?? usernameNormalized,
          clientIp: ipAddress,
          userAgent: options.userAgent,
          details: succeeded
            ? { username: account?.username ?? usernameNormalized }
            : {
                reason: !account
                  ? "unknown_user"
                  : !scopeAllowed
                    ? "scope_mismatch"
                    : !verificationAllowed
                      ? "pending_approval"
                      : !account.isActive
                        ? "inactive_account"
                        : account.passwordResetRequired
                          ? "password_reset_required"
                          : "invalid_password",
                username: usernameNormalized,
              },
        });
      }

      if (!succeeded || !account) return null;

      return {
        id: account.id.toString(),
        username: account.username,
        name: [account.firstName, account.lastName].filter(Boolean).join(" "),
        email: account.email || null,
        isAdministrator: roleFlags.isAdministrator,
        isSuperuser: roleFlags.isSuperuser,
        authSource: "user_table" as const,
      };
    });
  } catch {
    logger.error("auth_credentials_verification_failed");
    return null;
  }
}
