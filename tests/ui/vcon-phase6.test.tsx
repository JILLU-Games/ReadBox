import { SettingsConsole } from "@/components/vcon/settings-console";
import { SystemUpdateConsole } from "@/components/vcon/system-update-console";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Phase 6 /vcon/settings and /vcon/system-update UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders SettingsConsole sections and submits updated site branding", async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn(async (formData: FormData) => ({
      ok: true,
      message: "Settings saved successfully.",
      settings: {
        siteName: String(formData.get("site_name") ?? "ReadBox"),
        siteTagline: String(formData.get("site_tagline") ?? ""),
        logoPath: "site-settings/logo-1234.svg",
        faviconPath: "",
        logoUrl: "/api/media/site-settings/logo-1234.svg",
        faviconUrl: "",
        supportEmail: "ops@readbox.local",
        contactPhone: "+1 555 0100",
        officeAddress: "Suite 200",
        footerDescription: "Internal team workspace",
        copyrightText: "Authorized use only",
        sourceCodeUrl: "https://github.com/vibtools/MailStack",
        privacyUrl: "/privacy/",
        updatedAtIso: "2026-11-15T12:00:00.000Z",
        databaseConnected: true,
      },
    }));

    render(
      <SettingsConsole
        initialSettings={{
          siteName: "MailStack",
          siteTagline: "Self-hosted mail server and shared team inbox.",
          logoPath: "",
          faviconPath: "",
          logoUrl: "",
          faviconUrl: "",
          supportEmail: "",
          contactPhone: "",
          officeAddress: "",
          footerDescription: "",
          copyrightText: "Authorized team use only.",
          sourceCodeUrl: "https://github.com/vibtools/MailStack",
          privacyUrl: "/privacy/",
          updatedAtIso: "2026-11-15T10:00:00.000Z",
          databaseConnected: true,
        }}
        publicSiteOrigin="https://mailstack.example"
        mediaRoot="/var/lib/readbox/media"
        onSaveSettings={onSaveSettings}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Site Settings" }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Site Name");
    await user.clear(nameInput);
    await user.type(nameInput, "ReadBox Cloud");

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(onSaveSettings).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText("Settings saved successfully."),
    ).toBeInTheDocument();
  });

  it("renders SystemUpdateConsole preflight checklist, checks release metadata, and requires double confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/vcon/update/check")) {
        return new Response(
          JSON.stringify({
            ok: true,
            latest_version: "1.4.0",
            release_notes: "Security and PostgreSQL improvements",
            archive_url:
              "https://github.com/vibtools/MailStack/releases/download/v1.4.0/mailstack-1.4.0-source.zip",
            checksum_url:
              "https://github.com/vibtools/MailStack/releases/download/v1.4.0/mailstack-1.4.0-source.zip.sha256",
            published_at: "2026-11-15T00:00:00Z",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/vcon/update/preflight")) {
        return new Response(
          JSON.stringify({
            status: "ready",
            checks: [
              {
                name: "runtime directory",
                passed: true,
                detail: "/run/vibmail",
              },
              {
                name: "updater worker active",
                passed: true,
                detail: "vibmail-updater.service",
              },
            ],
            message: "Updater is ready.",
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ status: "started" }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SystemUpdateConsole
        currentVersion="1.3.5.5"
        githubRepo="vibtools/MailStack"
        runtimeDir="/run/vibmail"
        initialPreflight={{
          status: "ready",
          checks: [
            {
              name: "runtime directory",
              passed: true,
              detail: "/run/vibmail",
            },
          ],
          message: "Updater is ready.",
        }}
        initialStatus={{
          step: "idle",
          message: "No update in progress",
          progress: 0,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "System Update" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1.3.5.5")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Check for Updates/i }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: /Confirm System Update/i,
    });
    expect(dialog).toBeInTheDocument();

    const confirmBtn = dialog.querySelector("#btn-update-confirm");
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn).toBeDisabled();

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    expect(confirmBtn).not.toBeDisabled();
  });
});
