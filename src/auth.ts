import { env } from "@/config/env";
import { getAuthSecret } from "@/core/auth/auth-secret";
import { authorizeCredentials } from "@/core/auth/credentials";
import {
  authorizeDevDemoCredentials,
  getActiveDevDemoSession,
  registerDevDemoSession,
  revokeDevDemoSession,
} from "@/core/auth/dev-demo-auth";
import { SESSION_MAX_AGE_SECONDS } from "@/core/auth/password-policy";
import {
  extractClientIp,
  isHttpsProxyRequest,
} from "@/core/auth/proxy-request";
import {
  getAuthCookiePolicy,
  getAuthRuntimeConfigurationError,
} from "@/core/auth/runtime-policy";
import {
  getActiveAppSession,
  registerAppSession,
  revokeAppSession,
} from "@/core/auth/session-registry";
import { getPrismaClient } from "@/core/database/client";
import { logger as appLogger } from "@/core/server/logger";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { randomBytes } from "node:crypto";
import "server-only";

const authRuntimeConfigurationError = getAuthRuntimeConfigurationError({
  nodeEnv: env.nodeEnv,
  authEnabled: env.authEnabled,
  hasAuthSecret: Boolean(env.authSecret),
  hasDatabaseUrl: Boolean(env.databaseUrl),
  devAuthMode: env.devAuthMode,
});
if (authRuntimeConfigurationError)
  throw new Error(authRuntimeConfigurationError);

const devDemoActive =
  env.nodeEnv === "development" && env.devAuthMode === "demo";
const credentialsActive = env.authEnabled || devDemoActive;
const authSecret = getAuthSecret();

export const { handlers, auth, signIn, signOut } = NextAuth((req) => {
  const isHttpsRequest = isHttpsProxyRequest(
    req?.headers,
    req?.url,
    env.nodeEnv,
  );
  const cookiePolicy = getAuthCookiePolicy({
    nodeEnv: env.nodeEnv,
    isHttpsRequest,
  });

  return {
    secret: authSecret,
    trustHost: env.nodeEnv !== "production" || env.authTrustHost,
    debug: false,
    session: {
      strategy: "jwt",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
    jwt: {
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
    cookies: {
      sessionToken: {
        name: cookiePolicy.sessionCookieName,
        options: {
          httpOnly: true,
          sameSite: cookiePolicy.sameSite,
          path: "/",
          secure: cookiePolicy.secure,
          partitioned: cookiePolicy.partitioned,
        },
      },
      callbackUrl: {
        name: cookiePolicy.callbackCookieName,
        options: {
          httpOnly: true,
          sameSite: cookiePolicy.sameSite,
          path: "/",
          secure: cookiePolicy.secure,
          partitioned: cookiePolicy.partitioned,
        },
      },
      csrfToken: {
        name: cookiePolicy.csrfCookieName,
        options: {
          httpOnly: true,
          sameSite: cookiePolicy.sameSite,
          path: "/",
          secure: cookiePolicy.secure,
          partitioned: cookiePolicy.partitioned,
        },
      },
    },
    providers: credentialsActive
      ? [
          Credentials({
            credentials: {
              username: { label: "Username", type: "text" },
              password: { label: "Password", type: "password" },
              loginScope: { label: "Scope", type: "text" },
            },
            authorize: (credentials, request) =>
              devDemoActive
                ? authorizeDevDemoCredentials(env.nodeEnv, credentials)
                : authorizeCredentials(getPrismaClient(), credentials, {
                    clientIp: extractClientIp(
                      request?.headers ?? req?.headers,
                      { trustProxyHeaders: env.trustProxyHeaders },
                    ),
                    userAgent:
                      (request?.headers ?? req?.headers)?.get("user-agent") ??
                      "",
                    failureLimit: env.loginFailureLimit,
                    failureWindowMs: env.loginFailureWindowSeconds * 1000,
                    lockoutMs: env.loginLockoutSeconds * 1000,
                  }),
          }),
        ]
      : [],
  callbacks: {
    async jwt({ token, user }) {
      if (user && !token.sid && typeof user.id === "string") {
        const sessionId = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
        const authSource =
          user.authSource === "admin_table" ? "admin_table" : "user_table";
        let registered = false;
        try {
          registered = devDemoActive
            ? registerDevDemoSession(env.nodeEnv, user.id, sessionId)
            : await registerAppSession(
                getPrismaClient(),
                user.id,
                sessionId,
                expiresAt,
                { authSource },
              );
        } catch {
          appLogger.error("auth_session_registration_failed");
        }
        if (!registered) return null;

        token.sid = sessionId;
        token.sub = user.id;
        token.authSource = authSource;
      }

      const sessionId = typeof token.sid === "string" ? token.sid : null;
      const userId = typeof token.sub === "string" ? token.sub : null;
      if (!sessionId || !userId) return null;

      const authSource =
        token.authSource === "admin_table" ? "admin_table" : "user_table";

      let currentUser;
      try {
        currentUser = devDemoActive
          ? getActiveDevDemoSession(env.nodeEnv, userId, sessionId)
          : await getActiveAppSession(getPrismaClient(), userId, sessionId, {
              authSource,
            });
      } catch {
        appLogger.error("auth_session_validation_failed");
        return null;
      }
      if (!currentUser) return null;

      token.sub = currentUser.id.toString();
      token.username = currentUser.username;
      token.isAdministrator = currentUser.isAdministrator;
      token.isSuperuser = currentUser.isSuperuser;
      token.authSource =
        "authSource" in currentUser && currentUser.authSource === "admin_table"
          ? "admin_table"
          : "user_table";
      return token;
    },
    async session({ session, token }) {
      if (typeof token.sub !== "string" || typeof token.username !== "string") {
        return session;
      }

      session.user.id = token.sub;
      session.user.username = token.username;
      session.user.name = typeof token.name === "string" ? token.name : null;
      session.user.isAdministrator = token.isAdministrator === true;
      session.user.isSuperuser = token.isSuperuser === true;
      session.user.authSource =
        token.authSource === "admin_table" ? "admin_table" : "user_table";
      if (typeof token.email === "string") session.user.email = token.email;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sid === "string") {
        try {
          if (devDemoActive) {
            revokeDevDemoSession(message.token.sid);
          } else {
            await revokeAppSession(getPrismaClient(), message.token.sid);
          }
        } catch {
          appLogger.error("auth_session_revocation_failed");
        }
      }
    },
  },
    logger: {
      error() {
        appLogger.error("auth_error");
      },
      warn() {
        appLogger.warn("auth_warning");
      },
      debug() {},
    },
  };
});
