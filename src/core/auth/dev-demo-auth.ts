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
  readonly isAdministrator: boolean;
  readonly isSuperuser: boolean;
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
    isAdministrator: true,
    isSuperuser: true,
  },
  {
    id: "9002",
    numericId: BigInt(9002),
    username: "demo.user",
    password: "demo-user-local-dev",
    firstName: "Demo",
    lastName: "User",
    email: "user@readbox.local",
    isAdministrator: false,
    isSuperuser: false,
  },
]);

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(1024),
});

const globalForDevDemoSessions = globalThis as typeof globalThis & {
  mailstackDevDemoSessions?: Map<string, string>;
};

function getSessionStore(): Map<string, string> {
  globalForDevDemoSessions.mailstackDevDemoSessions ??= new Map();
  return globalForDevDemoSessions.mailstackDevDemoSessions;
}

function toCurrentUserIdentity(account: DevDemoAccount) {
  return {
    id: account.numericId,
    username: account.username,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    isActive: true,
    passwordResetRequired: false,
    isAdministrator: account.isAdministrator,
    isSuperuser: account.isSuperuser,
  };
}

export function getDevBypassUser(role: "user" | "admin") {
  const account =
    DEV_DEMO_ACCOUNTS.find((candidate) =>
      role === "admin" ? candidate.isAdministrator : !candidate.isAdministrator,
    ) ?? DEV_DEMO_ACCOUNTS[0];

  return toCurrentUserIdentity(account);
}

export function authorizeDevDemoCredentials(
  nodeEnv: "development" | "test" | "production",
  credentials: Partial<Record<"username" | "password", unknown>>,
) {
  if (nodeEnv !== "development") return null;

  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const username = parsed.data.username.toLowerCase();
  const account = DEV_DEMO_ACCOUNTS.find(
    (candidate) => candidate.username === username,
  );
  if (!account || account.password !== parsed.data.password) {
    return null;
  }

  return {
    id: account.id,
    username: account.username,
    name: `${account.firstName} ${account.lastName}`,
    email: account.email,
    isAdministrator: account.isAdministrator,
    isSuperuser: account.isSuperuser,
  };
}

export function registerDevDemoSession(
  nodeEnv: "development" | "test" | "production",
  userId: string,
  sessionId: string,
): boolean {
  if (nodeEnv !== "development" || !isOpaqueToken(sessionId)) return false;
  const account = DEV_DEMO_ACCOUNTS.find(
    (candidate) => candidate.id === userId,
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

  const account = DEV_DEMO_ACCOUNTS.find(
    (candidate) => candidate.id === userId,
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
  const account = DEV_DEMO_ACCOUNTS.find(
    (candidate) => candidate.id === userId,
  );
  return account ? toCurrentUserIdentity(account) : null;
}

export function clearDevDemoSessions(): void {
  getSessionStore().clear();
}
