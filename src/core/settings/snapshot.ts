export interface SiteSettingsSnapshot {
  readonly id: bigint;
  readonly siteName: string;
  readonly siteTagline: string;
  readonly logoPath: string;
  readonly faviconPath: string;
  readonly supportEmail: string;
  readonly contactPhone: string;
  readonly officeAddress: string;
  readonly footerDescription: string;
  readonly copyrightText: string;
  readonly sourceCodeUrl: string;
  readonly privacyUrl: string;
  readonly updatedAt: Date;
}

export const DEFAULT_SITE_SETTINGS: SiteSettingsSnapshot = Object.freeze({
  id: BigInt(1),
  siteName: "MailStack",
  siteTagline: "Self-hosted mail server and shared team inbox.",
  logoPath: "",
  faviconPath: "",
  supportEmail: "",
  contactPhone: "",
  officeAddress: "",
  footerDescription: "",
  copyrightText: "Authorized team use only.",
  sourceCodeUrl: "https://github.com/vibtools/MailStack",
  privacyUrl: "/privacy/",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

let cachedSiteSettings: SiteSettingsSnapshot = {
  ...DEFAULT_SITE_SETTINGS,
};

export function resetDevFallbackSiteSettings(): void {
  cachedSiteSettings = { ...DEFAULT_SITE_SETTINGS };
}

export function getCachedSiteSettingsSnapshot(): SiteSettingsSnapshot {
  return cachedSiteSettings;
}

export function setCachedSiteSettingsSnapshot(
  snapshot: SiteSettingsSnapshot,
): void {
  cachedSiteSettings = snapshot;
}
