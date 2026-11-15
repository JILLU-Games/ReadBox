import { env } from "@/config/env";
import { getAuthorizedWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  getSanitizedMessageHtmlForUser,
  SAFE_HTML_CSP_POLICY,
} from "@/core/messages/service";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ messageUuid: string }> },
) {
  const user = await getAuthorizedWorkspaceUser();
  if (!user || !env.databaseUrl) {
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const { messageUuid } = await context.params;
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  try {
    const htmlDocument = await getSanitizedMessageHtmlForUser(
      getPrismaClient(),
      {
        userId,
        username: user.username,
        isAdministrator: user.isAdministrator,
        headers: request.headers,
        trustProxyHeaders: env.trustProxyHeaders,
      },
      messageUuid,
    );

    if (!htmlDocument) {
      return new NextResponse("Not found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new NextResponse(htmlDocument, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": SAFE_HTML_CSP_POLICY,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}
