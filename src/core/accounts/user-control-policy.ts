import { env } from "@/config/env";
import { recordAudit } from "@/core/audit/record";
import type { AuditWriteClient } from "@/core/audit/types";
import {
  DEV_DEMO_ACCOUNTS,
  listDevDemoDynamicUsers,
} from "@/core/auth/dev-demo-auth";
import { logger } from "@/core/server/logger";
import type { PrismaClient } from "@prisma/client";
import "server-only";
import { z } from "zod";

export interface GovernanceRuntimeOptions {
  readonly allowDemoFallback?: boolean;
  readonly nodeEnv?: "development" | "test" | "production";
  readonly devAuthMode?: "off" | "bypass" | "demo";
}

export function isDemoGovernanceFallbackAllowed(
  options?: GovernanceRuntimeOptions,
): boolean {
  const nodeEnv = options?.nodeEnv ?? env.nodeEnv;
  if (nodeEnv === "production") {
    return false;
  }
  if (options?.allowDemoFallback !== undefined) {
    return options.allowDemoFallback;
  }
  if (options?.devAuthMode !== undefined) {
    return options.devAuthMode === "demo";
  }
  return true;
}

export const FIELD_REQUIREMENT_MODES = ["none", "optional", "required"] as const;
export type FieldRequirementMode = (typeof FIELD_REQUIREMENT_MODES)[number];

export const USER_VERIFICATION_MODES = [
  "instant",
  "invite_code",
  "admin_approval",
] as const;
export type UserVerificationMode = (typeof USER_VERIFICATION_MODES)[number];

export const USER_VERIFICATION_STATUSES = [
  "verified",
  "pending_approval",
  "rejected",
] as const;
export type UserVerificationStatus =
  (typeof USER_VERIFICATION_STATUSES)[number];

export interface UserControlSettingsShape {
  readonly signupEnabled: boolean;
  readonly firstNameRequirement: FieldRequirementMode;
  readonly lastNameRequirement: FieldRequirementMode;
  readonly emailRequirement: FieldRequirementMode;
  readonly phoneRequirement: FieldRequirementMode;
  readonly minPasswordLength: number;
  readonly requireStrongPassword: boolean;
  readonly verificationMode: UserVerificationMode;
  readonly inviteCode: string;
  readonly allowedDomainUuids: readonly string[];
  readonly defaultMaxMailboxes: number;
  readonly autoProvisionStarterMailbox: boolean;
  readonly defaultCanCreateMailboxes: boolean;
  readonly defaultCanDeleteMessages: boolean;
  readonly defaultCanDeleteMailboxes: boolean;
  readonly autoDeleteEnabled: boolean;
  readonly autoDeleteDays: number;
}

export interface ExtendedUserAccessPolicyShape {
  readonly canCreateMailboxes: boolean;
  readonly canDeleteMessages: boolean;
  readonly canDeleteMailboxes: boolean;
  readonly maxMailboxes: number;
  readonly allowedDomainUuids: readonly string[];
  readonly autoDeleteEnabled: boolean;
  readonly autoDeleteDays: number;
}

export interface ControlDomainOption {
  readonly uuid: string;
  readonly name: string;
  readonly isDefault: boolean;
}

export interface PendingSignupUserItem {
  readonly id: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly dateJoined: string;
}

export interface GovernedUserPolicyItem {
  readonly id: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly isActive: boolean;
  readonly verificationStatus: string;
  readonly mailboxCount: number;
  readonly policy: ExtendedUserAccessPolicyShape;
}

export const DEFAULT_USER_CONTROL_SETTINGS: UserControlSettingsShape =
  Object.freeze({
    signupEnabled: true,
    firstNameRequirement: "optional",
    lastNameRequirement: "optional",
    emailRequirement: "required",
    phoneRequirement: "optional",
    minPasswordLength: 12,
    requireStrongPassword: true,
    verificationMode: "instant",
    inviteCode: "",
    allowedDomainUuids: [],
    defaultMaxMailboxes: 3,
    autoProvisionStarterMailbox: false,
    defaultCanCreateMailboxes: true,
    defaultCanDeleteMessages: false,
    defaultCanDeleteMailboxes: false,
    autoDeleteEnabled: false,
    autoDeleteDays: 30,
  });

