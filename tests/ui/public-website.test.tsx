import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContactInquiryForm } from "../../src/components/public/contact-inquiry-form";
import { PublicFaqAccordion } from "../../src/components/public/public-faq-accordion";
import { PublicSiteFooter } from "../../src/components/public/public-site-footer";
import { PublicSiteHeader } from "../../src/components/public/public-site-header";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

describe("Public Website UI Components", () => {
  it("renders PublicSiteHeader with brand, navigation links, and Client login / Request a mailbox CTAs", () => {
    const { container } = render(
      <PublicSiteHeader
        siteName="MailStack"
        logoUrl="/api/media/branding/logo.png"
        activePage="home"
      />,
    );

    expect(screen.getByText("MailStack")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Client login/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(
      screen.getByRole("link", { name: /Request a mailbox/i }),
    ).toHaveAttribute("href", "/contact");
    const logoImg = container.querySelector("img");
    expect(logoImg).not.toBeNull();
    expect(logoImg).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("renders PublicSiteFooter with dynamic support email, privacy policy, and copyright", () => {
    render(
      <PublicSiteFooter
        siteName="MailStack"
        supportEmail="ops@mailstack.io"
        footerDescription="Hardened custom-domain email operations."
        copyrightText="All rights reserved."
        privacyUrl="/privacy"
      />,
    );

    expect(
      screen.getByText("Hardened custom-domain email operations."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ops@mailstack.io" }),
    ).toHaveAttribute("href", "mailto:ops@mailstack.io");
    expect(
      screen.getByRole("link", { name: /Privacy policy/i }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("toggles FAQ items in PublicFaqAccordion", async () => {
    const user = userEvent.setup();
    render(<PublicFaqAccordion />);

    const secondQuestion = screen.getByRole("button", {
      name: /Can multiple team members read the same mailbox\?/i,
    });
    expect(secondQuestion).toHaveAttribute("aria-expanded", "false");

    await user.click(secondQuestion);
    expect(secondQuestion).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/grant specific users read access to shared mailboxes/i),
    ).toBeInTheDocument();
  });

  it("renders ContactInquiryForm with preselected service, live character counter, and validation AlertBanner", async () => {
    const user = userEvent.setup();
    render(
      <ContactInquiryForm
        siteName="MailStack"
        initialServiceType="team"
        privacyUrl="/privacy"
      />,
    );

    const serviceSelect = screen.getByLabelText(
      /Mailbox requirement/i,
    ) as HTMLSelectElement;
    expect(serviceSelect.value).toBe("team");

    const messageInput = screen.getByLabelText(/Project or mailbox details/i);
    await user.type(messageInput, "Shared support mailbox setup");
    expect(screen.getByText("28")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Send inquiry/i }));
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent(
      "Please complete all required fields before submitting.",
    );
  });
});
