import { verifyPassword } from "@/core/auth/password";
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_FAILURE_WINDOW_MS,
} from "@/core/auth/password-policy";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import "server-only";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(1024),
});

export async function authorizeCredentials(
  prisma: PrismaClient,
  credentials: Partial<Record<"username" | "password", unknown>>,
) {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const usernameNormalized = parsed.data.username.toLowerCase();
  const password = parsed.data.password;
  const windowStart = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS);

  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${usernameNormalized}, 0))
      `;

      const recentFailures = await transaction.loginAttempt.count({
        where: {
          usernameNormalized,
          ipAddress: null,
          succeeded: false,
          createdAt: { gte: windowStart },
        },
      });

      if (recentFailures >= LOGIN_FAILURE_LIMIT) {
        await verifyPassword(null, password);
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
          isStaff: true,
          isSuperuser: true,
          passwordResetRequired: true,
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

      await transaction.loginAttempt.create({
        data: { usernameNormalized, ipAddress: null, succeeded },
      });

      if (!succeeded || !account) return null;

      return {
        id: account.id.toString(),
        username: account.username,
        name: [account.firstName, account.lastName].filter(Boolean).join(" "),
        email: account.email || null,
        isStaff: account.isStaff,
        isSuperuser: account.isSuperuser,
      };
    });
  } catch {
    logger.error("auth_credentials_verification_failed");
    return null;
  }
}
