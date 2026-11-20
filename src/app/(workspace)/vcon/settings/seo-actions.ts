"use server";

import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { updateSeoPageSettings } from "@/core/seo/service";
import type { SeoSaveResult } from "@/core/seo/types";
import { isTrustedSeoActionOrigin } from "@/core/seo/validation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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
