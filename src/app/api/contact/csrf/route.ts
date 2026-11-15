import { issueContactCsrfToken } from "@/core/contact/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const issued = issueContactCsrfToken();

  return NextResponse.json(
    {
      token: issued.token,
      expires_in: issued.expiresIn,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": issued.cookieHeader,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
