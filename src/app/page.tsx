import { PublicFaqAccordion } from "@/components/public/public-faq-accordion";
import { PUBLIC_FAQ_ITEMS } from "@/components/public/public-faq-data";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { env } from "@/config/env";
import { getSiteSettings } from "@/core/settings/service";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  Globe,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
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
    "Private Mailbox Hosting, Team Email & Custom Domain Mail";
  const title = `${siteName} — ${tagline}`;
  const description =
    settings.footerDescription ||
    `${siteName} delivers private custom-domain mailboxes, shared team inbox access, verified SPF/DKIM/DMARC authentication, and auditable business email operations.`;
  const baseUrl = resolvePublicBaseUrl();

  return {
    title: {
      absolute: title,
    },
    description,
    keywords: [
      siteName,
      "private mailbox hosting",
      "custom domain email",
      "shared team inbox",
      "business email service",
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

const TRUST_PILLARS = [
  {
    title: "Dedicated domain identity",
    description:
      "Operate mailboxes on your own domain with live MX, SPF, DKIM, and DMARC verification.",
  },
  {
    title: "Shared team access",
    description:
      "Assign multiple team members to read operational mailboxes without sharing credentials.",
  },
  {
    title: "Security by default",
    description:
      "Server-side HTML sanitization, sandboxed message rendering, and strict CSP protection.",
  },
  {
    title: "Admin visibility",
    description:
      "Complete audit logs, quota tracking, and live service health checks from a single console.",
  },
] as const;

const SERVICE_TIERS = [
  {
    key: "personal",
    badge: "Individual & Executive",
    featured: false,
    title: "Personal Private Mailbox",
    summary:
      "A clean, private custom-domain mailbox for founders, consultants, and professionals who value direct control and zero ad tracking.",
    bullets: [
      "Custom domain address with full DNS verification",
      "Clean, distraction-free webmail reader",
      "Sanitized HTML rendering with remote tracker blocking",
      "Dedicated storage quota and attachment controls",
    ],
    ctaLabel: "Request personal mailbox",
    href: "/contact?service=personal",
    icon: KeyRound,
  },
  {
    key: "team",
    badge: "Most Requested",
    featured: true,
    title: "Team Mailbox Access",
    summary:
      "Shared operational inboxes for support, billing, sales, and project teams—with role-based access instead of shared passwords.",
    bullets: [
      "Granular per-user mailbox read permissions",
      "Fast search, unread filters, and attachment downloads",
      "Centralized user lifecycle and password management",
      "Complete audit log of administrative changes",
    ],
    ctaLabel: "Configure team access",
    href: "/contact?service=team",
    icon: Users,
  },
  {
    key: "business",
    badge: "Multi-Domain & Compliance",
    featured: false,
    title: "Business Mailbox Operations",
    summary:
      "Dedicated multi-domain mail operations for organizations requiring strict governance, isolated storage, and operational transparency.",
    bullets: [
      "Multi-domain provisioning with automated DKIM keys",
      "Live Postfix, Dovecot, OpenDKIM, and worker telemetry",
      "Quota enforcement and controlled mailbox purge workflows",
      "Priority onboarding and custom retention policies",
    ],
    ctaLabel: "Discuss business setup",
    href: "/contact?service=business",
    icon: Building2,
  },
] as const;

const CORE_FEATURES = [
  {
    title: "Centralized Mailbox Governance",
    description:
      "Create domains, generate DKIM selectors, provision mailboxes, set storage quotas, and assign user access from a single administrative interface.",
    icon: Globe,
  },
  {
    title: "Role-Based Webmail Reader",
    description:
      "Authorized users sign in to a fast, responsive webmail workspace where they can switch between assigned mailboxes, filter unread mail, and inspect headers.",
    icon: Mail,
  },
  {
    title: "Attachment & HTML Safety",
    description:
      "Untrusted HTML emails are sanitized server-side and isolated inside a sandboxed reader, while attachments are validated and served with safe download headers.",
    icon: ShieldCheck,
  },
  {
    title: "Audit Logging & Health Checks",
    description:
      "Every domain change, mailbox action, and permission grant is recorded in an immutable audit log alongside live mail stack readiness checks.",
    icon: Activity,
  },
] as const;

const ONBOARDING_STEPS = [
  {
    step: "1",
    title: "Review requirements",
    description:
      "Share your domain name, required mailbox addresses, and team size through our onboarding request form.",
  },
  {
    step: "2",
    title: "Provision & verify DNS",
    description:
      "We configure your domain, generate DKIM keys, and provide exact MX, SPF, DKIM, and DMARC records for verification.",
  },
  {
    step: "3",
    title: "Assign team access",
    description:
      "Your mailboxes go live with individual user accounts, role-based permissions, and ongoing operational monitoring.",
  },
] as const;

const SECURITY_PILLARS = [
  {
    title: "Authenticated Mail Delivery",
    description:
      "Automated DKIM key generation, strict SPF policies, and DMARC alignment checks protect your domain reputation.",
  },
  {
    title: "Hardened Web & Application Layer",
    description:
      "Strict Content Security Policy, CSRF protection, rate-limited authentication, and HSTS across every public endpoint.",
  },
  {
    title: "Operational Guardrails",
    description:
      "Filesystem path confinement, least-privilege service accounts, and explicit confirmation workflows for destructive actions.",
  },
] as const;

const USE_CASES = [
  {
    title: "Executive & Founder Mail",
    description:
      "Private custom-domain addresses with strict access control and zero advertising telemetry.",
    icon: Lock,
  },
  {
    title: "Customer Support Desks",
    description:
      "Shared support@ and help@ inboxes accessible to authorized agents with individual logins.",
    icon: Users,
  },
  {
    title: "Billing & Finance Operations",
    description:
      "Centralized invoices@, billing@, and vendor communications with clear read/unread tracking.",
    icon: FileCheck2,
  },
  {
    title: "Legal & Compliance Archives",
    description:
      "Audited access to legal@, notices@, and governance mailboxes across multiple corporate domains.",
    icon: Shield,
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
          "Private custom-domain mailbox hosting, shared team inbox access, and managed business email infrastructure.",
        ...(settings.supportEmail ? { email: settings.supportEmail } : {}),
        ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "sales and onboarding",
            url: `${baseUrl}/contact`,
            availableLanguage: ["en"],
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${baseUrl}/#service`,
        name: `${siteName} Managed Mailbox & Team Email Service`,
        provider: {
          "@id": `${baseUrl}/#organization`,
        },
        serviceType: "Private Mailbox Hosting and Business Email",
        areaServed: "Worldwide",
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
        {/* Compact Hero + Live Business Inbox Preview */}
        <section className="border-b border-border bg-gradient-to-b from-card to-background py-8 sm:py-11">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-7">
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-success"
                    aria-hidden="true"
                  />
                  <span>
                    Private Mailbox Infrastructure · Verified Custom Domains
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  Private mailboxes for individuals, teams, and growing
                  businesses.
                </h1>

                <p
                  data-site-tagline
                  className="mt-2.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm"
                >
                  {settings.siteTagline
                    ? `${settings.siteTagline} Provision custom-domain mailboxes, grant role-based team inbox access, and keep every message inside a hardened, auditable environment.`
                    : `Provision custom-domain mailboxes, grant role-based team inbox access, and keep every message inside a hardened, auditable environment managed by ${siteName}.`}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href="/contact"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-95"
                  >
                    <span>Request a mailbox</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href="#services"
                    className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Explore service tiers
                  </Link>
                  <Link
                    href="/sign-in"
                    className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span>Client login</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-2 border-t border-border pt-4 sm:grid-cols-3">
                  <div className="min-w-0 rounded-md border border-border bg-card/70 px-2.5 py-2">
                    <dt className="text-[10px] font-medium text-muted-foreground uppercase">
                      Authentication
                    </dt>
                    <dd className="mt-0.5 font-mono text-xs font-semibold text-foreground">
                      SPF · DKIM · DMARC
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-md border border-border bg-card/70 px-2.5 py-2">
                    <dt className="text-[10px] font-medium text-muted-foreground uppercase">
                      Access Model
                    </dt>
                    <dd className="mt-0.5 text-xs font-semibold text-foreground">
                      Role-Based Shared
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-md border border-border bg-card/70 px-2.5 py-2">
                    <dt className="text-[10px] font-medium text-muted-foreground uppercase">
                      Message Safety
                    </dt>
                    <dd className="mt-0.5 text-xs font-semibold text-foreground">
                      Sandboxed Reader
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Compact Business Inbox Preview Window */}
              <div
                aria-label={`${siteName} workspace preview`}
                className="min-w-0 lg:col-span-5"
              >
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-2">
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      <span className="h-2 w-2 rounded-full bg-destructive/70" />
                      <span className="h-2 w-2 rounded-full bg-warning/70" />
                      <span className="h-2 w-2 rounded-full bg-success/70" />
                      <span className="ml-1 text-[11px] font-semibold text-foreground">
                        {siteName} Business Inbox
                      </span>
                    </div>
                    <span className="rounded bg-success-bg px-1.5 py-0.5 font-mono text-[10px] font-medium text-success-foreground">
                      SPF · DKIM · DMARC Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-12 sm:divide-x sm:divide-y-0">
                    <div className="bg-muted/25 p-2.5 sm:col-span-5">
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Active Mailboxes
                      </p>
                      <ul className="mt-1.5 space-y-1 text-[11px]">
                        <li className="flex items-center justify-between gap-1 rounded bg-sidebar-active px-2 py-1 font-medium text-sidebar-active-foreground">
                          <span className="truncate font-mono">
                            support@{mailDomain}
                          </span>
                          <span className="shrink-0 rounded bg-primary px-1 text-[10px] text-primary-foreground">
                            4
                          </span>
                        </li>
                        <li className="flex items-center justify-between gap-1 rounded px-2 py-1 text-muted-foreground">
                          <span className="truncate font-mono">
                            billing@{mailDomain}
                          </span>
                          <span className="shrink-0 font-mono text-[10px]">
                            1
                          </span>
                        </li>
                        <li className="flex items-center justify-between gap-1 rounded px-2 py-1 text-muted-foreground">
                          <span className="truncate font-mono">
                            ops@{mailDomain}
                          </span>
                          <span className="shrink-0 font-mono text-[10px]">
                            0
                          </span>
                        </li>
                        <li className="flex items-center justify-between gap-1 rounded px-2 py-1 text-muted-foreground">
                          <span className="truncate font-mono">
                            legal@{mailDomain}
                          </span>
                          <span className="shrink-0 font-mono text-[10px]">
                            0
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-2.5 sm:col-span-7">
                      <div className="space-y-1.5">
                        <article className="rounded border border-primary/30 bg-sidebar-active/40 p-2">
                          <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              Enterprise Onboarding
                            </span>
                            <span className="font-mono">2m ago</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
                            Custom domain verification completed
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            MX, SPF, DKIM, and DMARC records are active for{" "}
                            {mailDomain}.
                          </p>
                        </article>

                        <article className="rounded border border-border bg-background p-2">
                          <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              Finance Team
                            </span>
                            <span className="font-mono">18m ago</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                            Q2 statement &amp; PDF invoice attached
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            Sanitized HTML view · 2 verified attachments ready.
                          </p>
                        </article>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
                        <span>Sanitized HTML · Remote images blocked</span>
                        <span className="font-mono font-medium text-success">
                          Audit log active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Compact 4-Pillar Trust Strip */}
        <section
          aria-label="Operational highlights"
          className="border-b border-border bg-card py-4"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-md border border-border bg-background/60 p-3"
                >
                  <p className="text-xs font-semibold text-foreground">
                    {pillar.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services Section (#services) */}
        <section id="services" className="scroll-mt-14 py-8 sm:py-10">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                Services
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Mailbox configurations tailored to how you work
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Whether you need a private address for yourself, a shared
                support inbox for your team, or managed multi-domain email for
                your organization, {siteName} scales cleanly.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {SERVICE_TIERS.map((tier) => {
                const TierIcon = tier.icon;
                return (
                  <article
                    key={tier.key}
                    className={`flex flex-col justify-between rounded-lg border p-4 transition-shadow ${
                      tier.featured
                        ? "border-primary bg-card shadow-xs"
                        : "border-border bg-card"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                            tier.featured
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {tier.badge}
                        </span>
                        <TierIcon
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>

                      <h3 className="mt-2.5 text-sm font-bold text-foreground sm:text-base">
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
                            <CheckCircle2
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                              aria-hidden="true"
                            />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 pt-2">
                      <Link
                        href={tier.href}
                        className={`inline-flex h-8 w-full items-center justify-center gap-1 rounded-md px-3 text-xs font-semibold transition-colors ${
                          tier.featured
                            ? "bg-primary text-primary-foreground hover:opacity-95"
                            : "border border-border bg-background text-foreground hover:bg-muted"
                        }`}
                      >
                        <span>{tier.ctaLabel}</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Section (#features) */}
        <section
          id="features"
          className="scroll-mt-14 border-y border-border bg-card py-8 sm:py-10"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                Platform Capabilities
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Focused features without enterprise bloat
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Every component in {siteName} is designed for clarity,
                predictability, and low operational overhead.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {CORE_FEATURES.map((feature) => {
                const FeatureIcon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                        <FeatureIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <h3 className="text-xs font-bold text-foreground sm:text-sm">
                        {feature.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3-Step Onboarding Workflow */}
        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                How Onboarding Works
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                From domain setup to active team inbox in three steps
              </h2>
            </div>

            <ol className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {ONBOARDING_STEPS.map((item) => (
                <li
                  key={item.step}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                      {item.step}
                    </span>
                    <h3 className="text-xs font-bold text-foreground sm:text-sm">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Security by Design (#security) */}
        <section
          id="security"
          className="scroll-mt-14 border-y border-border bg-card py-8 sm:py-10"
        >
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                  Security by Design
                </p>
                <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Hardened from the SMTP edge to the browser reader
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Email is one of the primary entry points for organizational
                  risk. {siteName} enforces defensive controls at every layer of
                  delivery, storage, and message viewing.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground">
                    Strict CSP
                  </span>
                  <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground">
                    Sandboxed Iframe
                  </span>
                  <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground">
                    Path Confinement
                  </span>
                  <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground">
                    PostgreSQL Audit Trail
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:col-span-7">
                {SECURITY_PILLARS.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-border bg-background p-3.5"
                  >
                    <h3 className="text-xs font-bold text-foreground sm:text-sm">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                Use Cases
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Built for operational clarity across teams
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((useCase) => {
                const UseCaseIcon = useCase.icon;
                return (
                  <article
                    key={useCase.title}
                    className="rounded-lg border border-border bg-card p-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <UseCaseIcon
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <h3 className="text-xs font-bold text-foreground">
                        {useCase.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {useCase.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Section (#faq) */}
        <section
          id="faq"
          className="scroll-mt-14 border-t border-border bg-card/50 py-8 sm:py-10"
        >
          <div className="mx-auto max-w-4xl px-3 sm:px-5">
            <div className="mb-4">
              <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                FAQ
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Common questions about {siteName}
              </h2>
            </div>

            <PublicFaqAccordion items={PUBLIC_FAQ_ITEMS} />
          </div>
        </section>

        {/* Compact Bottom CTA Banner */}
        <section className="border-t border-border bg-card py-7 sm:py-9">
          <div className="mx-auto max-w-6xl px-3 sm:px-5">
            <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                  Get Started
                </p>
                <h2 className="mt-0.5 text-base font-bold text-foreground sm:text-lg">
                  Ready to set up your private or team mailboxes?
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tell us about your domain or mailbox requirements and our team
                  will prepare a tailored onboarding plan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/contact"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-95"
                >
                  <span>Request a mailbox</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Client login
                </Link>
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