export const DEFAULT_EXTENDED_USER_ACCESS_POLICY: ExtendedUserAccessPolicyShape =
  Object.freeze({
    canCreateMailboxes: true,
    canDeleteMessages: false,
    canDeleteMailboxes: false,
    maxMailboxes: 3,
    allowedDomainUuids: [],
    autoDeleteEnabled: false,
    autoDeleteDays: 0,
  });

export const DEMO_VERIFIED_DOMAINS: readonly ControlDomainOption[] =
  Object.freeze([
    {
      uuid: "99999999-0000-4000-8000-000000000001",
      name: "readbox.local",
      isDefault: true,
    },
    {
      uuid: "99999999-0000-4000-8000-000000000002",
      name: "teambox.dev",
      isDefault: false,
    },
  ]);

const fieldRequirementSchema = z.enum(FIELD_REQUIREMENT_MODES);
const verificationModeSchema = z.enum(USER_VERIFICATION_MODES);

export const userControlSettingsInputSchema = z
  .object({
    signupEnabled: z.boolean().default(true),
    firstNameRequirement: fieldRequirementSchema.default("optional"),
    lastNameRequirement: fieldRequirementSchema.default("optional"),
    emailRequirement: fieldRequirementSchema.default("required"),
    phoneRequirement: fieldRequirementSchema.default("optional"),
    minPasswordLength: z
      .number()
      .int()
      .min(8, "Minimum password length must be at least 8.")
      .max(64, "Minimum password length cannot exceed 64.")
      .default(12),
    requireStrongPassword: z.boolean().default(true),
    verificationMode: verificationModeSchema.default("instant"),
    inviteCode: z.string().trim().max(120).default(""),
    allowedDomainUuids: z.array(z.string().trim().min(1)).default([]),
    defaultMaxMailboxes: z
      .number()
      .int()
      .min(0, "Max mailboxes must be 0 (unlimited) or a positive integer.")
      .max(500, "Max mailboxes cannot exceed 500.")
      .default(3),
    autoProvisionStarterMailbox: z.boolean().default(false),
    defaultCanCreateMailboxes: z.boolean().default(true),
    defaultCanDeleteMessages: z.boolean().default(false),
    defaultCanDeleteMailboxes: z.boolean().default(false),
    autoDeleteEnabled: z.boolean().default(false),
    autoDeleteDays: z
      .number()
      .int()
      .min(1, "Auto-delete retention must be at least 1 day.")
      .max(3650, "Auto-delete retention cannot exceed 3650 days.")
      .default(30),
  })
  .superRefine((data, ctx) => {
    if (
      data.verificationMode === "invite_code" &&
      data.inviteCode.trim().length < 4
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inviteCode"],
        message:
          "Invite code must be at least 4 characters when invite-code verification is selected.",
      });
    }
  });

export const extendedUserAccessPolicyInputSchema = z.object({
  canCreateMailboxes: z.boolean().default(true),
  canDeleteMessages: z.boolean().default(false),
  canDeleteMailboxes: z.boolean().default(false),
  maxMailboxes: z.number().int().min(0).max(500).default(3),
  allowedDomainUuids: z.array(z.string().trim().min(1)).default([]),
  autoDeleteEnabled: z.boolean().default(false),
  autoDeleteDays: z.number().int().min(0).max(3650).default(0),
});

function normalizeUuidArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const item of raw) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length > 0) {
        unique.add(trimmed);
      }
    }
  }
  return Array.from(unique);
}

function normalizeFieldRequirement(
  raw: unknown,
  fallback: FieldRequirementMode,
): FieldRequirementMode {
  return raw === "none" || raw === "optional" || raw === "required"
    ? raw
    : fallback;
}

function normalizeVerificationMode(
  raw: unknown,
  fallback: UserVerificationMode,
): UserVerificationMode {
  return raw === "instant" ||
    raw === "invite_code" ||
    raw === "admin_approval"
    ? raw
    : fallback;
}

