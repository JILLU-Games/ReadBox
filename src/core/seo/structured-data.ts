import type { PublicFaqItem } from "@/components/public/public-faq-data";

export interface PublicStructuredDataOptions {
  readonly baseUrl: string;
  readonly siteName: string;
  readonly siteTagline: string;
  readonly supportEmail?: string;
  readonly contactPhone?: string;
  readonly faqItems: readonly PublicFaqItem[];
}

export function buildPublicSiteStructuredData(options: PublicStructuredDataOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": baseUrl + "/#organization",
        name: options.siteName,
        url: baseUrl + "/",
        description: options.siteTagline ||
          "Custom-domain mailboxes, shared team inboxes, and private webmail workspaces.",
        ...(options.supportEmail ? { email: options.supportEmail } : {}),
        ...(options.contactPhone ? { telephone: options.contactPhone } : {}),
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support and domain onboarding",
            url: baseUrl + "/contact",
            availableLanguage: ["en"],
          },
        ],
      },
      {
        "@type": "WebApplication",
        name: options.siteName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "All",
        url: baseUrl + "/",
      },
      {
        "@type": "FAQPage",
        "@id": baseUrl + "/#faq",
        mainEntity: options.faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

/** Escape JSON for insertion into an HTML script element, not merely JSON syntax. */
export function serializeJsonLdForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/gu, (character) =>
    "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0"));
}
