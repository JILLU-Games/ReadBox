import {
  DEFAULT_USER_CONTROL_SETTINGS,
  getUserControlSettings,
  type UserControlSettingsShape,
} from "@/core/accounts/user-control-policy";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import {
  registerDevDemoSignupUser,
  updateDevDemoDynamicUserStatus,
} from "@/core/auth/dev-demo-auth";
import { hashPassword } from "@/core/auth/password";
import { MAX_PASSWORD_LENGTH } from "@/core/auth/password-policy";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import "server-only";
import { z } from "zod";

const USERNAME_PATTERN = /^[a-zA-Z0-9.@+_-]{2,150}$/;
const PHONE_PATTERN = /^[0-9+()\-.\s]{6,40}$/;

export interface SignUpFormInput {
  readonly username: string;
  readonly password: string;
  readonly passwordConfirmation: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly inviteCode?: string;
}

export interface ValidatedSignUpPayload {
  readonly username: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly verificationStatus: "verified" | "pending_approval";
}

export type SignUpValidationResult =
  | { readonly ok: true; readonly data: ValidatedSignUpPayload }
  | {
      readonly ok: false;
      readonly code:
        | "signup_disabled"
        | "validation"
        | "invalid_invite_code";
      readonly error: string;
      readonly fieldErrors: Record<string, string>;
    };

export type RegisterUserResult =
  | {
      readonly ok: true;
      readonly userId: string;
      readonly username: string;
      readonly verificationStatus: "verified" | "pending_approval";
      readonly requiresApproval: boolean;
    }
  | {
      readonly ok: false;
      readonly code:
        | "signup_disabled"
        | "validation"
        | "invalid_invite_code"
        | "username_taken"
        | "unavailable";
      readonly error: string;
      readonly fieldErrors?: Record<string, string>;
    };

