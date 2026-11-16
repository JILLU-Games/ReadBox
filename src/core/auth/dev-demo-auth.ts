import {
  DEFAULT_USER_PASSWORD_POLICY,
  formatSecurityEventLabel,
  type UserPasswordPolicySummary,
  type UserSecurityEventItem,
  type UserSecuritySnapshot,
  type UserSessionSummaryItem,
  validateUserPasswordInput,
} from "@/core/accounts/user-profile-schema";
import { isOpaqueToken } from "@/core/auth/opaque-token";
import { SESSION_MAX_AGE_SECONDS } from "@/core/auth/password-policy";
import { z } from "zod";

export interface DevDemoAccount {
  readonly id: string;
  readonly numericId: bigint;
  readonly username: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string;
  readonly isActive?: boolean;
  readonly verificationStatus?: "verified" | "pending_approval" | "rejected";
  readonly isAdministrator: boolean;
  readonly isSuperuser: boolean;
  readonly authSource?: "admin_table" | "user_table";
}

export const DEV_DEMO_ACCOUNTS: readonly DevDemoAccount[] = Object.freeze([
  {
    id: "9001",
    numericId: BigInt(9001),
    username: "demo.admin",
    password: "demo-admin-local-dev",
    firstName: "Demo",
    lastName: "Admin",
    email: "admin@readbox.local",
    phone: "",
    isActive: true,
    verificationStatus: "verified",
    isAdministrator: true,
    isSuperuser: true,
    authSource: "admin_table",
  },
  {
    id: "9002",
    numericId: BigInt(9002),
    username: "demo.user",
    password: "demo-user-local-dev",
    firstName: "Demo",
    lastName: "User",
    email: "user@readbox.local",
    phone: "",
    isActive: true,
    verificationStatus: "verified",
    isAdministrator: false,
    isSuperuser: false,
    authSource: "user_table",
  },
]);

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(1024),
  loginScope: z.enum(["admin", "user"]).optional(),
});

export interface DevDemoProfileOverride {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
}

interface DevDemoSessionMeta {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly label: string;
}

interface DevDemoSecurityEvent {
  readonly id: string;
  readonly userId: string;
  readonly action: string;
  readonly ipAddress: string | null;
  readonly createdAt: string;
}

const globalForDevDemoSessions = globalThis as typeof globalThis & {
  mailstackDevDemoSessions?: Map<string, string>;
  mailstackDevDemoDynamicUsers?: Map<string, DevDemoAccount>;
  mailstackDevDemoNextId?: bigint;
  readboxDevDemoProfileOverrides?: Map<string, DevDemoProfileOverride>;
  readboxDevDemoPasswordOverrides?: Map<string, string>;
  readboxDevDemoSessionMeta?: Map<string, DevDemoSessionMeta>;
  readboxDevDemoNextSessionSeq?: number;
  readboxDevDemoSecurityEvents?: DevDemoSecurityEvent[];
  readboxDevDemoNextEventSeq?: number;
};

function getSessionStore(): Map<string, string> {
  globalForDevDemoSessions.mailstackDevDemoSessions ??= new Map();
  return globalForDevDemoSessions.mailstackDevDemoSessions;
}

function getDynamicUserStore(): Map<string, DevDemoAccount> {
  globalForDevDemoSessions.mailstackDevDemoDynamicUsers ??= new Map();
  return globalForDevDemoSessions.mailstackDevDemoDynamicUsers;
}

function getProfileOverrideStore(): Map<string, DevDemoProfileOverride> {
  globalForDevDemoSessions.readboxDevDemoProfileOverrides ??= new Map();
  return globalForDevDemoSessions.readboxDevDemoProfileOverrides;
}

function getPasswordOverrideStore(): Map<string, string> {
  globalForDevDemoSessions.readboxDevDemoPasswordOverrides ??= new Map();
  return globalForDevDemoSessions.readboxDevDemoPasswordOverrides;
}

function getSessionMetaStore(): Map<string, DevDemoSessionMeta> {
  globalForDevDemoSessions.readboxDevDemoSessionMeta ??= new Map();
  return globalForDevDemoSessions.readboxDevDemoSessionMeta;
}

function getSecurityEventStore(): DevDemoSecurityEvent[] {
  globalForDevDemoSessions.readboxDevDemoSecurityEvents ??= [];
  return globalForDevDemoSessions.readboxDevDemoSecurityEvents;
}

function appendDemoSecurityEvent(userId: string, action: string) {
  const nextSeq = (globalForDevDemoSessions.readboxDevDemoNextEventSeq ?? 1);
  globalForDevDemoSessions.readboxDevDemoNextEventSeq = nextSeq + 1;
  const events = getSecurityEventStore();
  events.unshift({
    id: `demo-evt-${nextSeq}`,
    userId,
    action,
    ipAddress: "127.0.0.1",
    createdAt: new Date().toISOString(),
  });
  if (events.length > 100) {
    events.length = 100;
  }
}

