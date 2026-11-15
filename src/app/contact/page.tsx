import { ContactInquiryForm } from "@/components/public/contact-inquiry-form";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
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
        <section className="border-b border-border bg-card py-6 sm:py-8">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
              Contact &amp; Onboarding
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Request a private, team, or business mailbox
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Share your domain requirements, expected mailbox count, or
              operational questions. Every inquiry is reviewed directly by our
              administration team.
            </p>
          </div>
        </section>

        <section className="py-6 sm:py-9">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <aside className="space-y-4 lg:col-span-5">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h2 className="text-sm font-bold text-foreground">
                    What happens next
                  </h2>
                  <ol className="mt-3 space-y-2.5 text-xs">
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
                        1
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">
                          Requirement review
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          We review your domain, mailbox addresses, and team
                          access model.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
                        2
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">
                          DNS &amp; DKIM preparation
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          We prepare exact MX, SPF, DKIM, and DMARC records for
                          your domain.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
                        3
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">
                          Mailbox activation
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          Your accounts and shared inbox permissions are
                          activated and verified.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <ShieldCheck
                      className="h-4 w-4 text-success"
                      aria-hidden="true"
                    />
                    <span>Included with every setup</span>
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      <span>SPF, DKIM, and DMARC verification</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      <span>Role-based shared mailbox access</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0 text-success"
                        aria-hidden="true"
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
                          <Mail
                            className="h-3.5 w-3.5 shrink-0 text-foreground"
                            aria-hidden="true"
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
                          <Phone
                            className="h-3.5 w-3.5 shrink-0 text-foreground"
                            aria-hidden="true"
                          />
                          <span data-contact-phone>{settings.contactPhone}</span>
                        </p>
                      ) : null}
                      {settings.officeAddress ? (
                        <p className="flex items-start gap-2">
                          <MapPin
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground"
                            aria-hidden="true"
                          />
                          <span data-office-address>
                            {settings.officeAddress}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
