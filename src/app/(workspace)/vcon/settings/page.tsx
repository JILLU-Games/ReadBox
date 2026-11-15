import {
  saveSiteSettingsAction,
  type SerializedSiteSettings,
} from "@/app/(workspace)/vcon/settings/actions";
import { SettingsConsole } from "@/components/vcon/settings-console";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getSiteSettings } from "@/core/settings/service";

export const dynamic = "force-dynamic";

export default async function AdminSiteSettingsPage() {
  await requireAdminUser();

  const view = await getSiteSettings();
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
    <SettingsConsole
      initialSettings={initialSettings}
      publicSiteOrigin={env.publicSiteOrigin ?? ""}
      mediaRoot={env.mediaRoot}
      onSaveSettings={saveSiteSettingsAction}
    />
  );
}
