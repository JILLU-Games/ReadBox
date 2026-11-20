import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { Button, PageTitle, Panel, PanelBody, SectionTitle } from "@/components/ui";
import { env } from "@/config/env";
import { getPublicBrandPresentation } from "@/core/seo/brand";
import { getSiteSettings } from "@/core/settings/service";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

function resolvePublicBaseUrl(): string {
  if (env.publicSiteOrigin) return env.publicSiteOrigin.replace(/\/+$/, "");
  return "https://" + env.mailDomain;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const origin = resolvePublicBaseUrl();
  const brand = getPublicBrandPresentation(settings.siteName, origin);
  const title = "About " + brand.displayName;
  return {
    title: { absolute: title },
    description: brand.aboutDescription,
    alternates: { canonical: origin + "/about" },
    openGraph: {
      type: "website",
      siteName: brand.displayName,
      title,
      description: brand.aboutDescription,
      url: origin + "/about",
      locale: "en_US",
    },
    twitter: { card: "summary", title, description: brand.aboutDescription },
  };
}

export default async function AboutPage() {
  const settings = await getSiteSettings();
  const origin = resolvePublicBaseUrl();
  const brand = getPublicBrandPresentation(settings.siteName, origin);
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <PublicSiteHeader siteName={brand.displayName} logoUrl={settings.logoUrl} />
      <main id="main" className="flex-1">
        <section className="border-b border-border bg-card py-7 sm:py-9">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <PageTitle>About {brand.displayName}</PageTitle>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {brand.aboutDescription}
            </p>
          </div>
        </section>
        <section className="py-6 sm:py-8">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <Panel>
              <PanelBody className="space-y-4">
                <SectionTitle>How this workspace works</SectionTitle>
                <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
                  {brand.aboutPoints.map((point) => <li key={point}>{point}</li>)}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild><Link href="/contact">Contact &amp; support</Link></Button>
                  <Button size="sm" variant="outline" asChild><Link href="/privacy">Privacy policy</Link></Button>
                </div>
              </PanelBody>
            </Panel>
          </div>
        </section>
      </main>
      <PublicSiteFooter
        siteName={brand.displayName}
        logoUrl={settings.logoUrl}
        footerDescription={settings.footerDescription}
        copyrightText={settings.copyrightText}
        privacyUrl={settings.privacyUrl}
        sourceCodeUrl={settings.sourceCodeUrl}
        supportEmail={settings.supportEmail}
      />
    </div>
  );
}
