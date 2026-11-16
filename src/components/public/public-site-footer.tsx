import { Icon } from "@/components/ui";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
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
    "Self-service custom-domain mailboxes, policy-governed workspaces, automated message retention, and auditable business mail operations.";
  const resolvedCopyright =
    copyrightText?.trim() || "Managed private email infrastructure.";
  const resolvedPrivacyHref = privacyUrl?.trim() || "/privacy";

  return (
    <footer className="border-t border-border bg-card text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-5">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-foreground"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-none border border-border bg-primary text-[11px] font-medium text-primary-foreground"
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt=""
                    width={24}
                    height={24}
                    referrerPolicy="no-referrer"
                    className="size-full object-contain"
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
            <h2 className="text-xs font-medium text-foreground">Workspace</h2>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link
                  href="/sign-up"
                  className="font-medium text-foreground hover:text-primary"
                >
                  Create account (Sign up)
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-foreground">
                  User sign in
                </Link>
              </li>
              <li>
                <Link href="/users" className="hover:text-foreground">
                  Webmail inbox
                </Link>
              </li>
              <li>
                <Link href="/users/mailboxes" className="hover:text-foreground">
                  Mailbox provisioning
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-medium text-foreground">Platform</h2>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/#capabilities" className="hover:text-foreground">
                  Core capabilities
                </Link>
              </li>
              <li>
                <Link href="/#workspaces" className="hover:text-foreground">
                  Access &amp; quota tiers
                </Link>
              </li>
              <li>
                <Link href="/#security" className="hover:text-foreground">
                  Security architecture
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-foreground">
                  Common questions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-medium text-foreground">
              Support &amp; Governance
            </h2>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
                >
                  <span>Contact &amp; support</span>
                  <Icon glyph={ArrowUpRight} className="size-3" />
                </Link>
              </li>
              <li>
                <Link href="/vcon/login" className="hover:text-foreground">
                  Admin console login
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
                    <Icon glyph={ArrowUpRight} className="size-3" />
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
            SPF · DKIM · DMARC · TLS · Policy-Governed Workspaces
          </p>
        </div>
      </div>
    </footer>
  );
}