export function normalizeUserControlSettings(
  raw:
    | Partial<Record<keyof UserControlSettingsShape, unknown>>
    | null
    | undefined,
): UserControlSettingsShape {
  if (!raw) return DEFAULT_USER_CONTROL_SETTINGS;

  const minPasswordLength =
    typeof raw.minPasswordLength === "number" &&
    Number.isFinite(raw.minPasswordLength)
      ? Math.max(8, Math.min(64, Math.floor(raw.minPasswordLength)))
      : DEFAULT_USER_CONTROL_SETTINGS.minPasswordLength;

  const defaultMaxMailboxes =
    typeof raw.defaultMaxMailboxes === "number" &&
    Number.isFinite(raw.defaultMaxMailboxes)
      ? Math.max(0, Math.min(500, Math.floor(raw.defaultMaxMailboxes)))
      : DEFAULT_USER_CONTROL_SETTINGS.defaultMaxMailboxes;

  const autoDeleteDays =
    typeof raw.autoDeleteDays === "number" &&
    Number.isFinite(raw.autoDeleteDays)
      ? Math.max(1, Math.min(3650, Math.floor(raw.autoDeleteDays)))
      : DEFAULT_USER_CONTROL_SETTINGS.autoDeleteDays;

  return {
    signupEnabled:
      typeof raw.signupEnabled === "boolean"
        ? raw.signupEnabled
        : DEFAULT_USER_CONTROL_SETTINGS.signupEnabled,
    firstNameRequirement: normalizeFieldRequirement(
      raw.firstNameRequirement,
      DEFAULT_USER_CONTROL_SETTINGS.firstNameRequirement,
    ),
    lastNameRequirement: normalizeFieldRequirement(
      raw.lastNameRequirement,
      DEFAULT_USER_CONTROL_SETTINGS.lastNameRequirement,
    ),
    emailRequirement: normalizeFieldRequirement(
      raw.emailRequirement,
      DEFAULT_USER_CONTROL_SETTINGS.emailRequirement,
    ),
    phoneRequirement: normalizeFieldRequirement(
      raw.phoneRequirement,
      DEFAULT_USER_CONTROL_SETTINGS.phoneRequirement,
    ),
    minPasswordLength,
    requireStrongPassword:
      typeof raw.requireStrongPassword === "boolean"
        ? raw.requireStrongPassword
        : DEFAULT_USER_CONTROL_SETTINGS.requireStrongPassword,
    verificationMode: normalizeVerificationMode(
      raw.verificationMode,
      DEFAULT_USER_CONTROL_SETTINGS.verificationMode,
    ),
    inviteCode:
      typeof raw.inviteCode === "string" ? raw.inviteCode.trim() : "",
    allowedDomainUuids: normalizeUuidArray(raw.allowedDomainUuids),
    defaultMaxMailboxes,
    autoProvisionStarterMailbox:
      typeof raw.autoProvisionStarterMailbox === "boolean"
        ? raw.autoProvisionStarterMailbox
        : DEFAULT_USER_CONTROL_SETTINGS.autoProvisionStarterMailbox,
    defaultCanCreateMailboxes:
      typeof raw.defaultCanCreateMailboxes === "boolean"
        ? raw.defaultCanCreateMailboxes
        : DEFAULT_USER_CONTROL_SETTINGS.defaultCanCreateMailboxes,
    defaultCanDeleteMessages:
      typeof raw.defaultCanDeleteMessages === "boolean"
        ? raw.defaultCanDeleteMessages
        : DEFAULT_USER_CONTROL_SETTINGS.defaultCanDeleteMessages,
    defaultCanDeleteMailboxes:
      typeof raw.defaultCanDeleteMailboxes === "boolean"
        ? raw.defaultCanDeleteMailboxes
        : DEFAULT_USER_CONTROL_SETTINGS.defaultCanDeleteMailboxes,
    autoDeleteEnabled:
      typeof raw.autoDeleteEnabled === "boolean"
        ? raw.autoDeleteEnabled
        : DEFAULT_USER_CONTROL_SETTINGS.autoDeleteEnabled,
    autoDeleteDays,
  };
}

export type UserAccessPolicyOverrideInput = {
  readonly [K in keyof ExtendedUserAccessPolicyShape]?:
    | ExtendedUserAccessPolicyShape[K]
    | null;
};