function applyAccountOverrides(account: DevDemoAccount): DevDemoAccount {
  const profileOverride = getProfileOverrideStore().get(account.id);
  const passwordOverride = getPasswordOverrideStore().get(account.id);
  if (!profileOverride && passwordOverride === undefined) return account;
  return {
    ...account,
    ...(profileOverride ?? {}),
    ...(passwordOverride !== undefined ? { password: passwordOverride } : {}),
  };
}

function getAllDevDemoAccounts(): DevDemoAccount[] {
  return [
    ...DEV_DEMO_ACCOUNTS,
    ...Array.from(getDynamicUserStore().values()),
  ].map(applyAccountOverrides);
}

function toCurrentUserIdentity(account: DevDemoAccount) {
  return {
    id: account.numericId,
    username: account.username,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone ?? "",
    isActive: account.isActive !== false,
    passwordResetRequired: false,
    isAdministrator: account.isAdministrator,
    isSuperuser: account.isSuperuser,
    authSource:
      account.authSource ??
      (account.isAdministrator ? "admin_table" : "user_table"),
  };
}

export function getDevBypassUser(role: "user" | "admin") {
  const account =
    getAllDevDemoAccounts().find((candidate) =>
      role === "admin" ? candidate.isAdministrator : !candidate.isAdministrator,
    ) ?? DEV_DEMO_ACCOUNTS[0];

  return toCurrentUserIdentity(account);
}

export function authorizeDevDemoCredentials(
  nodeEnv: "development" | "test" | "production",
  credentials: Partial<
    Record<"username" | "password" | "loginScope", unknown>
  >,
) {
  if (nodeEnv !== "development") return null;

  const parsed = credentialsSchema.safeParse({
    username: credentials.username,
    password: credentials.password,
    loginScope:
      credentials.loginScope === "admin" || credentials.loginScope === "user"
        ? credentials.loginScope
        : undefined,
  });
  if (!parsed.success) return null;

  const username = parsed.data.username.toLowerCase();
  const loginScope = parsed.data.loginScope;
  const account = getAllDevDemoAccounts().find(
    (candidate) => candidate.username.toLowerCase() === username,
  );
  if (!account) return null;

  if (account.password !== parsed.data.password) {
    appendDemoSecurityEvent(account.id, "login_failure");
    return null;
  }

  if (account.isActive === false) {
    return null;
  }

  if (
    account.verificationStatus &&
    account.verificationStatus !== "verified"
  ) {
    return null;
  }

  if (loginScope === "admin" && !account.isAdministrator) {
    return null;
  }

  if (loginScope === "user" && account.isAdministrator) {
    return null;
  }

  appendDemoSecurityEvent(account.id, "login_success");

  return {
    id: account.id,
    username: account.username,
    name: [account.firstName, account.lastName].filter(Boolean).join(" "),
    email: account.email,
    isAdministrator: account.isAdministrator,
    isSuperuser: account.isSuperuser,
    authSource:
      account.authSource ??
      (account.isAdministrator ? "admin_table" : "user_table"),
  };
}

export function registerDevDemoSignupUser(input: {
  readonly username: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly verificationStatus: "verified" | "pending_approval";
}): DevDemoAccount | null {
  const normalizedUsername = input.username.trim().toLowerCase();
  const exists = getAllDevDemoAccounts().some(
    (candidate) => candidate.username.toLowerCase() === normalizedUsername,
  );
  if (exists) return null;

  const nextNumericId =
    globalForDevDemoSessions.mailstackDevDemoNextId ?? BigInt(9100);
  globalForDevDemoSessions.mailstackDevDemoNextId = nextNumericId + BigInt(1);

  const account: DevDemoAccount = {
    id: nextNumericId.toString(),
    numericId: nextNumericId,
    username: input.username.trim(),
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    isActive: input.verificationStatus === "verified",
    verificationStatus: input.verificationStatus,
    isAdministrator: false,
    isSuperuser: false,
    authSource: "user_table",
  };

  getDynamicUserStore().set(account.id, account);
  return account;
}

export function listDevDemoDynamicUsers(): DevDemoAccount[] {
  return Array.from(getDynamicUserStore().values());
}

export function updateDevDemoDynamicUserStatus(
  userId: string,
  status: "verified" | "rejected",
): DevDemoAccount | null {
  const existing = getDynamicUserStore().get(userId);
  if (!existing) return null;
  const updated: DevDemoAccount = {
    ...existing,
    isActive: status === "verified",
    verificationStatus: status,
  };
  getDynamicUserStore().set(userId, updated);
  return updated;
}

