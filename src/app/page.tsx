import { PublicFaqAccordion } from "@/components/public/public-faq-accordion";
import { PUBLIC_FAQ_ITEMS } from "@/components/public/public-faq-data";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import {
  Badge,
  Button,
  Icon,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
} from "@/components/ui";
import { env } from "@/config/env";
import { getSiteSettings } from "@/core/settings/service";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sliders,
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
  const siteName = settings.siteName || "MailStack";
  const tagline =
    settings.siteTagline ||
    "Self-Service Custom-Domain Mailboxes, Policy-Governed Workspaces & Team Email";
  const title = `${siteName} — ${tagline}`;
  const description =
    settings.footerDescription ||
    `${siteName} provides self-service user sign-up, policy-governed custom-domain mailboxes, per-user mailbox quotas, automated email retention, and verified SPF/DKIM/DMARC operations.`;
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
      "email auto-delete retention",
      "managed mail server",
      "SPF DKIM DMARC email",
      "secure webmail",
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
    title: "Self-Service Sign-Up & Verification",
    description:
      "Users register directly via /sign-up with configurable field requirements, email/phone verification rules, and instant or admin-approved activation.",
    icon: UserPlus,
  },
  {
    index: "02",
    title: "On-Demand Mailbox Provisioning",
    description:
      "Authenticated workspace users create custom addresses on permitted domains up to their assigned mailbox quota without waiting on manual tickets.",
    icon: Mail,
  },
  {
    index: "03",
    title: "Automated Email Retention",
    description:
      "Configurable auto-delete retention windows automatically filter and expire older messages per user policy while preserving active operational threads.",
    icon: Clock,
  },
  {
    index: "04",
    title: "Granular Users Control Console",
    description:
      "Administrators manage global and per-user allowed domains, mailbox quotas, creation rights, and account approvals from /vcon/users/control.",
    icon: Sliders,
  },
  {
    index: "05",
    title: "Isolated Admin & User Auth",
    description:
      "Dedicated database tables and session registries separate User Workspace access (/sign-in) from Platform Administration (/vcon/login).",
    icon: Lock,
  },
  {
    index: "06",
    title: "Sandboxed Reader & DNS Guardrails",
    description:
      "Live MX, SPF, DKIM, and DMARC checks pair with server-side HTML sanitization, sandboxed message rendering, and PostgreSQL audit logs.",
    icon: ShieldCheck,
  },
] as const;

const WORKSPACE_TIERS = [
  {
    key: "personal",
    kicker: "Individual Workspace",
    featured: false,
    title: "Self-Service Personal Mailboxes",
    summary:
      "Register your account, choose from allowed verified domains, and provision private mailboxes with zero ad tracking and automated retention.",
    bullets: [
      "Direct account registration via /sign-up",
      "Self-service mailbox creation within assigned quota",
      "Configurable email auto-delete retention window",
      "Sanitized HTML reader with tracker blocking",
    ],
    ctaLabel: "Sign up for workspace",
    href: "/sign-up",
    icon: KeyRound,
  },
  {
    key: "team",
    kicker: "Collaborative Operations",
    featured: true,
    title: "Team & Shared Mailbox Access",
    summary:
      "Operate shared support@, billing@, and ops@ inboxes alongside personal workspace mailboxes using role-based access instead of shared passwords.",
    bullets: [
      "Granular per-user mailbox read & creation permissions",
      "Per-user domain whitelist & mailbox quota enforcement",
      "Fast search, unread filtering, and safe attachments",
      "Complete audit trail of account and mailbox activity",
    ],
    ctaLabel: "Create team account",
    href: "/sign-up",
    icon: Users,
  },
  {
    key: "business",
    kicker: "Multi-Domain Governance",
    featured: false,
    title: "Enterprise & Custom Domains",
    summary:
      "Onboard your organization's custom domains with dedicated DKIM selectors, custom user sign-up policies, and full administrative telemetry.",
    bullets: [
      "Multi-domain provisioning with automated DKIM keys",
      "Centralized /vcon/users/control policy governance",
      "Live Postfix, Dovecot, OpenDKIM & worker health checks",
      "Custom domain onboarding & technical support",
    ],
    ctaLabel: "Contact enterprise support",
    href: "/contact?service=business",
    icon: Building2,
  },
] as const;

const WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Create your account",
    description:
      "Sign up at /sign-up with your email and credentials. Accounts activate immediately or upon administrator approval based on platform policy.",
  },
  {
    step: "2",
    title: "Provision mailboxes on allowed domains",
    description:
      "Sign in to /users/mailboxes, select an approved domain, and create your custom mailbox addresses within your allocated quota.",
  },
  {
    step: "3",
    title: "Receive & manage mail securely",
    description:
      "Read incoming mail inside the sandboxed webmail workspace with real-time updates, unread filters, and automatic retention enforcement.",
  },
] as const;

const SECURITY_PILLARS = [
  {
    title: "Authenticated Mail Delivery (SPF · DKIM · DMARC)",
    description:
      "Automated DKIM key generation, strict SPF policies, and DMARC alignment checks protect domain reputation across every hosted address.",
    icon: Globe,
  },
  {
    title: "Policy-Driven Workspace Isolation",
    description:
      "Every user operation—domain selection, mailbox creation, and inbox reading—is verified at runtime against their active User Access Policy.",
    icon: ShieldCheck,
  },
  {
    title: "Immutable PostgreSQL Audit Trail",
    description:
      "Sign-ups, policy updates, mailbox creations, and administrative actions are recorded in a single authoritative PostgreSQL database.",
    icon: Activity,
  },
] as const;

