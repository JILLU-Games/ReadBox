import { BrandLogo, CaptionText, Icon, SectionTitle } from "@/components/ui";
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

function normalizeSafeHref(raw?: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
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
    "Self-service custom-domain mailboxes, shared team inboxes, and private webmail workspaces.";
  const resolvedCopyright =
    copyrightText?.trim() || "All rights reserved.";
  const resolvedPrivacyHref = privacyUrl?.trim() || "/privacy";
  const resolvedSourceCodeHref = normalizeSafeHref(sourceCodeUrl);

  return (
    <footer className="border-t border-border bg-card text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-5">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center">
              <BrandLogo siteName={siteName} logoUrl={logoUrl} size="sm" />
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
            <SectionTitle>Workspace</SectionTitle>
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
                  My mailboxes
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <SectionTitle>Features</SectionTitle>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/#capabilities" className="hover:text-foreground">
                  Core capabilities
                </Link>
              </li>
              <li>
                <Link href="/#workspaces" className="hover:text-foreground">
                  Workspace plans
                </Link>
              </li>
              <li>
                <Link href="/#security" className="hover:text-foreground">
                  Privacy &amp; security
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
            <SectionTitle>Support &amp; Legal</SectionTitle>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/about" className="hover:text-foreground">
                  About
                </Link>
              </li>
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
                <Link
                  href={resolvedPrivacyHref}
                  data-privacy-url
                  className="hover:text-foreground"
                >
                  Privacy policy
                </Link>
              </li>
              {resolvedSourceCodeHref ? (
                <li>
                  <a
                    href={resolvedSourceCodeHref}
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

        <div className="mt-6 flex flex-col justify-between gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
          <CaptionText>
            © <span data-year>{year}</span> {siteName}.{" "}
            <span data-footer-copyright>{resolvedCopyright}</span>
          </CaptionText>
        </div>
      </div>
    </footer>
  );
}
