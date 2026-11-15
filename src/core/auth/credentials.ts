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

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(1024),
});

export interface AuthorizeCredentialsOptions {
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly failureLimit?: number;
  readonly failureWindowMs?: number;
  readonly lockoutMs?: number;
  readonly now?: Date;
}

function normalizeClientIp(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed && isIP(trimmed) !== 0 ? trimmed : null;
}

export async function authorizeCredentials(
  prisma: PrismaClient,
  credentials: Partial<Record<"username" | "password", unknown>>,
  options: AuthorizeCredentialsOptions = {},
) {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const usernameNormalized = parsed.data.username.toLowerCase();
  const password = parsed.data.password;
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
            targetType: "user",
            targetIdentifier: usernameNormalized,
            clientIp: ipAddress,
            userAgent: options.userAgent,
            details: { reason: "lockout", username: usernameNormalized },
          });
        }
        return null;
      }

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

      let storedHash: string | null = null;
      if (account?.isActive && !account.passwordResetRequired) {
        const credential = await transaction.user.findUnique({
          where: { id: account.id },
          select: { passwordHash: true },
        });
        storedHash = credential?.passwordHash ?? null;
      }

      const passwordMatches = await verifyPassword(storedHash, password);
      const succeeded = Boolean(
        account?.isActive && !account.passwordResetRequired && passwordMatches,
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

      const roleFlags = getAccountRoleFlags(account);

      return {
        id: account.id.toString(),
        username: account.username,
        name: [account.firstName, account.lastName].filter(Boolean).join(" "),
        email: account.email || null,
        isAdministrator: roleFlags.isAdministrator,
        isSuperuser: roleFlags.isSuperuser,
      };
    });
  } catch {
    logger.error("auth_credentials_verification_failed");
    return null;
  }
}
