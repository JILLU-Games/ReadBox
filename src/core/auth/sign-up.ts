import { env } from "@/config/env";
import {
  DEFAULT_USER_CONTROL_SETTINGS,
  getUserControlSettings,
  type UserControlSettingsShape,
} from "@/core/accounts/user-control-policy";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import {
  listDevDemoDynamicUsers,
  registerDevDemoSignupUser,
  updateDevDemoDynamicUserStatus,
} from "@/core/auth/dev-demo-auth";
import { hashPassword } from "@/core/auth/password";
import { MAX_PASSWORD_LENGTH } from "@/core/auth/password-policy";
import {
  provisionMailbox,
  type MailboxPrismaClient,
} from "@/core/mailboxes/service";
import { validateLocalPart } from "@/core/mailboxes/validators";
import { createDemoMailbox } from "@/core/messages/demo-workspace";
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
      readonly starterMailboxEmail?: string | null;
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

export function deriveStarterMailboxLocalPart(rawUsername: string): string {
  const beforeAt = rawUsername.trim().toLowerCase().split("@")[0] ?? "";
  const sanitized = beforeAt
    .replace(/[^a-z0-9._+-]/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._+-]+|[._+-]+$/g, "")
    .slice(0, 48);

  const candidate = sanitized.length >= 2 ? sanitized : `user.${sanitized || "inbox"}`;
  try {
    return validateLocalPart(candidate);
  } catch {
    try {
      return validateLocalPart(`mbox.${candidate}`.slice(0, 48));
    } catch {
      return "user.inbox";
    }
  }
}

