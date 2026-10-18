import { createOpaqueToken, hashOpaqueToken } from "@/core/auth/opaque-token";
import { hashPassword } from "@/core/auth/password";
import { RESET_TOKEN_TTL_MS } from "@/core/auth/password-policy";
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import "server-only";

export interface InitialAccountInput {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function bootstrapInitialAccount(
  prisma: PrismaClient,
  input: InitialAccountInput,
): Promise<{ userId: string; resetToken: string } | null> {
  const username = input.username.trim().toLowerCase();
  const passwordHash = await hashPassword(
    randomBytes(32).toString("base64url"),
  );
  const resetToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(resetToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended('readbox-initial-account-bootstrap', 0))
    `;

    if ((await transaction.user.count()) !== 0) return null;

    const user = await transaction.user.create({
      data: {
        username,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
        passwordHash,
        passwordResetRequired: true,
        isActive: true,
        isStaff: true,
        isSuperuser: true,
      },
      select: { id: true },
    });

    await transaction.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return { userId: user.id.toString(), resetToken };
  });
}
