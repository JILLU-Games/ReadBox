import { isOpaqueToken } from "@/core/auth/opaque-token";
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

const globalForDevDemoSessions = globalThis as typeof globalThis & {
  mailstackDevDemoSessions?: Map<string, string>;
  mailstackDevDemoDynamicUsers?: Map<string, DevDemoAccount>;
  mailstackDevDemoNextId?: bigint;
};

function getSessionStore(): Map<string, string> {
  globalForDevDemoSessions.mailstackDevDemoSessions ??= new Map();
  return globalForDevDemoSessions.mailstackDevDemoSessions;
}

function getDynamicUserStore(): Map<string, DevDemoAccount> {
  globalForDevDemoSessions.mailstackDevDemoDynamicUsers ??= new Map();
  return globalForDevDemoSessions.mailstackDevDemoDynamicUsers;
}

function getAllDevDemoAccounts(): DevDemoAccount[] {
  return [
    ...DEV_DEMO_ACCOUNTS,
    ...Array.from(getDynamicUserStore().values()),
  ];
}

function toCurrentUserIdentity(account: DevDemoAccount) {
  return {
    id: account.numericId,
    username: account.username,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
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
  if (!account || account.password !== parsed.data.password) {
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

export function clearDevDemoSessions(): void {
  getSessionStore().clear();
  getDynamicUserStore().clear();
  globalForDevDemoSessions.mailstackDevDemoNextId = BigInt(9100);
}
