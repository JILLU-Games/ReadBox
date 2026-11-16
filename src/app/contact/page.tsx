import { ContactInquiryForm } from "@/components/public/contact-inquiry-form";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import {
  Icon,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
} from "@/components/ui";
import { env } from "@/config/env";
import { getSiteSettings } from "@/core/settings/service";
import { CheckCircle2, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function resolvePublicBaseUrl(): string {
  if (env.publicSiteOrigin) {
    return env.publicSiteOrigin.replace(/\/+$/, "");
  }
  return `https://${env.mailDomain}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "MailStack";
  const title = `Contact ${siteName} — Request Private, Team or Business Mailboxes`;
  const description = `Contact the ${siteName} team to request a private mailbox, configure shared team inbox access, or onboard your business domain.`;
  const baseUrl = resolvePublicBaseUrl();

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: `${baseUrl}/contact`,
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: `${baseUrl}/contact`,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicContactPage(props: {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "MailStack";
  const resolvedSearchParams = (await props.searchParams) ?? {};
  const rawService = resolvedSearchParams.service;
  const initialServiceType = Array.isArray(rawService)
    ? (rawService[0] ?? "")
    : (rawService ?? "");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <PublicSiteHeader
        siteName={siteName}
        logoUrl={settings.logoUrl}
        activePage="contact"
      />

      <main id="main" className="flex-1">
        <section className="border-b border-border bg-card py-5 sm:py-6">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <PageTitle className="text-lg font-medium sm:text-xl">
              Request a private, team, or business mailbox
            </PageTitle>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Share your domain requirements, expected mailbox count, or
              operational questions. Every inquiry is reviewed directly by our
              administration team.
            </p>
          </div>
        </section>

        <section className="py-6 sm:py-8">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <aside className="space-y-4 lg:col-span-5">
                <Panel>
                  <PanelHeader>
                    <SectionTitle>What happens next</SectionTitle>
                  </PanelHeader>
                  <PanelBody>
                    <ol className="space-y-2.5 text-xs">
                      <li className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center bg-primary font-mono text-[11px] font-medium text-primary-foreground">
                          1
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            Requirement review
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            We review your domain, mailbox addresses, and team
                            access model.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center bg-primary font-mono text-[11px] font-medium text-primary-foreground">
                          2
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            DNS &amp; DKIM preparation
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            We prepare exact MX, SPF, DKIM, and DMARC records for
                            your domain.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center bg-primary font-mono text-[11px] font-medium text-primary-foreground">
                          3
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            Mailbox activation
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            Your accounts and shared inbox permissions are
                            activated and verified.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader>
                    <div className="flex items-center gap-1.5">
                      <Icon
                        glyph={ShieldCheck}
                        className="size-4 text-success"
                      />
                      <SectionTitle>Included with every setup</SectionTitle>
                    </div>
                  </PanelHeader>
                  <PanelBody>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5">
                        <Icon
                          glyph={CheckCircle2}
                          className="size-3.5 text-success"
                        />
                        <span>SPF, DKIM, and DMARC verification</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Icon
                          glyph={CheckCircle2}
                          className="size-3.5 text-success"
                        />
                        <span>Role-based shared mailbox access</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Icon
                          glyph={CheckCircle2}
                          className="size-3.5 text-success"
                        />
                        <span>Direct administrative support</span>
                      </li>
                    </ul>

                    {settings.supportEmail ||
                    settings.contactPhone ||
                    settings.officeAddress ? (
                      <div className="mt-3.5 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                        {settings.supportEmail ? (
                          <p className="flex items-center gap-2">
                            <Icon
                              glyph={Mail}
                              className="size-3.5 text-foreground"
                            />
                            <a
                              href={`mailto:${settings.supportEmail}`}
                              data-support-email
                              className="font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                            >
                              {settings.supportEmail}
                            </a>
                          </p>
                        ) : null}
                        {settings.contactPhone ? (
                          <p className="flex items-center gap-2">
                            <Icon
                              glyph={Phone}
                              className="size-3.5 text-foreground"
                            />
                            <span data-contact-phone>
                              {settings.contactPhone}
                            </span>
                          </p>
                        ) : null}
                        {settings.officeAddress ? (
                          <p className="flex items-start gap-2">
                            <Icon
                              glyph={MapPin}
                              className="mt-0.5 size-3.5 text-foreground"
                            />
                            <span data-office-address>
                              {settings.officeAddress}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </PanelBody>
                </Panel>
              </aside>

              <div className="lg:col-span-7">
                <ContactInquiryForm
                  initialServiceType={initialServiceType}
                  siteName={siteName}
                  privacyUrl={settings.privacyUrl || "/privacy"}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter
        siteName={siteName}
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
