import { env } from "@/config/env";
import { getAuthorizedWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  isDemoPreviewWorkspaceActive,
  pollDemoLivePayload,
} from "@/core/messages/demo-workspace";
import {
  isLiveBackgroundRequest,
  pollLiveMessagesForUser,
  type LiveUpdatePayload,
} from "@/core/messages/service";
import { logger } from "@/core/server/logger";
import { NextResponse, type NextRequest } from "next/server";

const EMPTY_LIVE_PAYLOAD: LiveUpdatePayload = {
  cursor: 0,
  has_more: false,
  summary: {
    total_mailboxes: 0,
    active_mailboxes: 0,
    disabled_mailboxes: 0,
    total_messages: 0,
    total_unread: 0,
    last_received: null,
  },
  mailboxes_truncated: false,
  mailboxes: [],
  messages: [],
};

export async function GET(request: NextRequest) {
  if (!isLiveBackgroundRequest(request.headers)) {
    return NextResponse.json(
      { error: "X-ReadBox-Live-Request: 1 header is required." },
      {
        status: 400,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const user = await getAuthorizedWorkspaceUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const bootstrap = searchParams.get("bootstrap") === "1";
  const rawCursor =
    searchParams.get("cursor") ?? searchParams.get("after_id") ?? "0";
  const rawMailboxes =
    searchParams.get("mailboxes") ?? searchParams.get("mailbox") ?? "";
  const mailboxUuids = rawMailboxes
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!env.databaseUrl) {
    const payload = isDemoPreviewWorkspaceActive()
      ? pollDemoLivePayload(mailboxUuids, {
          isAdministrator: user.isAdministrator,
          userId: user.id,
          cursor: Number(rawCursor) || 0,
          bootstrap,
        })
      : EMPTY_LIVE_PAYLOAD;
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  }

  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  try {
    const payload = await pollLiveMessagesForUser(
      getPrismaClient(),
      {
        userId,
        isAdministrator: user.isAdministrator,
      },
      {
        bootstrap,
        cursor: Number(rawCursor) || 0,
        mailboxUuids,
      },
    );

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logger.error("live_messages_poll_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Live mailbox updates temporarily unavailable." },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
}
