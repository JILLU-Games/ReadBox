import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/core/auth/password-policy";
import { z } from "zod";

const PHONE_PATTERN = /^[+\d().\-\s]{4,40}$/;

export const userProfileUpdateSchema = z.object({
  firstName: z
    .string()
    .trim()
    .max(150, "First name cannot exceed 150 characters.")
    .default(""),
  lastName: z
    .string()
    .trim()
    .max(150, "Last name cannot exceed 150 characters.")
    .default(""),
  email: z
    .string()
    .trim()
    .max(254, "Email cannot exceed 254 characters.")
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Enter a valid email address or leave blank.",
    )
    .default(""),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number cannot exceed 40 characters.")
    .refine(
      (value) => value === "" || PHONE_PATTERN.test(value),
      "Enter a valid phone number or leave blank.",
    )
    .default(""),
});

export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;

export interface UserPasswordPolicySummary {
  readonly minLength: number;
  readonly requireStrongPassword: boolean;
}

export const DEFAULT_USER_PASSWORD_POLICY: UserPasswordPolicySummary = {
  minLength: MIN_PASSWORD_LENGTH,
  requireStrongPassword: true,
};

export interface UserPasswordUpdateInput {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
  readonly revokeOtherSessions?: boolean;
}

export interface UserSessionSummaryItem {
  readonly id: string;
  readonly label: string;
  readonly ipAddress: string | null;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
  readonly expiresAt: string;
  readonly isCurrent: boolean;
}

export interface UserSecurityEventItem {
  readonly id: string;
  readonly action: string;
  readonly label: string;
  readonly ipAddress: string | null;
  readonly createdAt: string;
  readonly outcome: "success" | "warning" | "info";
}

export interface UserSecuritySnapshot {
  readonly passwordPolicy: UserPasswordPolicySummary;
  readonly activeSessions: readonly UserSessionSummaryItem[];
  readonly recentEvents: readonly UserSecurityEventItem[];
  readonly canManageSecurity: boolean;
}

export interface UserProfileRecord {
  readonly id: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly isAdministrator: boolean;
  readonly authSource: "user_table" | "admin_table";
  readonly editable: boolean;
  readonly dateJoined: string | null;
  readonly lastLogin: string | null;
}

export type UserProfileActionResult<T = UserProfileRecord> =
  | {
      readonly ok: true;
      readonly data: T;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | "validation"
        | "not_found"
        | "admin_protected"
        | "unavailable";
      readonly error: string;
      readonly fieldErrors?: Record<string, string>;
    };

export function validateUserProfileInput(rawInput: unknown):
  | { readonly ok: true; readonly data: UserProfileUpdateInput }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors: Record<string, string>;
    } {
  const parsed = userProfileUpdateSchema.safeParse(rawInput);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return {
    ok: false,
    error: parsed.error.issues[0]?.message ?? "Review the profile fields.",
    fieldErrors,
  };
}

export function hasStrongPasswordCharacters(password: string): boolean {
  return (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

const passwordUpdateBaseSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(1024),
  newPassword: z.string().max(MAX_PASSWORD_LENGTH),
  confirmPassword: z.string(),
  revokeOtherSessions: z.boolean().optional().default(true),
});

export function validateUserPasswordInput(
  rawInput: unknown,
  policy: UserPasswordPolicySummary = DEFAULT_USER_PASSWORD_POLICY,
):
  | {
      readonly ok: true;
      readonly data: {
        readonly currentPassword: string;
        readonly newPassword: string;
        readonly confirmPassword: string;
        readonly revokeOtherSessions: boolean;
      };
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly fieldErrors: Record<string, string>;
    } {
  const parsed = passwordUpdateBaseSchema.safeParse(rawInput);
  const fieldErrors: Record<string, string> = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Review the password fields.",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const minLen = Math.max(8, policy.minLength);

  if (data.newPassword.length < minLen) {
    fieldErrors.newPassword = `New password must be at least ${minLen} characters.`;
  } else if (data.newPassword.length > MAX_PASSWORD_LENGTH) {
    fieldErrors.newPassword = `New password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`;
  } else if (
    policy.requireStrongPassword &&
    !hasStrongPasswordCharacters(data.newPassword)
  ) {
    fieldErrors.newPassword =
      "New password must include uppercase, lowercase, number, and symbol characters.";
  } else if (data.newPassword === data.currentPassword) {
    fieldErrors.newPassword =
      "New password must be different from your current password.";
  }

  if (!data.confirmPassword) {
    fieldErrors.confirmPassword = "Confirm your new password.";
  } else if (data.newPassword !== data.confirmPassword) {
    fieldErrors.confirmPassword = "Password confirmation does not match.";
  }

  const firstError = Object.values(fieldErrors)[0];
  if (firstError) {
    return {
      ok: false,
      error: firstError,
      fieldErrors,
    };
  }

  return { ok: true, data };
}

export function formatUserAgentSummary(userAgent: string | null | undefined): string {
  const raw = (userAgent ?? "").trim();
  if (!raw) return "Web session";

  const browser = /Edg\//i.test(raw)
    ? "Edge"
    : /Chrome\//i.test(raw) && !/Chromium\//i.test(raw)
      ? "Chrome"
      : /Firefox\//i.test(raw)
        ? "Firefox"
        : /Safari\//i.test(raw) && !/Chrome\//i.test(raw)
          ? "Safari"
          : "Browser";

  const os = /Windows/i.test(raw)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(raw)
      ? "macOS"
      : /Android/i.test(raw)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(raw)
          ? "iOS"
          : /Linux/i.test(raw)
            ? "Linux"
            : "";

  return os ? `${browser} · ${os}` : browser;
}

export function formatSecurityEventLabel(action: string): {
  readonly label: string;
  readonly outcome: "success" | "warning" | "info";
} {
  switch (action) {
    case "login_success":
      return { label: "Signed in", outcome: "success" };
    case "login_failure":
      return { label: "Failed sign-in attempt", outcome: "warning" };
    case "user_password_changed":
      return { label: "Password updated", outcome: "success" };
    case "password_reset_requested":
      return { label: "Password reset token issued", outcome: "info" };
    case "password_reset_completed":
      return { label: "Password reset completed", outcome: "success" };
    case "user_self_signup":
      return { label: "Account registered", outcome: "success" };
    case "user_signup_approved":
      return { label: "Account registration approved", outcome: "success" };
    case "user_signup_rejected":
      return { label: "Account registration rejected", outcome: "warning" };
    case "user_profile_updated":
      return { label: "Profile updated", outcome: "info" };
    case "user_session_revoked":
      return { label: "Session revoked", outcome: "info" };
    case "user_sessions_revoked":
      return { label: "Other sessions signed out", outcome: "info" };
    default:
      return { label: action.replaceAll("_", " "), outcome: "info" };
  }
}
