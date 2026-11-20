import type { Metadata } from "next";
import { getSeoPageSettings } from "./service";
import type { SeoPageKey, SeoPageValues } from "./types";

export function applySeoOverrides(
  base: Metadata,
  saved: SeoPageValues,
  publicOrigin: string,
): Metadata {
  if (!saved.title && !saved.description && !saved.imagePath) return base;
  const titlePart = saved.title ? { title: { absolute: saved.title } } : {};
  const descriptionPart = saved.description ? { description: saved.description } : {};
  const titleForSocial = saved.title ? { title: saved.title } : {};
  const descriptionForSocial = saved.description ? { description: saved.description } : {};
  const image = saved.imagePath
    ? { images: [{ url: new URL(saved.imagePath, publicOrigin).toString() }] }
    : {};
  return {
    ...base,
    ...titlePart,
    ...descriptionPart,
    openGraph: {
      ...base.openGraph,
      ...titleForSocial,
      ...descriptionForSocial,
      ...image,
    },
    ...(base.twitter ? {
      twitter: {
        ...base.twitter,
        ...titleForSocial,
        ...descriptionForSocial,
        ...image,
      },
    } : {}),
  };
}

export async function getPageSeoMetadata(
  pageKey: SeoPageKey,
  base: Metadata,
  publicOrigin: string,
): Promise<Metadata> {
  const saved = await getSeoPageSettings(pageKey);
  return applySeoOverrides(base, saved, publicOrigin);
}

export function legacySeoPreview(
  pageKey: SeoPageKey,
  settings: { siteName: string; siteTagline: string; footerDescription: string },
): { title: string; description: string } {
  const siteName = settings.siteName || "ReadBox";
  switch (pageKey) {
    case "home": {
      const tagline = settings.siteTagline ||
        "Self-Service Custom-Domain Mailboxes & Private Team Workspaces";
      return {
        title: `${siteName} — ${tagline}`,
        description: settings.footerDescription ||
          `${siteName} provides self-service user sign-up, custom-domain mailboxes, shared team inboxes, and automated message retention.`,
      };
    }
    case "contact":
      return {
        title: `Contact & Support — ${siteName}`,
        description: `Contact the ${siteName} team for custom domain onboarding, team workspace setup, or support.`,
      };
    case "privacy":
      return {
        title: `Privacy Policy — ${siteName}`,
        description: `Learn how ${siteName} handles workspace accounts, mailboxes, automated message retention, and support inquiries.`,
      };
  }
}
