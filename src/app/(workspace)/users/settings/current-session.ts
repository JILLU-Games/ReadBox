import { getAuthSecret } from "@/core/auth/auth-secret";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import "server-only";

const SESSION_COOKIE_CANDIDATES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
] as const;

export async function getCurrentServerSessionId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const secret = getAuthSecret();

    for (const cookieName of SESSION_COOKIE_CANDIDATES) {
      const rawToken = cookieStore.get(cookieName)?.value;
      if (!rawToken) continue;

      const decoded = await decode({
        token: rawToken,
        secret,
        salt: cookieName,
      });

      if (decoded && typeof decoded.sid === "string" && decoded.sid.length > 0) {
        return decoded.sid;
      }
    }
  } catch {
    return null;
  }

  return null;
}
