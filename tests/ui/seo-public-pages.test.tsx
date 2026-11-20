import { PublicFaqAccordion } from "@/components/public/public-faq-accordion";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { getPublicBrandPresentation } from "@/core/seo/brand";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("SEO-02 public UI regression", () => {
  it("adds only the About navigation entry; retains contact, privacy, and existing footer", () => {
    render(<PublicSiteFooter
      siteName="AnyInbox"
      footerDescription="Manage incoming email."
      privacyUrl="/privacy"
    />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /Contact/ })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: /Privacy policy/i })).toHaveAttribute("href", "/privacy");
    expect(screen.getByText("Manage incoming email.")).toBeInTheDocument();
  });

  it("renders the same AnyInbox FAQ data that structured JSON-LD consumes", () => {
    const brand = getPublicBrandPresentation("Any Inbox", "https://anyinbox.cc");
    render(<PublicFaqAccordion items={brand.faqItems} />);
    expect(screen.getByText("What is AnyInbox used for?")).toBeInTheDocument();
    expect(screen.getByText(/AnyInbox helps you manage custom-domain mailboxes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Can AnyInbox send outbound email/ }));
    expect(screen.getByText(/SMTP submission/)).toBeInTheDocument();
  });
});
