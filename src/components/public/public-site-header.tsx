"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ArrowUpRight, Lock, Mail, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export interface PublicSiteHeaderProps {
  readonly siteName: string;
  readonly logoUrl?: string;
  readonly activePage?: "home" | "contact" | "privacy";
}

export function PublicSiteHeader({
  siteName,
  logoUrl,
  activePage = "home",
}: PublicSiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      label: "Services",
      href: activePage === "home" ? "#services" : "/#services",
      active: false,
    },
    {
      label: "Features",
      href: activePage === "home" ? "#features" : "/#features",
      active: false,
    },
    {
      label: "Security",
      href: activePage === "home" ? "#security" : "/#security",
      active: false,
    },
    {
      label: "FAQ",
      href: activePage === "home" ? "#faq" : "/#faq",
      active: false,
    },
    {
      label: "Contact",
      href: "/contact",
      active: activePage === "contact",
    },
    {
      label: "Privacy",
      href: "/privacy",
      active: activePage === "privacy",
    },
  ];

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header
        data-header
        className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
      >
        <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-2 px-3 sm:px-5">
          <Link
            href="/"
            aria-label={`${siteName} home`}
            className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-xs font-bold text-primary-foreground shadow-xs"
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
            <span className="truncate font-semibold">{siteName}</span>
            <span className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              Private Mail
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 md:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  item.active
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />

            <Link
              href="/sign-in"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span>Client login</span>
            </Link>

            <Link
              href="/contact"
              className="hidden h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-95 sm:inline-flex"
            >
              <Mail className="h-3 w-3" aria-hidden="true" />
              <span>Request a mailbox</span>
            </Link>

            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-nav"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted md:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <nav
            id="public-mobile-nav"
            aria-label="Mobile navigation"
            className="border-t border-border bg-card px-3 py-2.5 md:hidden"
          >
            <div className="grid grid-cols-2 gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    item.active
                      ? "bg-secondary text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                <Mail className="h-3 w-3" aria-hidden="true" />
                <span>Request a mailbox</span>
              </Link>
              <Link
                href="/users"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground"
              >
                <span>Webmail</span>
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </nav>
        ) : null}
      </header>
    </>
  );
}
