import { env } from "@/config/env";
import { authorizeCredentials } from "@/core/auth/credentials";
import { SESSION_MAX_AGE_SECONDS } from "@/core/auth/password-policy";
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

if (
  env.authEnabled &&
  env.nodeEnv !== "development" &&
  env.nodeEnv !== "test"
) {
  throw new Error(
    "This authentication foundation is restricted to local development",
  );
}

if (env.authEnabled && !env.authSecret) {
  throw new Error("AUTH_SECRET is required when authentication is enabled");
}

const authSecret = env.authSecret ?? randomBytes(32).toString("base64url");

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: env.nodeEnv !== "production",
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
      name:
        env.nodeEnv === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.nodeEnv === "production",
      },
    },
  },
  providers: env.authEnabled
    ? [
        Credentials({
          credentials: {
            username: { label: "Username", type: "text" },
            password: { label: "Password", type: "password" },
          },
          authorize: (credentials) =>
            authorizeCredentials(getPrismaClient(), credentials),
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token, user }) {
      if (user && !token.sid && typeof user.id === "string") {
        const sessionId = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
        let registered = false;
        try {
          registered = await registerAppSession(
            getPrismaClient(),
            user.id,
            sessionId,
            expiresAt,
          );
        } catch {
          appLogger.error("auth_session_registration_failed");
        }
        if (!registered) return null;

        token.sid = sessionId;
        token.sub = user.id;
      }

      const sessionId = typeof token.sid === "string" ? token.sid : null;
      const userId = typeof token.sub === "string" ? token.sub : null;
      if (!sessionId || !userId) return null;

      let currentUser;
      try {
        currentUser = await getActiveAppSession(
          getPrismaClient(),
          userId,
          sessionId,
        );
      } catch {
        appLogger.error("auth_session_validation_failed");
        return null;
      }
      if (!currentUser) return null;

      token.sub = currentUser.id.toString();
      token.username = currentUser.username;
      token.isStaff = currentUser.isStaff;
      token.isSuperuser = currentUser.isSuperuser;
      return token;
    },
    async session({ session, token }) {
      if (typeof token.sub !== "string" || typeof token.username !== "string") {
        return session;
      }

      session.user.id = token.sub;
      session.user.username = token.username;
      session.user.name = typeof token.name === "string" ? token.name : null;
      session.user.isStaff = token.isStaff === true;
      session.user.isSuperuser = token.isSuperuser === true;
      if (typeof token.email === "string") session.user.email = token.email;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sid === "string") {
        try {
          await revokeAppSession(getPrismaClient(), message.token.sid);
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
});
