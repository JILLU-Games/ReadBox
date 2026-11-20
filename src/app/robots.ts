import { env } from "@/config/env";
import type { MetadataRoute } from "next";

function resolvePublicBaseUrl(): string {
  if (env.publicSiteOrigin) {
    return env.publicSiteOrigin.replace(/\/+$/, "");
  }
  return `https://${env.mailDomain}`;
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolvePublicBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/contact", "/privacy", "/about", "/api/media/site-settings/"],
        disallow: ["/vcon/", "/users/", "/api/", "/reset-password"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
