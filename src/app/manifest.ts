import {
  getCachedSiteSettingsSnapshot,
  getSiteSettings,
} from "@/core/settings/service";
import type { MetadataRoute } from "next";

function inferManifestIconType(iconUrl: string): string {
  const lower = iconUrl.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "image/png";
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let siteName = "ReadBox";
  let description = "Private team mailbox workspace";
  let customFaviconUrl = "";

  try {
    const settings = await getSiteSettings();
    siteName = settings.siteName || siteName;
    description = settings.siteTagline || description;
    customFaviconUrl = settings.faviconUrl || "";
  } catch {
    const cached = getCachedSiteSettingsSnapshot();
    siteName = cached.siteName || siteName;
    description = cached.siteTagline || description;
  }

  const icons: NonNullable<MetadataRoute.Manifest["icons"]> = [
    {
      src: "/icons/readbox-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/readbox-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/readbox.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    },
  ];

  if (customFaviconUrl) {
    icons.unshift({
      src: customFaviconUrl,
      sizes: "any",
      type: inferManifestIconType(customFaviconUrl),
      purpose: "any",
    });
  }

  return {
    name: siteName,
    short_name: siteName.slice(0, 32),
    description,
    start_url: "/users",
    display: "standalone",
    background_color: "#f6f8fa",
    theme_color: "#2558bf",
    icons,
  };
}
