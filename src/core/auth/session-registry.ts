import { hashOpaqueToken, isOpaqueToken } from "@/core/auth/opaque-token";
import type { PrismaClient } from "@prisma/client";
import "server-only";

export async function registerAppSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  expiresAt: Date,
): Promise<boolean> {
  if (!/^[1-9]\d*$/.test(userId) || !isOpaqueToken(sessionId)) return false;

  const id = BigInt(userId);

  return prisma.$transaction(async (transaction) => {
    const eligible = await transaction.$queryRaw<Array<{ id: bigint }>>`
      SELECT "id" FROM "users"
      WHERE "id" = ${id} AND "is_active" = true AND "password_reset_required" = false
      FOR UPDATE
    `;
    if (eligible.length !== 1) return false;

    await transaction.appSession.create({
      data: {
        userId: id,
        tokenHash: hashOpaqueToken(sessionId),
        expiresAt,
      },
    });
    return true;
  });
}

export async function getActiveAppSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  if (!/^[1-9]\d*$/.test(userId) || !isOpaqueToken(sessionId)) return null;

  let id: bigint;
  try {
    id = BigInt(userId);
  } catch {
    return null;
  }

  const registryEntry = await prisma.appSession.findUnique({
    where: { tokenHash: hashOpaqueToken(sessionId) },
    select: {
      userId: true,
      expiresAt: true,
      user: {
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
      },
    },
  });

  if (
    !registryEntry ||
    registryEntry.userId !== id ||
    registryEntry.expiresAt <= new Date() ||
    !registryEntry.user.isActive ||
    registryEntry.user.passwordResetRequired
  ) {
    return null;
  }

  return registryEntry.user;
}

export async function revokeAppSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<void> {
  if (!isOpaqueToken(sessionId)) return;

  await prisma.appSession.deleteMany({
    where: { tokenHash: hashOpaqueToken(sessionId) },
  });
}
