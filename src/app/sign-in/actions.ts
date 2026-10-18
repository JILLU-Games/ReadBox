"use server";

import { signOut } from "@/auth";
import { env } from "@/config/env";
import { revokeAppSession } from "@/core/auth/session-registry";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function signOutAction(): Promise<void> {
  const cookieName =
    env.nodeEnv === "production"
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";
  const cookieStore = await cookies();
  const chunks = cookieStore
    .getAll()
    .filter(
      (cookie) =>
        cookie.name === cookieName || cookie.name.startsWith(`${cookieName}.`),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const encodedToken = chunks.map((cookie) => cookie.value).join("");

  if (encodedToken && env.authSecret) {
    const token = await decode({
      token: encodedToken,
      secret: env.authSecret,
      salt: cookieName,
    }).catch(() => null);
    if (typeof token?.sid === "string") {
      try {
        await revokeAppSession(getPrismaClient(), token.sid);
      } catch {
        logger.error("auth_logout_revocation_failed");
        throw new Error("Secure sign-out is temporarily unavailable");
      }
    }
  }

  await signOut({ redirectTo: "/sign-in" });
}
