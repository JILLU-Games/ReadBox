import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import {
  Button,
  Icon,
  PageTitle,
  Panel,
  PanelBody,
  SectionTitle,
} from "@/components/ui";
import { env } from "@/config/env";
import { getSiteSettings } from "@/core/settings/service";
import { getPageSeoMetadata } from "@/core/seo/metadata";
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
  const siteName = settings.siteName || "ReadBox";
  const title = `Privacy Policy — ${siteName}`;
  const description = `Learn how ${siteName} handles workspace accounts, mailboxes, automated message retention, and support inquiries.`;
  const baseUrl = resolvePublicBaseUrl();
  const baseMetadata: Metadata = {
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
  return getPageSeoMetadata("privacy", baseMetadata, baseUrl);
}

export default async function PublicPrivacyPage() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";

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
                <PageTitle>Privacy Policy</PageTitle>
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
                    <SectionTitle>
                      1. Overview
                    </SectionTitle>
                    <p className="mt-1">
                      This Privacy Notice explains what information {siteName}{" "}
                      collects when you register a workspace account, manage
                      mailboxes, or submit a support inquiry.
                    </p>
                  </section>

                  <section>
                    <SectionTitle>
                      2. Information We Collect
                    </SectionTitle>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5">
                      <li>
                        <strong className="font-medium text-foreground">
                          Workspace account registration:
                        </strong>{" "}
                        When you create an account, we store your username,
                        encrypted credentials, optional profile details, and
                        your workspace mailbox preferences.
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
                          Service protection:
                        </strong>{" "}
                        To protect our service from abuse, we record basic
                        security events and rate-limit automated submissions.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <SectionTitle>
                      3. Automated Message Retention
                    </SectionTitle>
                    <p className="mt-1">
                      {siteName} supports automated message retention. When
                      retention is enabled for your workspace, messages older
                      than your configured retention window are automatically
                      expired from your inbox view. We never scan mailbox
                      contents for advertising.
                    </p>
                  </section>

                  <section>
                    <SectionTitle>
                      4. Security and Access Controls
                    </SectionTitle>
                    <p className="mt-1">
                      {siteName} protects your account with encrypted
                      connections, isolated workspace sessions, tracker-free
                      message viewing, and strict domain and mailbox permissions.
                    </p>
                  </section>

                  <section>
                    <SectionTitle>
                      5. Contact &amp; Data Requests
                    </SectionTitle>
                    <p className="mt-1">
                      For privacy, account deletion, or support questions
                      regarding {siteName}, please submit a request via our{" "}
                      <Link
                        href="/contact"
                        className="font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                      >
                        Contact page
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