export function registerDevDemoSession(
  nodeEnv: "development" | "test" | "production",
  userId: string,
  sessionId: string,
): boolean {
  if (nodeEnv !== "development" || !isOpaqueToken(sessionId)) return false;
  const account = getAllDevDemoAccounts().find(
    (candidate) =>
      candidate.id === userId &&
      candidate.isActive !== false &&
      (candidate.verificationStatus ?? "verified") === "verified",
  );
  if (!account) return false;

  getSessionStore().set(sessionId, account.id);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  const seq = globalForDevDemoSessions.readboxDevDemoNextSessionSeq ?? 1;
  globalForDevDemoSessions.readboxDevDemoNextSessionSeq = seq + 1;
  getSessionMetaStore().set(sessionId, {
    id: `demo-sess-${seq}`,
    userId: account.id,
    sessionId,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    label: "Local demo browser",
  });
  return true;
}

export function getActiveDevDemoSession(
  nodeEnv: "development" | "test" | "production",
  userId: string,
  sessionId: string,
) {
  if (nodeEnv !== "development" || !isOpaqueToken(sessionId)) return null;
  const storedUserId = getSessionStore().get(sessionId);
  if (storedUserId !== userId) return null;

  const meta = getSessionMetaStore().get(sessionId);
  if (meta) {
    getSessionMetaStore().set(sessionId, {
      ...meta,
      lastSeenAt: new Date().toISOString(),
    });
  }

  const account = getAllDevDemoAccounts().find(
    (candidate) =>
      candidate.id === userId &&
      candidate.isActive !== false &&
      (candidate.verificationStatus ?? "verified") === "verified",
  );
  return account ? toCurrentUserIdentity(account) : null;
}

export function revokeDevDemoSession(sessionId: string): void {
  if (!isOpaqueToken(sessionId)) return;
  getSessionStore().delete(sessionId);
  getSessionMetaStore().delete(sessionId);
}

export function getDevDemoUserById(
  nodeEnv: "development" | "test" | "production",
  userId: string,
) {
  if (nodeEnv !== "development") return null;
  const account = getAllDevDemoAccounts().find(
    (candidate) =>
      candidate.id === userId &&
      candidate.isActive !== false &&
      (candidate.verificationStatus ?? "verified") === "verified",
  );
  return account ? toCurrentUserIdentity(account) : null;
}

export function getDevDemoProfile(userId: string) {
  const account = getAllDevDemoAccounts().find(
    (candidate) => candidate.id === userId,
  );
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone ?? "",
    isAdministrator: account.isAdministrator,
    authSource:
      account.authSource ??
      (account.isAdministrator ? "admin_table" : "user_table"),
    editable: !account.isAdministrator,
    dateJoined: null,
    lastLogin: null,
  };
}

export function updateDevDemoProfile(
  userId: string,
  patch: DevDemoProfileOverride,
) {
  const existing = getAllDevDemoAccounts().find(
    (candidate) => candidate.id === userId,
  );
  if (!existing || existing.isAdministrator) {
    return null;
  }

  const normalized: DevDemoProfileOverride = {
    firstName: patch.firstName.trim(),
    lastName: patch.lastName.trim(),
    email: patch.email.trim(),
    phone: patch.phone.trim(),
  };
  getProfileOverrideStore().set(existing.id, normalized);

  const dynamic = getDynamicUserStore().get(existing.id);
  if (dynamic) {
    getDynamicUserStore().set(existing.id, {
      ...dynamic,
      ...normalized,
    });
  }

  appendDemoSecurityEvent(existing.id, "user_profile_updated");
  return getDevDemoProfile(existing.id);
}

export function getDevDemoSecuritySnapshot(
  userId: string,
  currentSessionId: string | null = null,
  passwordPolicy: UserPasswordPolicySummary = DEFAULT_USER_PASSWORD_POLICY,
): UserSecuritySnapshot {
  const account = getAllDevDemoAccounts().find(
    (candidate) => candidate.id === userId,
  );
  const now = Date.now();
  const activeSessions: UserSessionSummaryItem[] = Array.from(
    getSessionMetaStore().values(),
  )
    .filter(
      (entry) =>
        entry.userId === userId &&
        Date.parse(entry.expiresAt) > now &&
        getSessionStore().get(entry.sessionId) === userId,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      ipAddress: "127.0.0.1",
      createdAt: entry.createdAt,
      lastSeenAt: entry.lastSeenAt,
      expiresAt: entry.expiresAt,
      isCurrent: Boolean(currentSessionId && entry.sessionId === currentSessionId),
    }));

  const recentEvents: UserSecurityEventItem[] = getSecurityEventStore()
    .filter((evt) => evt.userId === userId)
    .slice(0, 10)
    .map((evt) => {
      const formatted = formatSecurityEventLabel(evt.action);
      return {
        id: evt.id,
        action: evt.action,
        label: formatted.label,
        ipAddress: evt.ipAddress,
        createdAt: evt.createdAt,
        outcome: formatted.outcome,
      };
    });

  return {
    passwordPolicy,
    activeSessions,
    recentEvents,
    canManageSecurity: Boolean(account && !account.isAdministrator),
  };
}