export function normalizeExtendedUserAccessPolicy(
  raw:
    | Partial<Record<keyof ExtendedUserAccessPolicyShape, unknown>>
    | null
    | undefined,
  defaults: UserControlSettingsShape = DEFAULT_USER_CONTROL_SETTINGS,
): ExtendedUserAccessPolicyShape {
  if (!raw) {
    return {
      canCreateMailboxes: defaults.defaultCanCreateMailboxes,
      canDeleteMessages: defaults.defaultCanDeleteMessages,
      canDeleteMailboxes: defaults.defaultCanDeleteMailboxes,
      maxMailboxes: defaults.defaultMaxMailboxes,
      allowedDomainUuids: defaults.allowedDomainUuids,
      autoDeleteEnabled: defaults.autoDeleteEnabled,
      autoDeleteDays: defaults.autoDeleteEnabled ? defaults.autoDeleteDays : 0,
    };
  }

  const autoDeleteEnabled =
    typeof raw.autoDeleteEnabled === "boolean"
      ? raw.autoDeleteEnabled
      : defaults.autoDeleteEnabled;

  const autoDeleteDays = autoDeleteEnabled
    ? typeof raw.autoDeleteDays === "number" &&
      Number.isFinite(raw.autoDeleteDays) &&
      raw.autoDeleteDays > 0
      ? Math.max(1, Math.min(3650, Math.floor(raw.autoDeleteDays)))
      : defaults.autoDeleteDays
    : 0;

  return {
    canCreateMailboxes:
      typeof raw.canCreateMailboxes === "boolean"
        ? raw.canCreateMailboxes
        : defaults.defaultCanCreateMailboxes,
    canDeleteMessages:
      typeof raw.canDeleteMessages === "boolean"
        ? raw.canDeleteMessages
        : defaults.defaultCanDeleteMessages,
    canDeleteMailboxes:
      typeof raw.canDeleteMailboxes === "boolean"
        ? raw.canDeleteMailboxes
        : defaults.defaultCanDeleteMailboxes,
    maxMailboxes:
      typeof raw.maxMailboxes === "number" && Number.isFinite(raw.maxMailboxes)
        ? Math.max(0, Math.min(500, Math.floor(raw.maxMailboxes)))
        : defaults.defaultMaxMailboxes,
    allowedDomainUuids: normalizeUuidArray(raw.allowedDomainUuids),
    autoDeleteEnabled,
    autoDeleteDays,
  };
}

export function resolveEffectiveUserPolicy(
  globalSettings: UserControlSettingsShape,
  userPolicy?: UserAccessPolicyOverrideInput | null,
): ExtendedUserAccessPolicyShape {
  const normalized = normalizeExtendedUserAccessPolicy(
    userPolicy,
    globalSettings,
  );
  const allowedDomainUuids =
    normalized.allowedDomainUuids.length > 0
      ? normalized.allowedDomainUuids
      : globalSettings.allowedDomainUuids;

  return {
    canCreateMailboxes: normalized.canCreateMailboxes,
    canDeleteMessages: normalized.canDeleteMessages,
    canDeleteMailboxes: normalized.canDeleteMailboxes,
    maxMailboxes: normalized.maxMailboxes,
    allowedDomainUuids,
    autoDeleteEnabled: normalized.autoDeleteEnabled,
    autoDeleteDays: normalized.autoDeleteDays,
  };
}

export function isDomainAllowedForUser(
  domainUuid: string,
  effectivePolicy: Pick<ExtendedUserAccessPolicyShape, "allowedDomainUuids">,
): boolean {
  if (effectivePolicy.allowedDomainUuids.length === 0) {
    return true;
  }
  return effectivePolicy.allowedDomainUuids.includes(domainUuid);
}

export function canUserCreateMoreMailboxes(
  currentMailboxCount: number,
  effectivePolicy: Pick<
    ExtendedUserAccessPolicyShape,
    "canCreateMailboxes" | "maxMailboxes"
  >,
): { allowed: boolean; reason?: "disabled" | "quota_reached" } {
  if (!effectivePolicy.canCreateMailboxes) {
    return { allowed: false, reason: "disabled" };
  }
  if (
    effectivePolicy.maxMailboxes > 0 &&
    currentMailboxCount >= effectivePolicy.maxMailboxes
  ) {
    return { allowed: false, reason: "quota_reached" };
  }
  return { allowed: true };
}

export function computeMessageRetentionCutoff(
  effectivePolicy: Pick<
    ExtendedUserAccessPolicyShape,
    "autoDeleteEnabled" | "autoDeleteDays"
  >,
  now: Date = new Date(),
): Date | null {
  if (
    !effectivePolicy.autoDeleteEnabled ||
    effectivePolicy.autoDeleteDays <= 0
  ) {
    return null;
  }
  return new Date(
    now.getTime() - effectivePolicy.autoDeleteDays * 24 * 60 * 60 * 1000,
  );
}

const globalForUserControlSettings = globalThis as typeof globalThis & {
  mailstackDemoUserControlSettings?: UserControlSettingsShape;
  mailstackDemoUserAccessPolicies?: Map<string, ExtendedUserAccessPolicyShape>;
};

