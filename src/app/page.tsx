import { PublicFaqAccordion } from "@/components/public/public-faq-accordion";
import { PUBLIC_FAQ_ITEMS } from "@/components/public/public-faq-data";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import {
  Button,
  CaptionText,
  Icon,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
  SubHeading,
} from "@/components/ui";
import { env } from "@/config/env";
import { getSiteSettings } from "@/core/settings/service";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Inbox,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
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
  const tagline =
    settings.siteTagline ||
    "Self-Service Custom-Domain Mailboxes & Private Team Workspaces";
  const title = `${siteName} — ${tagline}`;
  const description =
    settings.footerDescription ||
    `${siteName} provides self-service user sign-up, custom-domain mailboxes, shared team inboxes, and automated message retention.`;
  const baseUrl = resolvePublicBaseUrl();

  return {
    title: {
      absolute: title,
    },
    description,
    keywords: [
      siteName,
      "self-service mailbox workspace",
      "custom domain email",
      "shared team inbox",
      "email retention",
      "private webmail",
    ],
    alternates: {
      canonical: `${baseUrl}/`,
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: `${baseUrl}/`,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

const CAPABILITY_MODULES = [
  {
    index: "01",
    title: "Fast Account Sign-Up",
    description:
      "Register your workspace account in seconds and sign in directly to manage your personal or team mailboxes.",
    icon: UserPlus,
  },
  {
    index: "02",
    title: "On-Demand Mailbox Creation",
    description:
      "Create custom email addresses on available domains right from your workspace without waiting on manual setup tickets.",
    icon: Mail,
  },
  {
    index: "03",
    title: "Automated Message Retention",
    description:
      "Keep your inboxes clean automatically with configurable message retention windows while preserving active conversations.",
    icon: Clock,
  },
  {
    index: "04",
    title: "Shared Team Inboxes",
    description:
      "Collaborate across support, billing, and operations addresses with dedicated user accounts instead of shared passwords.",
    icon: Users,
  },
  {
    index: "05",
    title: "Real-Time Inbox Updates",
    description:
      "Receive instant desktop and workspace notifications as new messages arrive, with fast search and attachment filtering.",
    icon: Inbox,
  },
  {
    index: "06",
    title: "Tracker-Free Email Reader",
    description:
      "Read HTML and plain-text messages safely with remote tracking pixels, scripts, and unsafe external content blocked by default.",
    icon: ShieldCheck,
  },
] as const;

const WORKSPACE_TIERS = [
  {
    key: "personal",
    kicker: "Individual Workspace",
    featured: false,
    title: "Personal Mailboxes",
    summary:
      "Create your account, select from available domains, and launch private mailboxes with zero ad tracking and clean webmail access.",
    bullets: [
      "Direct self-service account registration",
      "On-demand mailbox creation on available domains",
      "Automatic message retention controls",
      "Clean HTML & plain-text reader with tracker blocking",
    ],
    ctaLabel: "Sign up for workspace",
    href: "/sign-up",
    icon: KeyRound,
  },
  {
    key: "team",
    kicker: "Collaborative Operations",
    featured: true,
    title: "Team & Shared Inboxes",
    summary:
      "Manage shared support@, billing@, and ops@ inboxes alongside individual mailboxes with dedicated sign-in credentials for every member.",
    bullets: [
      "Shared and personal mailbox access in one view",
      "Multi-domain address creation for projects & teams",
      "Instant search, unread filters, and attachment downloads",
      "Live incoming mail alerts across your active inboxes",
    ],
    ctaLabel: "Create team account",
    href: "/sign-up",
    icon: Users,
  },
  {
    key: "business",
    kicker: "Custom Organization Domains",
    featured: false,
    title: "Custom Domain Onboarding",
    summary:
      "Connect your organization's own domain names for dedicated team mailboxes, custom workspace limits, and priority onboarding support.",
    bullets: [
      "Dedicated custom domains for your organization",
      "Tailored mailbox limits & retention schedules",
      "Guided domain setup & verification assistance",
      "Direct technical and onboarding support",
    ],
    ctaLabel: "Contact domain support",
    href: "/contact?service=business",
    icon: Building2,
  },
] as const;

const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Create your account",
    description:
      "Sign up with your username and credentials to activate your private webmail workspace.",
  },
  {
    step: "2",
    title: "Create your mailboxes",
    description:
      "Choose an available domain and create custom mailbox addresses for your personal or team workflows.",
  },
  {
    step: "3",
    title: "Read & organize incoming mail",
    description:
      "View messages in real time with clean HTML rendering, quick search, attachment downloads, and automatic retention.",
  },
] as const;

