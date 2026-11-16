import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    cleanup();
  });

  it("renders PublicSiteHeader with brand, navigation links, and Sign in / Sign up CTAs without Request a mailbox", () => {
    const { container } = render(
      <PublicSiteHeader
        siteName="ReadBox"
        logoUrl="/api/media/branding/logo.png"
        activePage="home"
      />,
    );

    expect(screen.getByText("ReadBox")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.getByRole("link", { name: /Sign up/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(
      screen.queryByRole("link", { name: /Request a mailbox/i }),
    ).toBeNull();
    const logoImg = container.querySelector("img");
    expect(logoImg).not.toBeNull();
    expect(logoImg).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("renders PublicSiteFooter with Sign up, Sign in, dynamic support email, privacy policy, and copyright", () => {
    render(
      <PublicSiteFooter
        siteName="ReadBox"
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
      screen.getByRole("link", { name: /Create account \(Sign up\)/i }),
    ).toHaveAttribute("href", "/sign-up");
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

  it("renders ContactInquiryForm with preselected topic, quick selector, live character counter, and validation AlertBanner", async () => {
    const user = userEvent.setup();
    render(
      <ContactInquiryForm
        siteName="ReadBox"
        initialServiceType="team"
        privacyUrl="/privacy"
      />,
    );

    const serviceSelect = screen.getByLabelText(
      /Inquiry topic/i,
    ) as HTMLSelectElement;
    expect(serviceSelect.value).toBe("team");

    await user.click(screen.getByRole("button", { name: /Custom Domain/i }));
    expect(serviceSelect.value).toBe("business");

    const messageInput = screen.getByLabelText(
      /Message or technical details/i,
    );
    await user.type(messageInput, "Shared support mailbox setup");
    expect(screen.getByText("28")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Send inquiry/i }));
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent(
      "Please complete all required fields before submitting.",
    );
  });

  it("sends X-ReadBox-CSRF header and retries once automatically after a 403 token expiration", async () => {
    const user = userEvent.setup();
    let csrfCalls = 0;
    let postCalls = 0;
    const sentHeaders: Array<string | null> = [];

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/contact/csrf") {
          csrfCalls += 1;
          return new Response(JSON.stringify({ token: `tok-${csrfCalls}` }), {
            status: 200,
          });
        }
        if (url === "/api/contact") {
          postCalls += 1;
          const headers = new Headers(init?.headers);
          sentHeaders.push(headers.get("X-ReadBox-CSRF"));
          if (postCalls === 1) {
            return new Response(
              JSON.stringify({ message: "CSRF expired" }),
              { status: 403 },
            );
          }
          return new Response(
            JSON.stringify({ request_id: "req-1234567890" }),
            { status: 201 },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<ContactInquiryForm siteName="ReadBox" privacyUrl="/privacy" />);

      await user.type(screen.getByLabelText(/Full name/i), "Alex Morgan");
      await user.type(screen.getByLabelText(/Email address/i), "alex@company.com");
      await user.type(
        screen.getByLabelText(/Message or technical details/i),
        "Need help configuring MX and DKIM records for our team.",
      );
      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: /Send inquiry/i }));

      const banner = await screen.findByRole("status");
      expect(banner).toHaveTextContent("Thank you. Your inquiry has been received");
      expect(postCalls).toBe(2);
      expect(sentHeaders).toEqual(["tok-1", "tok-2"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
