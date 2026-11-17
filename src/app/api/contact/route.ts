import { env } from "@/config/env";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  MAX_BODY_BYTES,
  consumeContactCsrfTokenDurable,
  recordContactSubmission,
  validateContactPayload,
} from "@/core/contact/service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function extractRequestIp(request: NextRequest): string {
  if (env.trustProxyHeaders) {
    const xRealIp = request.headers.get("x-real-ip")?.trim();
    if (xRealIp) return xRealIp;
    const xForwardedFor = request.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const first = xForwardedFor.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return "127.0.0.1";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? "";
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME) ?? "";

  if (!(await consumeContactCsrfTokenDurable(sessionCookie, csrfHeader))) {
    return NextResponse.json(
      {
        message:
          "The form security token expired. Reload the page and try again.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  const contentType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return NextResponse.json(
      { message: "The submitted request was invalid." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { message: "The submitted request was invalid." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  if (
    !rawBody ||
    Buffer.byteLength(rawBody, "utf8") <= 0 ||
    Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES
  ) {
    return NextResponse.json(
      { message: "The submitted request was invalid." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { message: "The submitted request was invalid." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json(
      { message: "The submitted request was invalid." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  const { cleaned, errors } = validateContactPayload(
    parsedBody as Record<string, unknown>,
  );

  if (Object.keys(errors).length > 0) {
    const publicErrors: Record<string, string> = {};
    for (const [key, value] of Object.entries(errors)) {
      if (!key.startsWith("_")) {
        publicErrors[key] = value;
      }
    }

    return NextResponse.json(
      {
        message:
          "_spam" in errors
            ? "The submission was rejected."
            : "Please correct the highlighted fields.",
        errors: publicErrors,
      },
      {
        status: 422,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  const recorded = await recordContactSubmission({
    requestIp: extractRequestIp(request),
    cleaned,
    headers: request.headers,
  });

  if (!recorded.ok) {
    return NextResponse.json(
      { message: recorded.message },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(recorded.retryAfterSeconds),
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  return NextResponse.json(
    {
      message: "Inquiry submitted successfully.",
      request_id: recorded.requestId,
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