function hasStrongPasswordComplexity(password: string): boolean {
  return (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function validateSignUpInput(
  rawInput: unknown,
  settings: UserControlSettingsShape = DEFAULT_USER_CONTROL_SETTINGS,
): SignUpValidationResult {
  if (!settings.signupEnabled) {
    return {
      ok: false,
      code: "signup_disabled",
      error: "User registration is currently disabled by the administrator.",
      fieldErrors: {},
    };
  }

  const baseSchema = z.object({
    username: z
      .string()
      .trim()
      .min(2, "Username must be at least 2 characters.")
      .max(150, "Username cannot exceed 150 characters.")
      .regex(
        USERNAME_PATTERN,
        "Username may contain letters, numbers, and . @ + _ - characters only.",
      ),
    password: z.string(),
    passwordConfirmation: z.string(),
    firstName: z.string().trim().max(150).optional().default(""),
    lastName: z.string().trim().max(150).optional().default(""),
    email: z.string().trim().max(254).optional().default(""),
    phone: z.string().trim().max(40).optional().default(""),
    inviteCode: z.string().trim().max(120).optional().default(""),
  });

  const parsed = baseSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      code: "validation",
      error: parsed.error.issues[0]?.message ?? "Check the registration form.",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const fieldErrors: Record<string, string> = {};

  const minLen = Math.max(8, settings.minPasswordLength);
  if (data.password.length < minLen) {
    fieldErrors.password = `Password must be at least ${minLen} characters.`;
  } else if (data.password.length > MAX_PASSWORD_LENGTH) {
    fieldErrors.password = `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`;
  } else if (
    settings.requireStrongPassword &&
    !hasStrongPasswordComplexity(data.password)
  ) {
    fieldErrors.password =
      "Password must include uppercase, lowercase, number, and symbol characters.";
  }

  if (data.password !== data.passwordConfirmation) {
    fieldErrors.passwordConfirmation = "Password confirmation does not match.";
  }

  const firstName =
    settings.firstNameRequirement === "none" ? "" : data.firstName.trim();
  if (settings.firstNameRequirement === "required" && !firstName) {
    fieldErrors.firstName = "First name is required.";
  }

  const lastName =
    settings.lastNameRequirement === "none" ? "" : data.lastName.trim();
  if (settings.lastNameRequirement === "required" && !lastName) {
    fieldErrors.lastName = "Last name is required.";
  }

  const email =
    settings.emailRequirement === "none" ? "" : data.email.trim().toLowerCase();
  if (settings.emailRequirement === "required" && !email) {
    fieldErrors.email = "Email address is required.";
  } else if (email && !z.string().email().safeParse(email).success) {
    fieldErrors.email = "Enter a valid email address.";
  }

  const phone = settings.phoneRequirement === "none" ? "" : data.phone.trim();
  if (settings.phoneRequirement === "required" && !phone) {
    fieldErrors.phone = "Phone number is required.";
  } else if (phone && !PHONE_PATTERN.test(phone)) {
    fieldErrors.phone = "Enter a valid phone number.";
  }

  if (settings.verificationMode === "invite_code") {
    if (!data.inviteCode) {
      fieldErrors.inviteCode = "Registration invite code is required.";
    } else if (data.inviteCode !== settings.inviteCode) {
      return {
        ok: false,
        code: "invalid_invite_code",
        error: "The registration invite code is invalid.",
        fieldErrors: {
          inviteCode: "The registration invite code is invalid.",
        },
      };
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstMessage =
      Object.values(fieldErrors)[0] ?? "Review the registration fields.";
    return {
      ok: false,
      code: "validation",
      error: firstMessage,
      fieldErrors,
    };
  }

  const verificationStatus =
    settings.verificationMode === "admin_approval"
      ? "pending_approval"
      : "verified";

  return {
    ok: true,
    data: {
      username: data.username.trim(),
      password: data.password,
      firstName,
      lastName,
      email,
      phone,
      verificationStatus,
    },
  };
}

export async function registerUserAccount(
  prisma: PrismaClient | null,
  rawInput: unknown,
  options: {
    readonly settings?: UserControlSettingsShape;
    readonly devDemoActive?: boolean;
    readonly clientIp?: string | null;
    readonly userAgent?: string | null;
    readonly hashPasswordFn?: (password: string) => Promise<string>;
  } = {},
): Promise<RegisterUserResult> {
  const settings =
    options.settings ?? (await getUserControlSettings(prisma ?? undefined));

  const validated = validateSignUpInput(rawInput, settings);
  if (!validated.ok) {
    return validated;
  }

  const payload = validated.data;

  if (options.devDemoActive || !prisma) {
    const createdDemo = registerDevDemoSignupUser(payload);
    if (!createdDemo) {
      return {
        ok: false,
        code: "username_taken",
        error: "A user with that username already exists.",
        fieldErrors: { username: "A user with that username already exists." },
      };
    }
    return {
      ok: true,
      userId: createdDemo.id,
      username: createdDemo.username,
      verificationStatus: payload.verificationStatus,
      requiresApproval: payload.verificationStatus === "pending_approval",
    };
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        username: { equals: payload.username, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existingUser) {
      return {
        ok: false,
        code: "username_taken",
        error: "A user with that username already exists.",
        fieldErrors: { username: "A user with that username already exists." },
      };
    }

    if ("adminAccount" in prisma && prisma.adminAccount) {
      const existingAdmin = await prisma.adminAccount.findFirst({
        where: {
          username: { equals: payload.username, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existingAdmin) {
        return {
          ok: false,
          code: "username_taken",
          error: "A user with that username already exists.",
          fieldErrors: {
            username: "A user with that username already exists.",
          },
        };
      }
    }

    const hashFn = options.hashPasswordFn ?? hashPassword;
    const passwordHash = await hashFn(payload.password);
    const isActive = payload.verificationStatus === "verified";

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: payload.username,
          passwordHash,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          isActive,
          verificationStatus: payload.verificationStatus,
          isStaff: false,
          isSuperuser: false,
          passwordResetRequired: false,
        },
        select: {
          id: true,
          username: true,
        },
      });

      await tx.userAccessPolicy.create({
        data: {
          userId: user.id,
          canCreateMailboxes: settings.defaultCanCreateMailboxes,
          canDeleteMessages: settings.defaultCanDeleteMessages,
          canDeleteMailboxes: settings.defaultCanDeleteMailboxes,
          maxMailboxes: settings.defaultMaxMailboxes,
          allowedDomainUuids: [...settings.allowedDomainUuids],
          autoDeleteEnabled: settings.autoDeleteEnabled,
          autoDeleteDays: settings.autoDeleteEnabled
            ? settings.autoDeleteDays
            : 0,
        },
      });

      if ("auditLog" in tx && tx.auditLog) {
        await recordAudit(tx as unknown as AuditWriteClient, {
          actorId: user.id,
          action: "user_self_signup",
          targetType: "user",
          targetIdentifier: user.username,
          clientIp: options.clientIp,
          userAgent: options.userAgent,
          details: {
            verification_mode: settings.verificationMode,
            verification_status: payload.verificationStatus,
            active: isActive,
          },
        });
      }

      return user;
    });

    return {
      ok: true,
      userId: created.id.toString(),
      username: created.username,
      verificationStatus: payload.verificationStatus,
      requiresApproval: payload.verificationStatus === "pending_approval",
    };
  } catch {
    logger.error("user_self_signup_failed");
    return {
      ok: false,
      code: "unavailable",
      error: "Could not complete registration. Try again later.",
    };
  }
}

export async function updatePendingUserVerification(
  prisma: PrismaClient | null,
  rawUserId: string,
  decision: "verified" | "rejected",
  options: {
    readonly devDemoActive?: boolean;
    readonly actorId?: bigint | null;
    readonly clientIp?: string | null;
    readonly userAgent?: string | null;
  } = {},
): Promise<{ readonly ok: boolean; readonly error?: string }> {
  const trimmed = rawUserId.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return { ok: false, error: "Invalid user identifier." };
  }

  if (options.devDemoActive || !prisma) {
    const updated = updateDevDemoDynamicUserStatus(trimmed, decision);
    if (!updated) {
      return { ok: false, error: "User registration record not found." };
    }
    return { ok: true };
  }

  try {
    const userId = BigInt(trimmed);
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!existing) {
      return { ok: false, error: "User registration record not found." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          verificationStatus: decision,
          isActive: decision === "verified",
        },
      });

      if ("auditLog" in tx && tx.auditLog) {
        await recordAudit(tx as unknown as AuditWriteClient, {
          actorId: options.actorId ?? null,
          action:
            decision === "verified"
              ? "user_signup_approved"
              : "user_signup_rejected",
          targetType: "user",
          targetIdentifier: existing.username,
          clientIp: options.clientIp,
          userAgent: options.userAgent,
          details: { verification_status: decision },
        });
      }
    });

    return { ok: true };
  } catch {
    logger.error("user_signup_verification_update_failed");
    return { ok: false, error: "Could not update user verification status." };
  }
}