export default async function PublicLandingPage() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "MailStack";
  const mailDomain = env.mailDomain || "mailstack.local";
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
          "Self-service custom-domain mailbox hosting, policy-governed workspaces, and managed business email infrastructure.",
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
        {/* Hero Section + Live Policy-Governed Workspace Preview */}
        <section className="border-b border-border bg-card py-7 sm:py-9">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
              <div className="flex min-w-0 flex-col justify-between lg:col-span-7">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Self-Service Mailboxes · Domain &amp; Quota Governance · SPF /
                    DKIM / DMARC
                  </p>

                  <PageTitle className="mt-2 text-xl font-medium tracking-tight text-balance sm:text-2xl">
                    Self-service custom-domain mailboxes and policy-governed
                    team workspaces.
                  </PageTitle>

                  <p
                    data-site-tagline
                    className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground"
                  >
                    {settings.siteTagline
                      ? `${settings.siteTagline} Create your account, provision mailboxes on approved domains within your quota, and manage messages with automated retention and sandboxed HTML security.`
                      : `Create your workspace account, provision mailboxes on approved domains within your quota, and manage messages with automated retention and sandboxed HTML security on ${siteName}.`}
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
                      <dt className="text-[11px] text-muted-foreground">
                        Onboarding
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-foreground">
                        Self-Service Sign-Up
                      </dd>
                    </PanelBody>
                  </Panel>
                  <Panel className="min-w-0 bg-background">
                    <PanelBody className="px-2.5 py-2">
                      <dt className="text-[11px] text-muted-foreground">
                        Mailbox Control
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-foreground">
                        Domain &amp; Quota Policy
                      </dd>
                    </PanelBody>
                  </Panel>
                  <Panel className="min-w-0 bg-background">
                    <PanelBody className="px-2.5 py-2">
                      <dt className="text-[11px] text-muted-foreground">
                        Lifecycle
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-foreground">
                        Auto-Delete Retention
                      </dd>
                    </PanelBody>
                  </Panel>
                  <Panel className="min-w-0 bg-background">
                    <PanelBody className="px-2.5 py-2">
                      <dt className="text-[11px] text-muted-foreground">
                        Authentication
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs font-medium text-foreground">
                        SPF · DKIM · DMARC
                      </dd>
                    </PanelBody>
                  </Panel>
                </dl>
              </div>

              {/* Compact Workspace & Policy Preview Window */}
              <div
                aria-label={`${siteName} workspace preview`}
                className="min-w-0 lg:col-span-5"
              >
                <Panel className="flex h-full flex-col justify-between bg-background">
                  <PanelHeader className="bg-muted">
                    <span className="text-xs font-medium text-foreground">
                      {siteName} User Workspace
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      Quota: 3 / 5 · Auto-delete: 30d
                    </span>
                  </PanelHeader>

                  <div className="grid flex-1 grid-cols-1 divide-y divide-border sm:grid-cols-12 sm:divide-x sm:divide-y-0">
                    <div className="bg-card p-2.5 sm:col-span-5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          My Mailboxes
                        </p>
                        <span className="font-mono text-[10px] text-success">
                          + Create
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-1 text-[11px]">
                        <li className="flex items-center justify-between gap-1 bg-sidebar-active px-2 py-1 font-medium text-sidebar-active-foreground">
                          <span className="truncate font-mono">
                            alex@{mailDomain}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] tabular-nums">
                            3
                          </span>
                        </li>
                        <li className="flex items-center justify-between gap-1 px-2 py-1 text-muted-foreground">
                          <span className="truncate font-mono">
                            support@{mailDomain}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] tabular-nums">
                            1
                          </span>
                        </li>
                        <li className="flex items-center justify-between gap-1 px-2 py-1 text-muted-foreground">
                          <span className="truncate font-mono">
                            billing@{mailDomain}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] tabular-nums">
                            0
                          </span>
                        </li>
                      </ul>

                      <div className="mt-2.5 border-t border-border pt-2 text-[10px] text-muted-foreground">
                        <p className="font-medium text-foreground">
                          Active Policy
                        </p>
                        <p className="mt-0.5 font-mono">
                          Allowed: @{mailDomain}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between p-2.5 sm:col-span-7">
                      <div className="space-y-1.5">
                        <article className="border border-primary/40 bg-accent p-2">
                          <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Workspace Control
                            </span>
                            <span className="font-mono tabular-nums">1m ago</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                            Self-service mailbox provisioned
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            alex@{mailDomain} active · DKIM &amp; DMARC verified.
                          </p>
                        </article>

                        <article className="border border-border bg-card p-2">
                          <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Operations Desk
                            </span>
                            <span className="font-mono tabular-nums">14m ago</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                            Release notes &amp; signed attachment
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            Sanitized HTML · 30-day retention policy active.
                          </p>
                        </article>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
                        <span>Sandboxed Reader · Tracker-free</span>
                        <span className="font-mono font-medium text-success">
                          Policy Enforced
                        </span>
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
              <div className="max-w-2xl">
                <SectionTitle className="text-sm font-medium sm:text-base">
                  Built for self-service speed and administrative control
                </SectionTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {siteName} combines instant user sign-up and self-service
                  mailbox creation with strict domain, quota, and retention
                  governance.
                </p>
              </div>
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
                      <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                        {cap.index}.
                      </span>
                      <Icon
                        glyph={cap.icon}
                        className="size-3.5 text-muted-foreground"
                      />
                    </div>
                    <h3 className="mt-1.5 text-xs font-medium text-foreground">
                      {cap.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {cap.description}
                    </p>
                  </PanelBody>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* Workspace Access & Governance Tiers (#workspaces) */}
        <section
          id="workspaces"
          className="scroll-mt-14 border-b border-border bg-card py-7 sm:py-9"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="max-w-2xl">
              <SectionTitle className="text-sm font-medium sm:text-base">
                Workspace configurations for individuals, teams, and enterprises
              </SectionTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Start immediately with self-service sign-up or connect your
                organization&apos;s custom domains with tailored quota and
                retention rules.
              </p>
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
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {tier.kicker}
                        </span>
                        <Icon
                          glyph={tier.icon}
                          className="size-4 text-muted-foreground"
                        />
                      </div>

                      <h3 className="mt-2 text-sm font-medium text-foreground">
                        {tier.title}
                      </h3>
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
              <SectionTitle className="text-sm font-medium sm:text-base">
                From account sign-up to active mailbox in three steps
              </SectionTitle>
            </div>

            <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {WORKFLOW_STEPS.map((item) => (
                <li key={item.step}>
                  <Panel className="h-full bg-card">
                    <PanelBody className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center bg-primary font-mono text-[11px] font-medium tabular-nums text-primary-foreground">
                          {item.step}
                        </span>
                        <h3 className="text-xs font-medium text-foreground">
                          {item.title}
                        </h3>
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

        {/* Security Architecture (#security) */}
        <section
          id="security"
          className="scroll-mt-14 border-b border-border bg-card py-7 sm:py-9"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <SectionTitle className="text-sm font-medium sm:text-base">
                  Hardened from the SMTP edge to the browser reader
                </SectionTitle>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {siteName} enforces defensive controls across delivery,
                  authentication, runtime policy evaluation, and message
                  viewing.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Scoped Auth Tables
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Sandboxed Iframe
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Quota &amp; Domain Locks
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    PostgreSQL Audit Trail
                  </Badge>
                </div>
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
                        <h3 className="text-xs font-medium text-foreground">
                          {item.title}
                        </h3>
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
              <SectionTitle className="text-sm font-medium sm:text-base">
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
                  <SectionTitle className="text-sm font-medium sm:text-base">
                    Ready to launch your mailbox workspace?
                  </SectionTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create your account to start provisioning mailboxes on
                    approved domains, or contact our team for custom enterprise
                    domain onboarding.
                  </p>
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
