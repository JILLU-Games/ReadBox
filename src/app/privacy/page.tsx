import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { env } from "@/config/env";
import { getSiteSettings } from "@/core/settings/service";
import type { Metadata } from "next";
import Link from "next/link";

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
  const title = `Privacy Policy — ${siteName}`;
  const description = `Learn how ${siteName} handles contact inquiries, mailbox data, security logs, and privacy controls.`;
  const baseUrl = resolvePublicBaseUrl();

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: `${baseUrl}/privacy`,
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: `${baseUrl}/privacy`,
      locale: "en_US",
    },
  };
}

export default async function PublicPrivacyPage() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "MailStack";

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <PublicSiteHeader
        siteName={siteName}
        logoUrl={settings.logoUrl}
        activePage="privacy"
      />

      <main id="main" className="flex-1">
        <section className="border-b border-border bg-card py-6 sm:py-8">
          <div className="mx-auto max-w-4xl px-3 sm:px-5">
            <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
              Privacy Notice
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              How {siteName} handles inquiries and operational data
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {siteName} is designed around minimal data collection, strict
              access control, and transparent operational logging.
            </p>
          </div>
        </section>

        <section className="py-6 sm:py-9">
          <div className="mx-auto max-w-4xl px-3 sm:px-5">
            <article className="space-y-5 rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground sm:p-6">
              <section>
                <h2 className="text-sm font-bold text-foreground">
                  1. Overview
                </h2>
                <p className="mt-1">
                  This Privacy Notice explains what information {siteName}{" "}
                  collects when you visit our public website, submit a service
                  inquiry through our contact form, or use authorized {siteName}{" "}
                  mailbox services.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-bold text-foreground">
                  2. Information We Collect
                </h2>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-foreground">
                      Contact inquiries:
                    </strong>{" "}
                    When you submit the contact form, we collect your name,
                    email address, optional organization and phone number,
                    selected service requirement, and message content.
                  </li>
                  <li>
                    <strong className="text-foreground">
                      Abuse-prevention metadata:
                    </strong>{" "}
                    To protect our mail infrastructure from automated spam, we
                    process a one-way cryptographic hash of the submitting IP
                    address and email address along with submission timestamps.
                  </li>
                  <li>
                    <strong className="text-foreground">
                      Operational audit logs:
                    </strong>{" "}
                    For authorized platform users, {siteName} records
                    authentication events, mailbox permission changes, and
                    domain configuration actions for security auditing.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-sm font-bold text-foreground">
                  3. How Information Is Used
                </h2>
                <p className="mt-1">
                  We use the information you provide solely to respond to your
                  inquiry, provision and maintain requested mailbox services,
                  verify custom-domain DNS configurations, and protect the
                  security and reliability of the platform. We do not sell
                  personal data or use mailbox contents for advertising.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-bold text-foreground">
                  4. Security and Access Controls
                </h2>
                <p className="mt-1">
                  {siteName} enforces TLS encryption in transit, CSRF protection
                  on interactive forms, rate limiting, server-side HTML
                  sanitization, and role-based access control so that only
                  explicitly authorized accounts can view assigned mailboxes.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-bold text-foreground">
                  5. Data Retention
                </h2>
                <p className="mt-1">
                  Contact inquiries and security logs are retained only as long
                  as necessary to fulfill onboarding requests, maintain
                  customer support records, and comply with operational security
                  requirements.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-bold text-foreground">
                  6. Sharing and Third Parties
                </h2>
                <p className="mt-1">
                  We do not share your inquiry details or mailbox data with
                  third-party marketers. Data is only disclosed when required to
                  operate the underlying infrastructure requested by the
                  customer or when required by applicable law.
                </p>
              </section>

              <section>
                <h2 className="text-sm font-bold text-foreground">
                  7. Your Choices
                </h2>
                <p className="mt-1">
                  You may request access to, correction of, or deletion of a
                  contact inquiry you submitted by reaching out through our{" "}
                  <Link
                    href="/contact"
                    className="font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                  >
                    contact page
                  </Link>
                  .
                </p>
              </section>

              <section>
                <h2 className="text-sm font-bold text-foreground">
                  8. Contact
                </h2>
                <p className="mt-1">
                  For privacy or security questions regarding {siteName}, please
                  submit a request via{" "}
                  <Link
                    href="/contact"
                    className="font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                  >
                    /contact
                  </Link>
                  {settings.supportEmail ? (
                    <>
                      {" "}
                      or email{" "}
                      <a
                        href={`mailto:${settings.supportEmail}`}
                        data-support-email
                        className="font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                      >
                        {settings.supportEmail}
                      </a>
                    </>
                  ) : null}
                  .
                </p>
              </section>
            </article>
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
