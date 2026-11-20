import { env } from "@/config/env";
import type { MetadataRoute } from "next";

function resolvePublicBaseUrl(): string {
  if (env.publicSiteOrigin) {
    return env.publicSiteOrigin.replace(/\/+$/, "");
  }
  return `https://${env.mailDomain}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = resolvePublicBaseUrl();

  return [
    {
      url: `${baseUrl}/`,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
