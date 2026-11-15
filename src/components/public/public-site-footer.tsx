import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export interface PublicSiteFooterProps {
  readonly siteName: string;
  readonly logoUrl?: string;
  readonly footerDescription?: string;
  readonly copyrightText?: string;
  readonly privacyUrl?: string;
  readonly sourceCodeUrl?: string;
  readonly supportEmail?: string;
}

export function PublicSiteFooter({
  siteName,
  logoUrl,
  footerDescription,
  copyrightText,
  privacyUrl,
  sourceCodeUrl,
  supportEmail,
}: PublicSiteFooterProps) {
  const year = new Date().getFullYear();
  const resolvedDescription =
    footerDescription?.trim() ||
    "Managed private mailbox hosting, shared team inbox access, and auditable business mail operations.";
  const resolvedCopyright =
    copyrightText?.trim() || "Managed private email infrastructure.";
  const resolvedPrivacyHref = privacyUrl?.trim() || "/privacy";

  return (
    <footer className="border-t border-border bg-card text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl px-3 py-8 sm:px-5">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-primary text-[11px] font-bold text-primary-foreground"
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  siteName.slice(0, 1).toUpperCase() || "M"
                )}
              </span>
              <span>{siteName}</span>
            </Link>
            <p
              data-footer-description
              className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground"
            >
              {resolvedDescription}
            </p>
            {supportEmail ? (
              <p className="mt-2 text-xs">
                Support:{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  data-support-email
                  className="font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                >
                  {supportEmail}
                </a>
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Services
            </h2>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link
                  href="/contact?service=personal"
                  className="hover:text-foreground"
                >
                  Personal Mailbox
                </Link>
              </li>
              <li>
                <Link
                  href="/contact?service=team"
                  className="hover:text-foreground"
                >
                  Team Mailboxes
                </Link>
              </li>
              <li>
                <Link
                  href="/contact?service=business"
                  className="hover:text-foreground"
                >
                  Business Operations
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Platform
            </h2>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/#features" className="hover:text-foreground">
                  Platform features
                </Link>
              </li>
              <li>
                <Link href="/#security" className="hover:text-foreground">
                  Security posture
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-foreground">
                  Common questions
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Request a mailbox
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Resources
            </h2>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
                >
                  <span>Client portal</span>
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/users" className="hover:text-foreground">
                  Webmail workspace
                </Link>
              </li>
              <li>
                <Link
                  href={resolvedPrivacyHref}
                  data-privacy-url
                  className="hover:text-foreground"
                >
                  Privacy policy
                </Link>
              </li>
              {sourceCodeUrl ? (
                <li>
                  <a
                    href={sourceCodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-source-code-url
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <span>Source code</span>
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © <span data-year>{year}</span> {siteName}.{" "}
            <span data-footer-copyright>{resolvedCopyright}</span>
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            SPF · DKIM · DMARC · TLS · Audited Access
          </p>
        </div>
      </div>
    </footer>
  );
}