export async function upsertAdminAccountRecord(
  prisma: Pick<PrismaClient, "adminAccount">,
  input: {
    readonly username: string;
    readonly passwordHash: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly email?: string;
    readonly isSuperuser?: boolean;
    readonly isActive?: boolean;
    readonly passwordResetRequired?: boolean;
  },
) {
  const usernameNormalized = input.username.trim().toLowerCase();
  return prisma.adminAccount.upsert({
    where: { username: usernameNormalized },
    create: {
      username: usernameNormalized,
      passwordHash: input.passwordHash,
      firstName: input.firstName?.trim() ?? "",
      lastName: input.lastName?.trim() ?? "",
      email: input.email?.trim().toLowerCase() ?? "",
      isSuperuser: input.isSuperuser ?? true,
      isActive: input.isActive ?? true,
      passwordResetRequired: input.passwordResetRequired ?? false,
    },
    update: {
      passwordHash: input.passwordHash,
      firstName: input.firstName?.trim() ?? "",
      lastName: input.lastName?.trim() ?? "",
      email: input.email?.trim().toLowerCase() ?? "",
      isSuperuser: input.isSuperuser ?? true,
      isActive: input.isActive ?? true,
      passwordResetRequired: input.passwordResetRequired ?? false,
    },
  });
}
