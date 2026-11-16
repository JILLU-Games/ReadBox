import { env } from "@/config/env";
import { getAuthorizedWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  getDemoMessageHtml,
  isDemoPreviewWorkspaceActive,
} from "@/core/messages/demo-workspace";
import {
  getSanitizedMessageHtmlForUser,
  SAFE_HTML_CSP_POLICY,
} from "@/core/messages/service";
import { logger } from "@/core/server/logger";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ messageUuid: string }> },
) {
  const user = await getAuthorizedWorkspaceUser();
  const demoActive = isDemoPreviewWorkspaceActive();
  if (!user || (!env.databaseUrl && !demoActive)) {
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

  const rawTheme = request.nextUrl.searchParams.get("theme");
  const theme =
    rawTheme === "dark" ? "dark" : rawTheme === "light" ? "light" : undefined;

  try {
    const htmlDocument = env.databaseUrl
      ? await getSanitizedMessageHtmlForUser(
          getPrismaClient(),
          {
            userId,
            username: user.username,
            isAdministrator: user.isAdministrator,
            headers: request.headers,
            trustProxyHeaders: env.trustProxyHeaders,
          },
          messageUuid,
          theme ? { theme } : undefined,
        )
      : getDemoMessageHtml(messageUuid, theme ? { theme } : undefined, {
          isAdministrator: user.isAdministrator,
          userId: user.id,
        });

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
  } catch (error) {
    logger.error("message_html_fetch_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
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
