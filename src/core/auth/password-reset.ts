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
import { z } from "zod";

const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH);

export async function issuePasswordResetToken(
  prisma: PrismaClient,
  userId: bigint,
): Promise<string> {
  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { id: true },
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
  });

  return token;
}

export async function completePasswordReset(
  prisma: PrismaClient,
  token: string,
  newPassword: string,
  confirmation: string,
): Promise<boolean> {
  const parsedPassword = newPasswordSchema.safeParse(newPassword);
  if (
    !isOpaqueToken(token) ||
    !parsedPassword.success ||
    !passwordConfirmationMatches(newPassword, confirmation)
  ) {
    return false;
  }

  const tokenHash = hashOpaqueToken(token);
  const now = new Date();
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true, expiresAt: true },
  });
  if (!resetToken || resetToken.expiresAt <= now) return false;

  const passwordHash = await hashPassword(newPassword);

  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.passwordResetToken.deleteMany({
      where: {
        userId: resetToken.userId,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
    if (claimed.count !== 1) return false;

    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, passwordResetRequired: false },
    });
    await transaction.appSession.deleteMany({
      where: { userId: resetToken.userId },
    });
    return true;
  });
}