async function tryProvisionStarterMailbox(
  prisma: PrismaClient | null,
  params: {
    readonly userId: string | bigint;
    readonly username: string;
    readonly settings: UserControlSettingsShape;
    readonly devDemoActive?: boolean;
    readonly clientIp?: string | null;
    readonly userAgent?: string | null;
  },
): Promise<string | null> {
  if (!params.settings.autoProvisionStarterMailbox) {
    return null;
  }

  const baseLocalPart = deriveStarterMailboxLocalPart(params.username);
  const preferredDomainUuid = params.settings.allowedDomainUuids[0];

  if (params.devDemoActive || !prisma) {
    const firstTry = createDemoMailbox(
      { localPart: baseLocalPart, domainUuid: preferredDomainUuid },
      { isAdministrator: true, userId: params.userId },
    );
    if (firstTry.ok) {
      return firstTry.data.emailAddress;
    }
    if (firstTry.code === "conflict") {
      const fallbackLocal = deriveStarterMailboxLocalPart(
        `${baseLocalPart}.${params.userId.toString()}`,
      );
      const secondTry = createDemoMailbox(
        { localPart: fallbackLocal, domainUuid: preferredDomainUuid },
        { isAdministrator: true, userId: params.userId },
      );
      if (secondTry.ok) {
        return secondTry.data.emailAddress;
      }
    }
    return null;
  }

  if (!("domain" in prisma) || !prisma.domain || !("mailbox" in prisma) || !prisma.mailbox) {
    return null;
  }

  try {
    const numericUserId =
      typeof params.userId === "bigint" ? params.userId : BigInt(params.userId);

    if (
      "mailboxMembership" in prisma &&
      prisma.mailboxMembership &&
      typeof prisma.mailboxMembership.count === "function"
    ) {
      const existingCount = await prisma.mailboxMembership.count({
        where: { userId: numericUserId },
      });
      if (existingCount > 0) {
        return null;
      }
    }

    const domains = await prisma.domain.findMany({
      where: {
        status: "active",
        verificationStatus: "verified",
        ...(params.settings.allowedDomainUuids.length > 0
          ? { uuid: { in: [...params.settings.allowedDomainUuids] } }
          : {}),
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, uuid: true, name: true },
    });

    const targetDomain = domains[0];
    if (!targetDomain) {
      return null;
    }

    const runtimeConfig = {
      mailDomain: env.mailDomain,
      mailStorageRoot: env.mailStorageRoot,
      attachmentStorageRoot: env.attachmentStorageRoot,
      mailboxProvisionLockRoot: env.mailboxProvisionLockRoot,
      defaultQuotaBytes: env.mailboxDefaultQuotaBytes,
    };

    const candidateLocals = [
      baseLocalPart,
      deriveStarterMailboxLocalPart(
        `${baseLocalPart}.${numericUserId.toString()}`,
      ),
    ];

    for (const candidateLocal of candidateLocals) {
      const provisioned = await provisionMailbox(
        prisma as unknown as MailboxPrismaClient,
        {
          localPart: candidateLocal,
          domainUuid: targetDomain.uuid,
          assignedUserIds: [numericUserId.toString()],
        },
        runtimeConfig,
        {
          actorId: numericUserId,
          authSource: "user_table",
          actorUsername: params.username,
          clientIp: params.clientIp,
          userAgent: params.userAgent,
        },
      );

      if (provisioned.ok) {
        return provisioned.data.emailAddress;
      }

      if (provisioned.code === "conflict") {
        continue;
      }

      // If running against a lightweight database/test environment without maildir or mailserver schema,
      // fall back to creating the application Mailbox + MailboxMembership record directly.
      const emailAddress = `${candidateLocal}@${targetDomain.name.toLowerCase()}`;
      const existingMailbox = await prisma.mailbox.findFirst({
        where: {
          emailAddress: { equals: emailAddress, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existingMailbox) {
        continue;
      }

      const createdMailbox = await prisma.mailbox.create({
        data: {
          domainId: targetDomain.id,
          localPart: candidateLocal,
          emailAddress,
          status: "active",
          maildirRelativePath: `${targetDomain.name.toLowerCase()}/${candidateLocal}/Maildir`,
        },
        select: { id: true, emailAddress: true },
      });

      if ("mailboxMembership" in prisma && prisma.mailboxMembership) {
        await prisma.mailboxMembership.createMany({
          data: [
            {
              userId: numericUserId,
              mailboxId: createdMailbox.id,
              assignedById: numericUserId,
            },
          ],
          skipDuplicates: true,
        });
      }

      if ("auditLog" in prisma && prisma.auditLog) {
        await recordAudit(prisma as unknown as AuditWriteClient, {
          actorId: numericUserId,
          authSource: "user_table",
          actorUsername: params.username,
          action: "mailbox_create",
          targetType: "mailbox",
          targetIdentifier: createdMailbox.emailAddress,
          clientIp: params.clientIp,
          userAgent: params.userAgent,
          details: {
            assigned_user_ids: [numericUserId.toString()],
            starter_mailbox: true,
          },
        });
      }

      return createdMailbox.emailAddress;
    }
  } catch {
    logger.warn("starter_mailbox_autoprovision_skipped");
  }

  return null;
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

    let starterMailboxEmail: string | null = null;
    if (
      settings.autoProvisionStarterMailbox &&
      payload.verificationStatus === "verified"
    ) {
      starterMailboxEmail = await tryProvisionStarterMailbox(null, {
        userId: createdDemo.id,
        username: createdDemo.username,
        settings,
        devDemoActive: true,
        clientIp: options.clientIp,
        userAgent: options.userAgent,
      });
    }

    return {
      ok: true,
      userId: createdDemo.id,
      username: createdDemo.username,
      verificationStatus: payload.verificationStatus,
      requiresApproval: payload.verificationStatus === "pending_approval",
      starterMailboxEmail,
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

    let starterMailboxEmail: string | null = null;
    if (
      settings.autoProvisionStarterMailbox &&
      payload.verificationStatus === "verified"
    ) {
      starterMailboxEmail = await tryProvisionStarterMailbox(prisma, {
        userId: created.id,
        username: created.username,
        settings,
        clientIp: options.clientIp,
        userAgent: options.userAgent,
      });
    }

    return {
      ok: true,
      userId: created.id.toString(),
      username: created.username,
      verificationStatus: payload.verificationStatus,
      requiresApproval: payload.verificationStatus === "pending_approval",
      starterMailboxEmail,
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
    readonly authSource?: "admin_table" | "user_table";
    readonly actorUsername?: string;
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
    if (decision === "verified") {
      const settings = await getUserControlSettings(null);
      if (settings.autoProvisionStarterMailbox) {
        const dynamicUser = listDevDemoDynamicUsers().find(
          (u) => u.id === trimmed,
        );
        await tryProvisionStarterMailbox(null, {
          userId: trimmed,
          username: dynamicUser?.username ?? updated.username,
          settings,
          devDemoActive: true,
          clientIp: options.clientIp,
          userAgent: options.userAgent,
        });
      }
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
          authSource: options.authSource,
          actorUsername: options.actorUsername,
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

    if (decision === "verified") {
      const settings = await getUserControlSettings(prisma);
      if (settings.autoProvisionStarterMailbox) {
        await tryProvisionStarterMailbox(prisma, {
          userId: existing.id,
          username: existing.username,
          settings,
          clientIp: options.clientIp,
          userAgent: options.userAgent,
        });
      }
    }

    return { ok: true };
  } catch {
    logger.error("user_signup_verification_update_failed");
    return { ok: false, error: "Could not update user verification status." };
  }
}

export async function upsertAdminAccountRecord(
  prisma: Pick<PrismaClient, "adminAccount"> &
    Partial<Pick<PrismaClient, "user">>,
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

  if (prisma.user && typeof prisma.user.findFirst === "function") {
    const collidingUser = await prisma.user.findFirst({
      where: {
        username: { equals: usernameNormalized, mode: "insensitive" },
      },
      select: {
        id: true,
        administratorProfile: { select: { isSuperuser: true } },
      },
    });
    if (collidingUser && !collidingUser.administratorProfile) {
      throw new Error(
        `Cannot provision admin account "${usernameNormalized}": a regular user account with that username already exists.`,
      );
    }
  }

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