const SECURITY_PILLARS = [
  {
    title: "Verified Custom Domains",
    description:
      "Every hosted domain is configured for reliable inbound reception so your team never misses critical messages or verification emails.",
    icon: Globe,
  },
  {
    title: "Private Workspace Access",
    description:
      "Each user signs in with their own credentials and accesses only the mailboxes and domains assigned to their workspace.",
    icon: Lock,
  },
  {
    title: "Safe Message Viewing",
    description:
      "Incoming HTML emails are cleaned before display to block tracking pixels, external scripts, and unwanted third-party requests.",
    icon: ShieldCheck,
  },
] as const;

export default async function PublicLandingPage() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";
  const mailDomain = env.mailDomain || "readbox.local";
  const baseUrl = resolvePublicBaseUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: siteName,
        url: `${baseUrl}/`,
        description:
          settings.siteTagline ||
          "Self-service custom-domain mailboxes, shared team inboxes, and private webmail workspaces.",
        ...(settings.supportEmail ? { email: settings.supportEmail } : {}),
        ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support and domain onboarding",
            url: `${baseUrl}/contact`,
            availableLanguage: ["en"],
          },
        ],
      },
      {
        "@type": "WebApplication",
        name: siteName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "All",
        url: `${baseUrl}/`,
      },
      {
        "@type": "FAQPage",
        "@id": `${baseUrl}/#faq`,
        mainEntity: PUBLIC_FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PublicSiteHeader
        siteName={siteName}
        logoUrl={settings.logoUrl}
        activePage="home"
      />

      <main id="main" className="flex-1">
        {/* Hero Section + Workspace Preview */}
        <section className="border-b border-border bg-card py-7 sm:py-9">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
              <div className="flex min-w-0 flex-col justify-between lg:col-span-7">
                <div>
                  <PageTitle className="text-balance">
                    Self-service custom-domain mailboxes and private team
                    workspaces.
                  </PageTitle>

                  <p
                    data-site-tagline
                    className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground"
                  >
                    {settings.siteTagline ||
                      `Create your account, launch mailboxes on available domains, and read incoming email on ${siteName}.`}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button asChild>
                      <Link href="/sign-up">
                        <Icon glyph={UserPlus} className="size-3.5" />
                        <span>Sign up</span>
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/sign-in">
                        <Icon glyph={LogIn} className="size-3.5" />
                        <span>Sign in</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link href="/contact">
                        <span>Contact &amp; domain support</span>
                        <Icon glyph={ArrowRight} className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-2 border-t border-border pt-4 sm:grid-cols-4">
                  <Panel className="min-w-0 bg-background">
                    <PanelBody className="px-2.5 py-2">
                      <dt>
                        <CaptionText>Onboarding</CaptionText>
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-foreground">
                        Self-Service Sign-Up
                      </dd>
                    </PanelBody>
                  </Panel>
                  <Panel className="min-w-0 bg-background">
                    <PanelBody className="px-2.5 py-2">
                      <dt>
                        <CaptionText>Mailboxes</CaptionText>
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-foreground">
                        Instant Provisioning
                      </dd>
                    </PanelBody>
                  </Panel>
                  <Panel className="min-w-0 bg-background">
                    <PanelBody className="px-2.5 py-2">
                      <dt>
                        <CaptionText>Inbox Hygiene</CaptionText>
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-foreground">
                        Automated Retention
                      </dd>
                    </PanelBody>
                  </Panel>
                  <Panel className="min-w-0 bg-background">
                    <PanelBody className="px-2.5 py-2">
                      <dt>
                        <CaptionText>Privacy</CaptionText>
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-foreground">
                        Tracker-Free Reader
                      </dd>
                    </PanelBody>
                  </Panel>
                </dl>
              </div>

              {/* Compact Workspace Preview Window */}
              <div
                aria-label={`${siteName} workspace preview`}
                className="min-w-0 lg:col-span-5"
              >
                <Panel className="flex h-full flex-col justify-between bg-background">
                  <PanelHeader className="bg-muted">
                    <span className="text-xs font-medium text-foreground">
                      {siteName} Inbox Workspace
                    </span>
                  </PanelHeader>

                  <div className="grid flex-1 grid-cols-1 divide-y divide-border sm:grid-cols-12 sm:divide-x sm:divide-y-0">
                    <div className="bg-card p-2.5 sm:col-span-5">
                      <div className="flex items-center justify-between gap-1">
                        <CaptionText className="font-medium">
                          My Mailboxes
                        </CaptionText>
                        <CaptionText className="font-mono text-success">
                          + Create
                        </CaptionText>
                      </div>
                      <ul className="mt-1.5 space-y-1 text-xs">
                        <li className="flex items-center justify-between gap-1 bg-sidebar-active px-2 py-1 font-medium text-sidebar-active-foreground">
                          <span className="truncate font-mono">
                            alex@{mailDomain}
                          </span>
                          <CaptionText className="shrink-0 font-mono text-sidebar-active-foreground tabular-nums">
                            3
                          </CaptionText>
                        </li>
                        <li className="flex items-center justify-between gap-1 px-2 py-1 text-muted-foreground">
                          <span className="truncate font-mono">
                            support@{mailDomain}
                          </span>
                          <CaptionText className="shrink-0 font-mono tabular-nums">
                            1
                          </CaptionText>
                        </li>
                        <li className="flex items-center justify-between gap-1 px-2 py-1 text-muted-foreground">
                          <span className="truncate font-mono">
                            billing@{mailDomain}
                          </span>
                          <CaptionText className="shrink-0 font-mono tabular-nums">
                            0
                          </CaptionText>
                        </li>
                      </ul>
                    </div>

                    <div className="flex flex-col justify-between p-2.5 sm:col-span-7">
                      <div className="space-y-1.5">
                        <article className="border border-primary/40 bg-accent p-2">
                          <div className="flex items-center justify-between gap-1">
                            <CaptionText className="font-medium text-foreground">
                              Team Updates
                            </CaptionText>
                            <CaptionText className="font-mono tabular-nums">
                              1m ago
                            </CaptionText>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                            New mailbox ready for your workspace
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            alex@{mailDomain} is active and ready to receive mail.
                          </p>
                        </article>

                        <article className="border border-border bg-card p-2">
                          <div className="flex items-center justify-between gap-1">
                            <CaptionText className="font-medium text-foreground">
                              Billing Desk
                            </CaptionText>
                            <CaptionText className="font-mono tabular-nums">
                              14m ago
                            </CaptionText>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                            Monthly statement &amp; PDF receipt
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            Attached statement is ready for download.
                          </p>
                        </article>
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities (#capabilities) */}
        <section
          id="capabilities"
          className="scroll-mt-14 border-b border-border py-7 sm:py-9"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <SectionTitle>
                Everything you need for clean, reliable email workspaces
              </SectionTitle>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Create your account</span>
                <Icon glyph={ArrowRight} className="size-3" />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITY_MODULES.map((cap) => (
                <Panel key={cap.index} className="bg-card">
                  <PanelBody className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <CaptionText className="font-mono font-medium tabular-nums">
                        {cap.index}.
                      </CaptionText>
                      <Icon
                        glyph={cap.icon}
                        className="size-3.5 text-muted-foreground"
                      />
                    </div>
                    <SubHeading className="mt-1.5">{cap.title}</SubHeading>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {cap.description}
                    </p>
                  </PanelBody>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* Workspace Plans (#workspaces) */}
        <section
          id="workspaces"
          className="scroll-mt-14 border-b border-border bg-card py-7 sm:py-9"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="max-w-2xl">
              <SectionTitle>
                Workspaces for individuals, teams, and organizations
              </SectionTitle>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {WORKSPACE_TIERS.map((tier) => (
                <Panel
                  key={tier.key}
                  className={`flex flex-col justify-between bg-background ${
                    tier.featured ? "border-primary" : ""
                  }`}
                >
                  <PanelBody className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <CaptionText className="font-medium">
                          {tier.kicker}
                        </CaptionText>
                        <Icon
                          glyph={tier.icon}
                          className="size-4 text-muted-foreground"
                        />
                      </div>

                      <SubHeading className="mt-2">{tier.title}</SubHeading>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {tier.summary}
                      </p>

                      <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-foreground">
                        {tier.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="flex items-start gap-1.5 leading-snug"
                          >
                            <Icon
                              glyph={CheckCircle2}
                              className="mt-0.5 size-3.5 shrink-0 text-success"
                            />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 pt-2">
                      <Button
                        variant={tier.featured ? "default" : "outline"}
                        asChild
                        className="w-full"
                      >
                        <Link href={tier.href}>
                          <span>{tier.ctaLabel}</span>
                          <Icon glyph={ArrowRight} className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  </PanelBody>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* 3-Step Self-Service Workflow */}
        <section className="border-b border-border py-7 sm:py-9">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="max-w-2xl">
              <SectionTitle>
                From account sign-up to active mailbox in three steps
              </SectionTitle>
            </div>

            <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {WORKFLOW_STEPS.map((item) => (
                <li key={item.step}>
                  <Panel className="h-full bg-card">
                    <PanelBody className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center bg-primary font-mono text-xs font-medium tabular-nums text-primary-foreground">
                          {item.step}
                        </span>
                        <SubHeading>{item.title}</SubHeading>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </PanelBody>
                  </Panel>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy & Security (#security) */}
        <section
          id="security"
          className="scroll-mt-14 border-b border-border bg-card py-7 sm:py-9"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <SectionTitle>
                  Designed for privacy and safe everyday email
                </SectionTitle>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {siteName} protects your workspace with isolated accounts and
                  clean message viewing.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:col-span-7">
                {SECURITY_PILLARS.map((item) => (
                  <Panel key={item.title} className="bg-background">
                    <PanelBody className="p-3.5">
                      <div className="flex items-center gap-2">
                        <Icon
                          glyph={item.icon}
                          className="size-3.5 text-primary"
                        />
                        <SubHeading>{item.title}</SubHeading>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </PanelBody>
                  </Panel>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section (#faq) */}
        <section id="faq" className="scroll-mt-14 py-7 sm:py-9">
          <div className="mx-auto max-w-4xl px-3 sm:px-5">
            <div className="mb-4">
              <SectionTitle>
                Common questions about {siteName}
              </SectionTitle>
            </div>

            <PublicFaqAccordion items={PUBLIC_FAQ_ITEMS} />
          </div>
        </section>

        {/* Compact Bottom Conversion Banner */}
        <section className="border-t border-border bg-card py-6 sm:py-8">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <Panel className="bg-background">
              <PanelBody className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="max-w-xl">
                  <SectionTitle>
                    Ready to launch your mailbox workspace?
                  </SectionTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild>
                    <Link href="/sign-up">
                      <Icon glyph={UserPlus} className="size-3.5" />
                      <span>Sign up</span>
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/sign-in">
                      <Icon glyph={LogIn} className="size-3.5" />
                      <span>Sign in</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/contact">Contact support</Link>
                  </Button>
                </div>
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
