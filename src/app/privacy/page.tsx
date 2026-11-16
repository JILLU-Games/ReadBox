import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { Button, Icon, PageTitle, Panel, PanelBody } from "@/components/ui";
import { env } from "@/config/env";
import { getSiteSettings } from "@/core/settings/service";
import { LogIn, UserPlus } from "lucide-react";
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
  const description = `Learn how ${siteName} handles workspace accounts, self-service mailboxes, automated email retention, contact inquiries, and security logs.`;
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
        <section className="border-b border-border bg-card py-5 sm:py-6">
          <div className="mx-auto max-w-4xl px-3 sm:px-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <PageTitle className="text-lg font-medium sm:text-xl">
                  Privacy Policy — Workspace, Mailbox &amp; Inquiry Governance
                </PageTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {siteName} is engineered around minimal data collection,
                  isolated account authentication, configurable auto-delete
                  retention, and transparent operational logging.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" asChild>
                  <Link href="/sign-up">
                    <Icon glyph={UserPlus} className="size-3" />
                    <span>Sign up</span>
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/sign-in">
                    <Icon glyph={LogIn} className="size-3" />
                    <span>Sign in</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-6 sm:py-8">
          <div className="mx-auto max-w-4xl px-3 sm:px-5">
            <Panel>
              <PanelBody className="p-4 sm:p-5">
                <article className="space-y-4 text-xs leading-relaxed text-muted-foreground">
                  <section>
                    <h2 className="text-xs font-medium text-foreground">
                      1. Overview
                    </h2>
                    <p className="mt-1">
                      This Privacy Notice explains what information {siteName}{" "}
                      collects when you register a workspace account via{" "}
                      <code className="font-mono text-foreground">/sign-up</code>
                      , provision or read mailboxes in{" "}
                      <code className="font-mono text-foreground">/users</code>,
                      or submit an inquiry through{" "}
                      <code className="font-mono text-foreground">/contact</code>
                      .
                    </p>
                  </section>

                  <section>
                    <h2 className="text-xs font-medium text-foreground">
                      2. Information We Collect
                    </h2>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5">
                      <li>
                        <strong className="font-medium text-foreground">
                          Workspace account registration:
                        </strong>{" "}
                        When you create an account, we store your email address,
                        password hash, optional display name, phone or company
                        fields required by platform policy, and your assigned
                        User Access Policy (allowed domains, mailbox quota, and
                        auto-delete retention settings).
                      </li>
                      <li>
                        <strong className="font-medium text-foreground">
                          Support &amp; onboarding inquiries:
                        </strong>{" "}
                        When you submit the contact form, we collect your name,
                        email address, optional organization and phone number,
                        selected inquiry topic, and message details.
                      </li>
                      <li>
                        <strong className="font-medium text-foreground">
                          Abuse-prevention &amp; audit metadata:
                        </strong>{" "}
                        To protect our infrastructure, we process one-way
                        cryptographic hashes of submitting IP addresses for rate
                        limiting and record authentication, mailbox creation, and
                        policy changes in PostgreSQL audit logs.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-xs font-medium text-foreground">
                      3. Automated Email Retention &amp; Data Lifecycle
                    </h2>
                    <p className="mt-1">
                      {siteName} supports policy-driven email auto-delete
                      retention. When automated retention is enabled on a user or
                      global policy, messages older than the configured retention
                      window (<code className="font-mono text-foreground">autoDeleteDays</code>)
                      are automatically filtered and expired from workspace
                      views. We never scan mailbox contents for advertising.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-xs font-medium text-foreground">
                      4. Security and Access Controls
                    </h2>
                    <p className="mt-1">
                      {siteName} enforces separate database tables for Workspace
                      Users and Platform Administrators, TLS encryption in
                      transit, CSRF protection on interactive forms, server-side
                      HTML sanitization, and strict domain and quota checks.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-xs font-medium text-foreground">
                      5. Contact &amp; Data Requests
                    </h2>
                    <p className="mt-1">
                      For privacy, account deletion, or security questions
                      regarding {siteName}, please submit a request via{" "}
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
              </PanelBody>
            </Panel>
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
