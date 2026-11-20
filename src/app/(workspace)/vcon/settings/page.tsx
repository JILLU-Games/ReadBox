import {
  saveSiteSettingsAction,
  type SerializedSiteSettings,
} from "@/app/(workspace)/vcon/settings/actions";
import { SettingsConsole } from "@/components/vcon/settings-console";
import { SeoSettingsConsole } from "@/components/vcon/seo-settings-console";
import { saveSeoPageSettingsAction } from "@/app/(workspace)/vcon/settings/seo-actions";
import { getSeoSettingsSnapshot } from "@/core/seo/service";
import { legacySeoPreview } from "@/core/seo/metadata";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getSiteSettings } from "@/core/settings/service";

export const dynamic = "force-dynamic";

export default async function AdminSiteSettingsPage() {
  await requireAdminUser();

  const view = await getSiteSettings();
  const seoSettings = await getSeoSettingsSnapshot();
  const fallbacks = {
    home: legacySeoPreview("home", view),
    contact: legacySeoPreview("contact", view),
    privacy: legacySeoPreview("privacy", view),
  };
  const initialSettings: SerializedSiteSettings = {
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

  return (
    <>
      <SettingsConsole
        initialSettings={initialSettings}
        publicSiteOrigin={env.publicSiteOrigin ?? ""}
        mediaRoot={env.mediaRoot}
        onSaveSettings={saveSiteSettingsAction}
      />
      <SeoSettingsConsole
        initial={seoSettings}
        fallbacks={fallbacks}
        publicOrigin={env.publicSiteOrigin ?? ""}
        onSave={saveSeoPageSettingsAction}
      />
    </>
  );
}
