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
  siteName: "ReadBox",
  siteTagline: "Self-hosted mail server and shared team inbox.",
  logoPath: "",
  faviconPath: "",
  supportEmail: "",
  contactPhone: "",
  officeAddress: "",
  footerDescription: "",
  copyrightText: "Authorized team use only.",
  sourceCodeUrl: "https://github.com/vibtools/ReadBox",
  privacyUrl: "/privacy/",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const globalForSiteSettings = globalThis as typeof globalThis & {
  __readboxSiteSettingsSnapshot?: SiteSettingsSnapshot;
};

export function resetDevFallbackSiteSettings(): void {
  globalForSiteSettings.__readboxSiteSettingsSnapshot = {
    ...DEFAULT_SITE_SETTINGS,
  };
}

export function getCachedSiteSettingsSnapshot(): SiteSettingsSnapshot {
  if (!globalForSiteSettings.__readboxSiteSettingsSnapshot) {
    globalForSiteSettings.__readboxSiteSettingsSnapshot = {
      ...DEFAULT_SITE_SETTINGS,
    };
  }
  return globalForSiteSettings.__readboxSiteSettingsSnapshot;
}

export function setCachedSiteSettingsSnapshot(
  snapshot: SiteSettingsSnapshot,
): void {
  globalForSiteSettings.__readboxSiteSettingsSnapshot = snapshot;
}
