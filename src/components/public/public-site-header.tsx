"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandLogo, Button, Icon, NavLink } from "@/components/ui";
import { LogIn, Menu, UserPlus, X } from "lucide-react";
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
      label: "Capabilities",
      href: activePage === "home" ? "#capabilities" : "/#capabilities",
      active: false,
    },
    {
      label: "Workspaces",
      href: activePage === "home" ? "#workspaces" : "/#workspaces",
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
  ];

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-none focus:bg-primary focus:px-3 focus:py-1.5 focus:text-xs focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header
        data-header
        className="sticky top-0 z-40 border-b border-border bg-card"
      >
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-3 sm:px-5">
          <Link
            href="/"
            aria-label={`${siteName} home`}
            className="flex min-w-0 shrink-0 items-center whitespace-nowrap"
          >
            <BrandLogo siteName={siteName} logoUrl={logoUrl} size="md" />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 md:flex"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                href={item.href}
                variant="header"
                active={item.active}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />

            <Button variant="outline" size="default" asChild>
              <Link href="/sign-in" className="whitespace-nowrap">
                <Icon glyph={LogIn} className="size-3 text-muted-foreground" />
                <span>Sign in</span>
              </Link>
            </Button>

            <Button size="default" asChild>
              <Link href="/sign-up" className="whitespace-nowrap">
                <Icon glyph={UserPlus} className="size-3" />
                <span>Sign up</span>
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-nav"
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden"
            >
              <Icon glyph={mobileMenuOpen ? X : Menu} className="size-4" />
            </Button>
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
                <NavLink
                  key={item.label}
                  href={item.href}
                  variant="sidebarSub"
                  active={item.active}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                href="/privacy"
                variant="sidebarSub"
                active={activePage === "privacy"}
                onClick={() => setMobileMenuOpen(false)}
              >
                Privacy
              </NavLink>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
              <Button size="default" asChild className="flex-1">
                <Link
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon glyph={UserPlus} className="size-3" />
                  <span>Sign up</span>
                </Link>
              </Button>
              <Button variant="outline" size="default" asChild className="flex-1">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon glyph={LogIn} className="size-3" />
                  <span>Sign in</span>
                </Link>
              </Button>
            </div>
          </nav>
        ) : null}
      </header>
    </>
  );
}
