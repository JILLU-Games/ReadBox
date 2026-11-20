"use server";

import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { updateSeoPageSettings } from "@/core/seo/service";
import type { SeoSaveResult } from "@/core/seo/types";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export function isTrustedSeoActionOrigin(
  requestHeaders: Pick<Headers, "get">,
  expectedPublicOrigin?: string | null,
): boolean {
  try {
    const origin = requestHeaders.get("origin");
    const host = requestHeaders.get("host");
    if (!origin || !host) return false;
    const actual = new URL(origin);
    if (!["https:", "http:"].includes(actual.protocol) || actual.username || actual.password) {
      return false;
    }
    const expected = expectedPublicOrigin
      ? new URL(expectedPublicOrigin).origin
      : `${actual.protocol}//${host}`;
    return actual.origin === expected && new URL(`${actual.protocol}//${host}`).host === actual.host;
  } catch {
    return false;
  }
}

export async function saveSeoPageSettingsAction(formData: FormData): Promise<SeoSaveResult> {
  const admin = await requireAdminUser();
  const requestHeaders = await headers();
  if (!isTrustedSeoActionOrigin(requestHeaders, env.publicSiteOrigin)) {
    return { ok: false, error: "Cross-origin SEO changes are refused." };
  }

  const result = await updateSeoPageSettings({
    pageKey: String(formData.get("pageKey") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    imagePath: String(formData.get("imagePath") ?? ""),
  }, {
    actorId: admin.id ? BigInt(admin.id) : null,
    actorUsername: admin.username,
    authSource: admin.authSource,
    headers: requestHeaders,
  });

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/contact");
    revalidatePath("/privacy");
    revalidatePath("/vcon/settings");
  }
  return result;
}
