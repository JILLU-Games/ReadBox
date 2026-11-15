"use server";

import { requireAdminUser } from "@/core/auth/route-guards";
import {
  updateSiteSettings,
  type SiteAssetUploadInput,
  type SiteSettingsView,
} from "@/core/settings/service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export interface SerializedSiteSettings {
  readonly siteName: string;
  readonly siteTagline: string;
  readonly logoPath: string;
  readonly faviconPath: string;
  readonly logoUrl: string;
  readonly faviconUrl: string;
  readonly supportEmail: string;
  readonly contactPhone: string;
  readonly officeAddress: string;
  readonly footerDescription: string;
  readonly copyrightText: string;
  readonly sourceCodeUrl: string;
  readonly privacyUrl: string;
  readonly updatedAtIso: string;
  readonly databaseConnected: boolean;
}

export interface SaveSiteSettingsActionResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly settings?: SerializedSiteSettings;
}

function serializeSettings(view: SiteSettingsView): SerializedSiteSettings {
  return {
    siteName: view.siteName,
    siteTagline: view.siteTagline,
    logoPath: view.logoPath,
    faviconPath: view.faviconPath,
    logoUrl: view.logoUrl,
    faviconUrl: view.faviconUrl,
    supportEmail: view.supportEmail,
    contactPhone: view.contactPhone,
    officeAddress: view.officeAddress,
    footerDescription: view.footerDescription,
    copyrightText: view.copyrightText,
    sourceCodeUrl: view.sourceCodeUrl,
    privacyUrl: view.privacyUrl,
    updatedAtIso: view.updatedAt.toISOString(),
    databaseConnected: view.databaseConnected,
  };
}

async function extractFileFromFormData(
  formData: FormData,
  fieldName: string,
): Promise<SiteAssetUploadInput | null> {
  const entry = formData.get(fieldName);
  if (!entry || typeof entry === "string" || !(entry instanceof File)) {
    return null;
  }
  if (entry.size === 0 && !entry.name) {
    return null;
  }
  const arrayBuffer = await entry.arrayBuffer();
  return {
    filename: entry.name,
    contentType: entry.type || "application/octet-stream",
    sizeBytes: entry.size,
    buffer: Buffer.from(arrayBuffer),
  };
}

export async function saveSiteSettingsAction(
  formData: FormData,
): Promise<SaveSiteSettingsActionResult> {
  const admin = await requireAdminUser();
  const reqHeaders = await headers();

  const logoUpload = await extractFileFromFormData(formData, "logo");
  const faviconUpload = await extractFileFromFormData(formData, "favicon");

  const result = await updateSiteSettings(
    {
      siteName: String(formData.get("site_name") ?? ""),
      siteTagline: String(formData.get("site_tagline") ?? ""),
      supportEmail: String(formData.get("support_email") ?? ""),
      contactPhone: String(formData.get("contact_phone") ?? ""),
      officeAddress: String(formData.get("office_address") ?? ""),
      footerDescription: String(formData.get("footer_description") ?? ""),
      copyrightText: String(formData.get("copyright_text") ?? ""),
      sourceCodeUrl: String(formData.get("source_code_url") ?? ""),
      privacyUrl: String(formData.get("privacy_url") ?? ""),
      clearLogo: formData.get("clear_logo") === "true",
      clearFavicon: formData.get("clear_favicon") === "true",
      logoUpload,
      faviconUpload,
    },
    {
      actorId: admin.id ? BigInt(admin.id) : null,
      headers: reqHeaders,
    },
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/vcon/settings");
  revalidatePath("/vcon");
  revalidatePath("/users");

  return {
    ok: true,
    message: result.message,
    settings: serializeSettings(result.settings),
  };
}