function getDemoUserAccessPoliciesMap(): Map<
  string,
  ExtendedUserAccessPolicyShape
> {
  globalForUserControlSettings.mailstackDemoUserAccessPolicies ??= new Map();
  return globalForUserControlSettings.mailstackDemoUserAccessPolicies;
}

export function getDemoUserControlSettings(): UserControlSettingsShape {
  globalForUserControlSettings.mailstackDemoUserControlSettings ??=
    DEFAULT_USER_CONTROL_SETTINGS;
  return globalForUserControlSettings.mailstackDemoUserControlSettings;
}

export function setDemoUserControlSettings(
  settings: UserControlSettingsShape,
): UserControlSettingsShape {
  const normalized = normalizeUserControlSettings(settings);
  globalForUserControlSettings.mailstackDemoUserControlSettings = normalized;
  return normalized;
}

export function getDemoUserAccessPolicy(
  userId: string,
): ExtendedUserAccessPolicyShape | null {
  return getDemoUserAccessPoliciesMap().get(userId) ?? null;
}

export function setDemoUserAccessPolicy(
  userId: string,
  policy: ExtendedUserAccessPolicyShape,
): ExtendedUserAccessPolicyShape {
  const normalized = normalizeExtendedUserAccessPolicy(
    policy,
    getDemoUserControlSettings(),
  );
  getDemoUserAccessPoliciesMap().set(userId, normalized);
  return normalized;
}

export function resetDemoUserControlSettings(): void {
  globalForUserControlSettings.mailstackDemoUserControlSettings =
    DEFAULT_USER_CONTROL_SETTINGS;
  globalForUserControlSettings.mailstackDemoUserAccessPolicies?.clear();
}