export function updateDevDemoPassword(
  userId: string,
  rawInput: unknown,
  currentSessionId: string | null = null,
  passwordPolicy: UserPasswordPolicySummary = DEFAULT_USER_PASSWORD_POLICY,
):
  | {
      readonly ok: true;
      readonly message: string;
      readonly data: { readonly revokedOtherSessions: number };
    }
  | {
      readonly ok: false;
      readonly code: "validation" | "not_found" | "admin_protected";
      readonly error: string;
      readonly fieldErrors?: Record<string, string>;
    } {
  const existing = getAllDevDemoAccounts().find(
    (candidate) => candidate.id === userId,
  );
  if (!existing) {
    return { ok: false, code: "not_found", error: "Account not found." };
  }
  if (existing.isAdministrator) {
    return {
      ok: false,
      code: "admin_protected",
      error: "Administrator accounts cannot update password here.",
    };
  }

  const validated = validateUserPasswordInput(rawInput, passwordPolicy);
  if (!validated.ok) {
    return {
      ok: false,
      code: "validation",
      error: validated.error,
      fieldErrors: validated.fieldErrors,
    };
  }

  if (existing.password !== validated.data.currentPassword) {
    return {
      ok: false,
      code: "validation",
      error: "Current password is incorrect.",
      fieldErrors: { currentPassword: "Current password is incorrect." },
    };
  }

  getPasswordOverrideStore().set(existing.id, validated.data.newPassword);
  const dynamic = getDynamicUserStore().get(existing.id);
  if (dynamic) {
    getDynamicUserStore().set(existing.id, {
      ...dynamic,
      password: validated.data.newPassword,
    });
  }

  let revokedOtherSessions = 0;
  if (validated.data.revokeOtherSessions) {
    for (const [sid, meta] of getSessionMetaStore().entries()) {
      if (meta.userId === existing.id && sid !== currentSessionId) {
        getSessionStore().delete(sid);
        getSessionMetaStore().delete(sid);
        revokedOtherSessions += 1;
      }
    }
  }

  appendDemoSecurityEvent(existing.id, "user_password_changed");

  return {
    ok: true,
    data: { revokedOtherSessions },
    message:
      revokedOtherSessions > 0
        ? `Password updated and ${revokedOtherSessions} other active session(s) signed out.`
        : "Password updated.",
  };
}

export function revokeDevDemoUserSessionById(
  userId: string,
  sessionRecordId: string,
  currentSessionId: string | null = null,
):
  | { readonly ok: true; readonly message: string; readonly data: { readonly revoked: number } }
  | { readonly ok: false; readonly code: "validation" | "not_found"; readonly error: string } {
  for (const [sid, meta] of getSessionMetaStore().entries()) {
    if (meta.userId === userId && meta.id === sessionRecordId) {
      if (currentSessionId && sid === currentSessionId) {
        return {
          ok: false,
          code: "validation",
          error: "Use Sign out in the header to end your current session.",
        };
      }
      getSessionStore().delete(sid);
      getSessionMetaStore().delete(sid);
      appendDemoSecurityEvent(userId, "user_session_revoked");
      return {
        ok: true,
        data: { revoked: 1 },
        message: "Session revoked.",
      };
    }
  }

  return { ok: false, code: "not_found", error: "Session not found." };
}

export function revokeDevDemoOtherUserSessions(
  userId: string,
  currentSessionId: string | null = null,
): { readonly ok: true; readonly message: string; readonly data: { readonly revoked: number } } {
  let revoked = 0;
  for (const [sid, meta] of getSessionMetaStore().entries()) {
    if (meta.userId === userId && sid !== currentSessionId) {
      getSessionStore().delete(sid);
      getSessionMetaStore().delete(sid);
      revoked += 1;
    }
  }

  if (revoked > 0) {
    appendDemoSecurityEvent(userId, "user_sessions_revoked");
  }

  return {
    ok: true,
    data: { revoked },
    message:
      revoked > 0
        ? `Signed out ${revoked} other active session(s).`
        : "No other active sessions to sign out.",
  };
}

export function clearDevDemoSessions(): void {
  getSessionStore().clear();
  getDynamicUserStore().clear();
  getProfileOverrideStore().clear();
  getPasswordOverrideStore().clear();
  getSessionMetaStore().clear();
  getSecurityEventStore().length = 0;
  globalForDevDemoSessions.mailstackDevDemoNextId = BigInt(9100);
  globalForDevDemoSessions.readboxDevDemoNextSessionSeq = 1;
  globalForDevDemoSessions.readboxDevDemoNextEventSeq = 1;
}
