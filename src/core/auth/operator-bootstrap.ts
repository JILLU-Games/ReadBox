import { createOpaqueToken, hashOpaqueToken } from "@/core/auth/opaque-token";
import { hashPassword } from "@/core/auth/password";
import { RESET_TOKEN_TTL_MS } from "@/core/auth/password-policy";
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import "server-only";
import { z } from "zod";

const initialAccountInputSchema = z.object({
  username: z.string().trim().min(1).max(150),
  firstName: z.string().trim().max(150),
  lastName: z.string().trim().max(150),
  email: z.string().trim().max(254),
});

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
  const parsedInput = initialAccountInputSchema.safeParse(input);
  if (!parsedInput.success) throw new Error("Invalid initial account details");

  const username = parsedInput.data.username.toLowerCase();
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
        firstName: parsedInput.data.firstName,
        lastName: parsedInput.data.lastName,
        email: parsedInput.data.email.toLowerCase(),
        passwordHash,
        passwordResetRequired: true,
        isActive: true,
      },
      select: { id: true },
    });

    await transaction.administratorProfile.create({
      data: { userId: user.id, isSuperuser: true },
    });

    await transaction.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return { userId: user.id.toString(), resetToken };
  });
}

/**
 * R-04 production first-admin bootstrap: the actual admin login identity is
 * AdminAccount, not a User+AdministratorProfile. The legacy function above is
 * retained for compatibility with existing user-account workflows.
 */
export async function bootstrapInitialAdminAccount(
  prisma: PrismaClient,
  input: InitialAccountInput,
): Promise<{ adminId: string; resetToken: string } | null> {
  const validated = initialAccountInputSchema.safeParse(input);
  if (!validated.success) throw new Error("Invalid initial admin details");
  const username = validated.data.username.toLowerCase();
  const email = validated.data.email.toLowerCase();
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const resetToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(resetToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended('readbox-initial-admin-account', 0))
    `;
    // No second privileged identity, including the legacy superuser path.
    if ((await tx.adminAccount.count()) !== 0) return null;
    if ((await tx.administratorProfile.count({
      where: { isSuperuser: true },
    })) !== 0) return null;
    if ((await tx.user.count({
      where: { username: { equals: username, mode: "insensitive" } },
    })) !== 0) return null;

    const admin = await tx.adminAccount.create({
      data: {
        username,
        email,
        firstName: validated.data.firstName,
        lastName: validated.data.lastName,
        passwordHash,
        passwordResetRequired: true,
        isActive: true,
        isSuperuser: true,
      },
      select: { id: true },
    });
    await tx.adminResetToken.create({
      data: { adminId: admin.id, tokenHash, expiresAt },
    });
    return { adminId: admin.id.toString(), resetToken };
  });
}

export interface ProductionAdminBootstrapContext {
  readonly nodeEnv: string;
  readonly dockerRuntime: boolean;
  readonly interactive: boolean;
  readonly authEnabled: boolean;
  readonly authSecret: string | undefined;
  readonly databaseUrl: string | undefined;
}

/** Explicit operator-only action, never on app start or an HTTP request. */
export function getProductionAdminBootstrapError(
  context: ProductionAdminBootstrapContext,
): string | null {
  if (context.nodeEnv !== "production" || !context.dockerRuntime) {
    return "Production admin bootstrap requires the isolated ReadBox container.";
  }
  if (!context.interactive) {
    return "Production admin bootstrap requires a local interactive terminal.";
  }
  if (!context.authEnabled || (context.authSecret?.length ?? 0) < 32) {
    return "Production authentication and a strong secret are required.";
  }
  try {
    const url = new URL(context.databaseUrl ?? "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== "postgres" ||
      url.port !== "5432" ||
      !/^\/[A-Za-z0-9_]+$/.test(url.pathname)
    ) {
      return "Production bootstrap requires the private Compose PostgreSQL endpoint.";
    }
  } catch {
    return "Production bootstrap requires a valid private PostgreSQL connection.";
  }
  return null;
}