export async function getUserControlSettings(
  prisma?: Partial<Pick<PrismaClient, "userControlSettings">> | null,
  options?: GovernanceRuntimeOptions,
): Promise<UserControlSettingsShape> {
  if (!prisma?.userControlSettings) {
    return isDemoGovernanceFallbackAllowed(options)
      ? getDemoUserControlSettings()
      : DEFAULT_USER_CONTROL_SETTINGS;
  }

  try {
    const row = await prisma.userControlSettings.findFirst({
      orderBy: { id: "asc" },
    });
    if (!row) {
      return DEFAULT_USER_CONTROL_SETTINGS;
    }
    return normalizeUserControlSettings({
      signupEnabled: row.signupEnabled,
      firstNameRequirement: row.firstNameRequirement as FieldRequirementMode,
      lastNameRequirement: row.lastNameRequirement as FieldRequirementMode,
      emailRequirement: row.emailRequirement as FieldRequirementMode,
      phoneRequirement: row.phoneRequirement as FieldRequirementMode,
      minPasswordLength: row.minPasswordLength,
      requireStrongPassword: row.requireStrongPassword,
      verificationMode: row.verificationMode as UserVerificationMode,
      inviteCode: row.inviteCode,
      allowedDomainUuids: row.allowedDomainUuids as string[],
      defaultMaxMailboxes: row.defaultMaxMailboxes,
      autoProvisionStarterMailbox: row.autoProvisionStarterMailbox,
      defaultCanCreateMailboxes: row.defaultCanCreateMailboxes,
      defaultCanDeleteMessages: row.defaultCanDeleteMessages,
      defaultCanDeleteMailboxes: row.defaultCanDeleteMailboxes,
      autoDeleteEnabled: row.autoDeleteEnabled,
      autoDeleteDays: row.autoDeleteDays,
    });
  } catch (error) {
    logger.warn("user_control_settings_load_failed", {
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return DEFAULT_USER_CONTROL_SETTINGS;
  }
}

export async function updateUserControlSettings(
  prisma: Partial<Pick<PrismaClient, "userControlSettings" | "auditLog">> | null,
  rawInput: unknown,
  auditContext?: {
    readonly actorId?: bigint | null;
    readonly authSource?: "admin_table" | "user_table";
    readonly actorUsername?: string;
    readonly clientIp?: string | null;
    readonly userAgent?: string | null;
  },
  options?: GovernanceRuntimeOptions,
): Promise<
  | { readonly ok: true; readonly settings: UserControlSettingsShape }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors?: Record<string, string>;
    }
> {
  const parsed = userControlSettingsInputSchema.safeParse(rawInput);
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
      error:
        parsed.error.issues[0]?.message ?? "Invalid user control settings.",
      fieldErrors,
    };
  }

  const normalized = normalizeUserControlSettings(parsed.data);

  if (!prisma?.userControlSettings) {
    if (!isDemoGovernanceFallbackAllowed(options)) {
      return {
        ok: false,
        error: "Database connection is required to save user control settings.",
      };
    }
    setDemoUserControlSettings(normalized);
    return { ok: true, settings: normalized };
  }

  try {
    const existing = await prisma.userControlSettings.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });

    const dataPayload = {
      signupEnabled: normalized.signupEnabled,
      firstNameRequirement: normalized.firstNameRequirement,
      lastNameRequirement: normalized.lastNameRequirement,
      emailRequirement: normalized.emailRequirement,
      phoneRequirement: normalized.phoneRequirement,
      minPasswordLength: normalized.minPasswordLength,
      requireStrongPassword: normalized.requireStrongPassword,
      verificationMode: normalized.verificationMode,
      inviteCode: normalized.inviteCode,
      allowedDomainUuids: [...normalized.allowedDomainUuids],
      defaultMaxMailboxes: normalized.defaultMaxMailboxes,
      autoProvisionStarterMailbox: normalized.autoProvisionStarterMailbox,
      defaultCanCreateMailboxes: normalized.defaultCanCreateMailboxes,
      defaultCanDeleteMessages: normalized.defaultCanDeleteMessages,
      defaultCanDeleteMailboxes: normalized.defaultCanDeleteMailboxes,
      autoDeleteEnabled: normalized.autoDeleteEnabled,
      autoDeleteDays: normalized.autoDeleteDays,
    };

    if (existing) {
      await prisma.userControlSettings.update({
        where: { id: existing.id },
        data: dataPayload,
      });
    } else {
      await prisma.userControlSettings.create({
        data: dataPayload,
      });
    }

    if (prisma.auditLog) {
      await recordAudit(prisma as unknown as AuditWriteClient, {
        actorId: auditContext?.actorId ?? null,
        authSource: auditContext?.authSource,
        actorUsername: auditContext?.actorUsername,
        action: "user_control_settings_updated",
        targetType: "user_control_settings",
        targetIdentifier: "global",
        clientIp: auditContext?.clientIp,
        userAgent: auditContext?.userAgent,
        details: {
          signup_enabled: normalized.signupEnabled,
          verification_mode: normalized.verificationMode,
          default_max_mailboxes: normalized.defaultMaxMailboxes,
          auto_delete_enabled: normalized.autoDeleteEnabled,
          auto_delete_days: normalized.autoDeleteDays,
        },
      });
    }

    setDemoUserControlSettings(normalized);
    return { ok: true, settings: normalized };
  } catch (error) {
    logger.error("user_control_settings_update_failed", {
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return {
      ok: false,
      error:
        "Could not save user control policy to database. Please try again.",
    };
  }
}

export async function getUserExtendedPolicy(
  prisma: Partial<Pick<PrismaClient, "userAccessPolicy">> | null,
  rawUserId: string | bigint,
  globalSettings: UserControlSettingsShape = DEFAULT_USER_CONTROL_SETTINGS,
): Promise<ExtendedUserAccessPolicyShape> {
  const userIdStr = rawUserId.toString();

  if (!prisma?.userAccessPolicy) {
    const demoPolicy = getDemoUserAccessPolicy(userIdStr);
    return resolveEffectiveUserPolicy(globalSettings, demoPolicy);
  }

  try {
    const numericId =
      typeof rawUserId === "bigint" ? rawUserId : BigInt(userIdStr);
    const row = await prisma.userAccessPolicy.findUnique({
      where: { userId: numericId },
    });
    if (!row) {
      const demoPolicy = getDemoUserAccessPolicy(userIdStr);
      return resolveEffectiveUserPolicy(globalSettings, demoPolicy);
    }
    return resolveEffectiveUserPolicy(globalSettings, {
      canCreateMailboxes: row.canCreateMailboxes,
      canDeleteMessages: row.canDeleteMessages,
      canDeleteMailboxes: row.canDeleteMailboxes,
      maxMailboxes: row.maxMailboxes,
      allowedDomainUuids: Array.isArray(row.allowedDomainUuids)
        ? (row.allowedDomainUuids as string[])
        : [],
      autoDeleteEnabled: row.autoDeleteEnabled,
      autoDeleteDays: row.autoDeleteDays,
    });
  } catch {
    const demoPolicy = getDemoUserAccessPolicy(userIdStr);
    return resolveEffectiveUserPolicy(globalSettings, demoPolicy);
  }
}

export async function updateUserExtendedPolicy(
  prisma: Partial<
    Pick<
      PrismaClient,
      "user" | "userAccessPolicy" | "userControlSettings" | "auditLog"
    >
  > | null,
  rawUserId: string,
  rawInput: unknown,
  auditContext?: {
    readonly actorId?: bigint | null;
    readonly authSource?: "admin_table" | "user_table";
    readonly actorUsername?: string;
    readonly clientIp?: string | null;
    readonly userAgent?: string | null;
  },
  options?: GovernanceRuntimeOptions,
): Promise<
  | { readonly ok: true; readonly policy: ExtendedUserAccessPolicyShape }
  | { readonly ok: false; readonly error: string }
> {
  const trimmedId = rawUserId.trim();
  if (!/^[1-9]\d*$/.test(trimmedId)) {
    return { ok: false, error: "Invalid user identifier." };
  }

  const parsed = extendedUserAccessPolicyInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid user permission settings.",
    };
  }

  const globalSettings = await getUserControlSettings(prisma, options);
  const normalized = normalizeExtendedUserAccessPolicy(
    parsed.data,
    globalSettings,
  );

  if (!prisma?.userAccessPolicy) {
    if (!isDemoGovernanceFallbackAllowed(options)) {
      return {
        ok: false,
        error:
          "Database connection is required to save user permission overrides.",
      };
    }
    setDemoUserAccessPolicy(trimmedId, normalized);
    return { ok: true, policy: normalized };
  }

  try {
    const userId = BigInt(trimmedId);
    await prisma.userAccessPolicy.upsert({
      where: { userId },
      create: {
        userId,
        canCreateMailboxes: normalized.canCreateMailboxes,
        canDeleteMessages: normalized.canDeleteMessages,
        canDeleteMailboxes: normalized.canDeleteMailboxes,
        maxMailboxes: normalized.maxMailboxes,
        allowedDomainUuids: [...normalized.allowedDomainUuids],
        autoDeleteEnabled: normalized.autoDeleteEnabled,
        autoDeleteDays: normalized.autoDeleteDays,
      },
      update: {
        canCreateMailboxes: normalized.canCreateMailboxes,
        canDeleteMessages: normalized.canDeleteMessages,
        canDeleteMailboxes: normalized.canDeleteMailboxes,
        maxMailboxes: normalized.maxMailboxes,
        allowedDomainUuids: [...normalized.allowedDomainUuids],
        autoDeleteEnabled: normalized.autoDeleteEnabled,
        autoDeleteDays: normalized.autoDeleteDays,
      },
    });

    if (prisma.auditLog) {
      await recordAudit(prisma as unknown as AuditWriteClient, {
        actorId: auditContext?.actorId ?? null,
        authSource: auditContext?.authSource,
        actorUsername: auditContext?.actorUsername,
        action: "user_access_policy_updated",
        targetType: "user",
        targetIdentifier: trimmedId,
        clientIp: auditContext?.clientIp,
        userAgent: auditContext?.userAgent,
        details: {
          can_create_mailboxes: normalized.canCreateMailboxes,
          max_mailboxes: normalized.maxMailboxes,
          allowed_domain_uuids: normalized.allowedDomainUuids,
          auto_delete_enabled: normalized.autoDeleteEnabled,
          auto_delete_days: normalized.autoDeleteDays,
        },
      });
    }

    setDemoUserAccessPolicy(trimmedId, normalized);
    return { ok: true, policy: normalized };
  } catch (error) {
    logger.error("user_access_policy_update_failed", {
      user_id: trimmedId,
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return {
      ok: false,
      error:
        "Could not save user access policy to database. Please try again.",
    };
  }
}

function countDemoMailboxesForAccount(account: {
  readonly id: string;
  readonly username: string;
}): number {
  const demoStoreMailboxes = (
    globalThis as {
      __readboxDemoUserStore?: {
        mailboxes?: ReadonlyArray<{ ownerUserId?: string }>;
      };
    }
  ).__readboxDemoUserStore?.mailboxes;

  if (!demoStoreMailboxes) {
    return account.username === "demo.user" ? 4 : 0;
  }

  return demoStoreMailboxes.filter((mbx) => {
    if (mbx.ownerUserId) {
      return mbx.ownerUserId === account.id;
    }
    return account.username === "demo.user";
  }).length;
}

export async function listUsersControlSnapshot(
  prisma?: PrismaClient | null,
  options?: GovernanceRuntimeOptions,
): Promise<{
  readonly settings: UserControlSettingsShape;
  readonly domains: readonly ControlDomainOption[];
  readonly pendingUsers: readonly PendingSignupUserItem[];
  readonly governedUsers: readonly GovernedUserPolicyItem[];
  readonly databaseConnected: boolean;
  readonly databaseError?: string;
}> {
  const settings = await getUserControlSettings(prisma ?? null, options);

  if (prisma) {
    try {
      const [dbDomains, dbUsers] = await Promise.all([
        prisma.domain.findMany({
          where: { status: "active", verificationStatus: "verified" },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: { uuid: true, name: true, isDefault: true },
        }),
        prisma.user.findMany({
          where: { administratorProfile: { is: null } },
          orderBy: [{ dateJoined: "desc" }, { username: "asc" }],
          take: 100,
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            verificationStatus: true,
            dateJoined: true,
            accessPolicy: true,
            _count: {
              select: {
                memberships: {
                  where: { mailbox: { deletedAt: null } },
                },
              },
            },
          },
        }),
      ]);

      const pendingUsers: PendingSignupUserItem[] = dbUsers
        .filter((u) => u.verificationStatus === "pending_approval")
        .map((u) => ({
          id: u.id.toString(),
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: u.phone,
          dateJoined: u.dateJoined.toISOString(),
        }));

      const governedUsers: GovernedUserPolicyItem[] = dbUsers.map((u) => ({
        id: u.id.toString(),
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        verificationStatus: u.verificationStatus,
        mailboxCount: u._count.memberships,
        policy: resolveEffectiveUserPolicy(
          settings,
          u.accessPolicy
            ? {
                canCreateMailboxes: u.accessPolicy.canCreateMailboxes,
                canDeleteMessages: u.accessPolicy.canDeleteMessages,
                canDeleteMailboxes: u.accessPolicy.canDeleteMailboxes,
                maxMailboxes: u.accessPolicy.maxMailboxes,
                allowedDomainUuids: Array.isArray(
                  u.accessPolicy.allowedDomainUuids,
                )
                  ? (u.accessPolicy.allowedDomainUuids as string[])
                  : [],
                autoDeleteEnabled: u.accessPolicy.autoDeleteEnabled,
                autoDeleteDays: u.accessPolicy.autoDeleteDays,
              }
            : null,
        ),
      }));

      return {
        settings,
        domains: dbDomains,
        pendingUsers,
        governedUsers,
        databaseConnected: true,
      };
    } catch (error) {
      logger.error("users_control_snapshot_load_failed", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      return {
        settings,
        domains: [],
        pendingUsers: [],
        governedUsers: [],
        databaseConnected: false,
        databaseError:
          "Unable to load verified domains and governed users from PostgreSQL.",
      };
    }
  }

  if (!isDemoGovernanceFallbackAllowed(options)) {
    return {
      settings,
      domains: [],
      pendingUsers: [],
      governedUsers: [],
      databaseConnected: false,
      databaseError: "Database connection is not configured.",
    };
  }

  const demoAccounts = [
    ...DEV_DEMO_ACCOUNTS.filter((acc) => !acc.isAdministrator),
    ...listDevDemoDynamicUsers(),
  ];

  const pendingUsers: PendingSignupUserItem[] = demoAccounts
    .filter((acc) => acc.verificationStatus === "pending_approval")
    .map((acc) => ({
      id: acc.id,
      username: acc.username,
      firstName: acc.firstName,
      lastName: acc.lastName,
      email: acc.email,
      phone: acc.phone ?? "",
      dateJoined: new Date().toISOString(),
    }));

  const governedUsers: GovernedUserPolicyItem[] = demoAccounts.map((acc) => ({
    id: acc.id,
    username: acc.username,
    firstName: acc.firstName,
    lastName: acc.lastName,
    email: acc.email,
    phone: acc.phone ?? "",
    isActive: acc.isActive !== false,
    verificationStatus: acc.verificationStatus ?? "verified",
    mailboxCount: countDemoMailboxesForAccount(acc),
    policy: resolveEffectiveUserPolicy(
      settings,
      getDemoUserAccessPolicy(acc.id),
    ),
  }));

  return {
    settings,
    domains: [...DEMO_VERIFIED_DOMAINS],
    pendingUsers,
    governedUsers,
    databaseConnected: false,
  };
}
