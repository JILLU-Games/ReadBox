"use server";

import { signOut } from "@/auth";
import { env } from "@/config/env";
import { recordAppAudit } from "@/core/audit/record";
import { getAuthSecret } from "@/core/auth/auth-secret";
import { revokeDevDemoSession } from "@/core/auth/dev-demo-auth";
import { isHttpsProxyRequest } from "@/core/auth/proxy-request";
import { getAuthCookiePolicy } from "@/core/auth/runtime-policy";
import { revokeAppSession } from "@/core/auth/session-registry";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";
import { decode } from "next-auth/jwt";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signOutAction(): Promise<void> {
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const requestHeaders = await headers();
  const isHttpsRequest = isHttpsProxyRequest(
    requestHeaders,
    undefined,
    env.nodeEnv,
  );
  const cookiePolicy = getAuthCookiePolicy({
    nodeEnv: env.nodeEnv,
    isHttpsRequest,
  });
  const cookieName = cookiePolicy.sessionCookieName;
  const cookieStore = await cookies();
  const chunks = cookieStore
    .getAll()
    .filter(
      (cookie) =>
        cookie.name === cookieName || cookie.name.startsWith(`${cookieName}.`),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const encodedToken = chunks.map((cookie) => cookie.value).join("");
  const secret = devDemoActive ? getAuthSecret() : env.authSecret;

  if (encodedToken && secret) {
    const token = await decode({
      token: encodedToken,
      secret,
      salt: cookieName,
    }).catch(() => null);
    if (typeof token?.sid === "string") {
      try {
        if (devDemoActive) {
          revokeDevDemoSession(token.sid);
        } else {
          await revokeAppSession(getPrismaClient(), token.sid);
          await recordAppAudit({
            actorId: typeof token.sub === "string" ? token.sub : null,
            action: "logout",
            targetType: "user",
            targetIdentifier:
              typeof token.username === "string"
                ? token.username
                : String(token.sub ?? ""),
            headers: requestHeaders,
            details: { revokedSession: true },
          });
        }
      } catch {
        logger.error("auth_logout_revocation_failed");
        throw new Error("Secure sign-out is temporarily unavailable");
      }
    }
  }

  await signOut({ redirect: false });

  if (cookiePolicy.partitioned) {
    for (const chunk of chunks) {
      cookieStore.set(chunk.name, "", {
        httpOnly: true,
        sameSite: cookiePolicy.sameSite,
        path: "/",
        secure: cookiePolicy.secure,
        partitioned: true,
        maxAge: 0,
      });
    }
  }

  redirect("/sign-in");
}
