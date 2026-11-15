import { env } from "@/config/env";
import { getAuthorizedWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  buildAttachmentContentDisposition,
  getAttachmentForUserDownload,
} from "@/core/messages/service";
import { readFile } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";

function uniformNotFound(): NextResponse {
  return new NextResponse("Attachment not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attachmentUuid: string }> },
) {
  const user = await getAuthorizedWorkspaceUser();
  if (!user || !env.databaseUrl) {
    return uniformNotFound();
  }

  const { attachmentUuid } = await context.params;
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  try {
    const download = await getAttachmentForUserDownload(
      getPrismaClient(),
      {
        userId,
        username: user.username,
        isAdministrator: user.isAdministrator,
        headers: request.headers,
        trustProxyHeaders: env.trustProxyHeaders,
      },
      attachmentUuid,
      env.attachmentStorageRoot,
    );

    if (!download) {
      return uniformNotFound();
    }

    const commonHeaders: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": buildAttachmentContentDisposition(
        download.safeFilename,
      ),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    };

    if (process.env.USE_X_ACCEL_REDIRECT === "true") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          ...commonHeaders,
          "X-Accel-Redirect": `/_protected_attachments/${download.storageRelativePath}`,
        },
      });
    }

    const buffer = await readFile(download.absoluteFilePath);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch {
    return uniformNotFound();
  }
}
