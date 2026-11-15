"use client";

import type {
  SaveSiteSettingsActionResult,
  SerializedSiteSettings,
} from "@/app/(workspace)/vcon/settings/actions";
import { Check, ExternalLink, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export interface SettingsConsoleProps {
  readonly initialSettings: SerializedSiteSettings;
  readonly publicSiteOrigin: string;
  readonly mediaRoot: string;
  readonly onSaveSettings: (
    formData: FormData,
  ) => Promise<SaveSiteSettingsActionResult>;
}

export function SettingsConsole({
  initialSettings,
  publicSiteOrigin,
  mediaRoot,
  onSaveSettings,
}: SettingsConsoleProps) {
  const [settings, setSettings] =
    useState<SerializedSiteSettings>(initialSettings);
  const [siteName, setSiteName] = useState(initialSettings.siteName);
  const [siteTagline, setSiteTagline] = useState(initialSettings.siteTagline);
  const [supportEmail, setSupportEmail] = useState(
    initialSettings.supportEmail,
  );
  const [contactPhone, setContactPhone] = useState(
    initialSettings.contactPhone,
  );
  const [officeAddress, setOfficeAddress] = useState(
    initialSettings.officeAddress,
  );
  const [footerDescription, setFooterDescription] = useState(
    initialSettings.footerDescription,
  );
  const [copyrightText, setCopyrightText] = useState(
    initialSettings.copyrightText,
  );
  const [sourceCodeUrl, setSourceCodeUrl] = useState(
    initialSettings.sourceCodeUrl,
  );
  const [privacyUrl, setPrivacyUrl] = useState(initialSettings.privacyUrl);
  const [clearLogo, setClearLogo] = useState(false);
  const [clearFavicon, setClearFavicon] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Readonly<Record<string, string>>
  >({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    formData.set("clear_logo", clearLogo ? "true" : "false");
    formData.set("clear_favicon", clearFavicon ? "true" : "false");

    setErrorBanner(null);
    setSuccessBanner(null);
    setFieldErrors({});

    startTransition(async () => {
      const response = await onSaveSettings(formData);
      if (!response.ok) {
        setErrorBanner(
          response.error ?? "Please correct the highlighted fields.",
        );
        setFieldErrors(response.fieldErrors ?? {});
        toast.error(response.error ?? "Failed to save site settings.");
        return;
      }

      if (response.settings) {
        setSettings(response.settings);
        setSiteName(response.settings.siteName);
        setSiteTagline(response.settings.siteTagline);
        setSupportEmail(response.settings.supportEmail);
        setContactPhone(response.settings.contactPhone);
        setOfficeAddress(response.settings.officeAddress);
        setFooterDescription(response.settings.footerDescription);
        setCopyrightText(response.settings.copyrightText);
        setSourceCodeUrl(response.settings.sourceCodeUrl);
        setPrivacyUrl(response.settings.privacyUrl);
      }
      setClearLogo(false);
      setClearFavicon(false);
      const logoInput = formElement.elements.namedItem(
        "logo",
      ) as HTMLInputElement | null;
      if (logoInput) logoInput.value = "";
      const faviconInput = formElement.elements.namedItem(
        "favicon",
      ) as HTMLInputElement | null;
      if (faviconInput) faviconInput.value = "";

      setSuccessBanner(response.message ?? "Settings saved successfully.");
      toast.success(response.message ?? "Settings saved successfully.");
    });
  }

  return (
    <section
      className="space-y-6"
      aria-labelledby="site-settings-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            System Configuration
          </p>
          <h1
            id="site-settings-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Site Settings
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure singleton application branding, support contact details,
            and public site metadata.
          </p>
        </div>
        <button
          type="submit"
          form="site-settings-form"
          disabled={isPending}
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {isPending ? (
            <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-3.5" aria-hidden="true" />
          )}
          <span>{isPending ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      {errorBanner ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive"
        >
          {errorBanner}
        </div>
      ) : null}

      {successBanner ? (
        <div
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-300"
        >
          {successBanner}
        </div>
      ) : null}

      <form
        id="site-settings-form"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="space-y-6"
      >
        {/* Brand Fieldset */}
        <fieldset className="rounded-md border border-border bg-card p-5">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Brand
          </legend>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="id_site_name"
                className="block text-xs font-medium text-foreground"
              >
                Site Name
              </label>
              <input
                id="id_site_name"
                name="site_name"
                type="text"
                required
                maxLength={120}
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              {fieldErrors.siteName ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.siteName}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="id_site_tagline"
                className="block text-xs font-medium text-foreground"
              >
                Site Tagline
              </label>
              <input
                id="id_site_tagline"
                name="site_tagline"
                type="text"
                maxLength={200}
                value={siteTagline}
                onChange={(e) => setSiteTagline(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              {fieldErrors.siteTagline ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.siteTagline}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* Site Logo */}
            <div className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="id_logo"
                  className="text-xs font-medium text-foreground"
                >
                  Site Logo
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Max 5 MB · GIF, JPEG, PNG, SVG, WEBP
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {settings.logoUrl && !clearLogo ? (
                  <img
                    src={settings.logoUrl}
                    alt="Current site logo"
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 shrink-0 rounded border border-border object-contain p-1"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted font-mono text-[11px] font-medium text-muted-foreground">
                    SVG
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <input
                    id="id_logo"
                    name="logo"
                    type="file"
                    accept="image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    aria-label="Site Logo"
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
                  />
                </div>
              </div>
              {settings.logoPath ? (
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate font-mono text-[11px]">
                    {settings.logoPath}
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={clearLogo}
                      onChange={(e) => setClearLogo(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>Clear logo</span>
                  </label>
                </div>
              ) : null}
              {fieldErrors.logo ? (
                <p className="mt-1.5 text-xs text-destructive">
                  {fieldErrors.logo}
                </p>
              ) : null}
            </div>

            {/* Favicon */}
            <div className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="id_favicon"
                  className="text-xs font-medium text-foreground"
                >
                  Favicon
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Max 512 KB · GIF, ICO, PNG, SVG, WEBP
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {settings.faviconUrl && !clearFavicon ? (
                  <img
                    src={settings.faviconUrl}
                    alt="Current site favicon"
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 shrink-0 rounded border border-border object-contain p-1.5"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted font-mono text-[11px] font-medium text-muted-foreground">
                    ICO
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <input
                    id="id_favicon"
                    name="favicon"
                    type="file"
                    accept="image/gif,image/x-icon,image/png,image/svg+xml,image/webp"
                    aria-label="Favicon"
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
                  />
                </div>
              </div>
              {settings.faviconPath ? (
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate font-mono text-[11px]">
                    {settings.faviconPath}
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={clearFavicon}
                      onChange={(e) => setClearFavicon(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>Clear favicon</span>
                  </label>
                </div>
              ) : null}
              {fieldErrors.favicon ? (
                <p className="mt-1.5 text-xs text-destructive">
                  {fieldErrors.favicon}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>

        {/* Contact Details Fieldset */}
        <fieldset className="rounded-md border border-border bg-card p-5">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Contact Details
          </legend>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="id_support_email"
                className="block text-xs font-medium text-foreground"
              >
                Support Email
              </label>
              <input
                id="id_support_email"
                name="support_email"
                type="email"
                maxLength={254}
                placeholder="support@example.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              {fieldErrors.supportEmail ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.supportEmail}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="id_contact_phone"
                className="block text-xs font-medium text-foreground"
              >
                Contact Phone
              </label>
              <input
                id="id_contact_phone"
                name="contact_phone"
                type="text"
                maxLength={40}
                placeholder="+1 (555) 010-2000"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              {fieldErrors.contactPhone ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.contactPhone}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="id_office_address"
              className="block text-xs font-medium text-foreground"
            >
              Office Address
            </label>
            <input
              id="id_office_address"
              name="office_address"
              type="text"
              maxLength={255}
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            {fieldErrors.officeAddress ? (
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.officeAddress}
              </p>
            ) : null}
          </div>
        </fieldset>

        {/* Footer Fieldset */}
        <fieldset className="rounded-md border border-border bg-card p-5">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Footer
          </legend>
          <div className="mt-2">
            <label
              htmlFor="id_footer_description"
              className="block text-xs font-medium text-foreground"
            >
              Public Footer description
            </label>
            <textarea
              id="id_footer_description"
              name="footer_description"
              rows={2}
              value={footerDescription}
              onChange={(e) => setFooterDescription(e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            {fieldErrors.footerDescription ? (
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.footerDescription}
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <label
              htmlFor="id_copyright_text"
              className="block text-xs font-medium text-foreground"
            >
              Copyright Text
            </label>
            <input
              id="id_copyright_text"
              name="copyright_text"
              type="text"
              maxLength={255}
              value={copyrightText}
              onChange={(e) => setCopyrightText(e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            {fieldErrors.copyrightText ? (
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.copyrightText}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="id_source_code_url"
                className="block text-xs font-medium text-foreground"
              >
                Source Code URL
              </label>
              <input
                id="id_source_code_url"
                name="source_code_url"
                type="url"
                maxLength={200}
                value={sourceCodeUrl}
                onChange={(e) => setSourceCodeUrl(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              {fieldErrors.sourceCodeUrl ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.sourceCodeUrl}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="id_privacy_url"
                className="block text-xs font-medium text-foreground"
              >
                Privacy / Terms URL
              </label>
              <input
                id="id_privacy_url"
                name="privacy_url"
                type="text"
                maxLength={500}
                placeholder="/privacy/"
                value={privacyUrl}
                onChange={(e) => setPrivacyUrl(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              {fieldErrors.privacyUrl ? (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.privacyUrl}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>
      </form>

      {/* Public Branding API & Confinement Diagnostics */}
      <div className="rounded-md border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Public Branding Feed & Storage Confinement
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Read-only branding JSON endpoint with strict origin validation and
              confined asset delivery.
            </p>
          </div>
          <a
            href="/api/site-settings"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted whitespace-nowrap shrink-0"
          >
            <span>Inspect /api/site-settings</span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <div className="rounded border border-border bg-background p-3">
            <span className="block text-[11px] text-muted-foreground">
              Confined Media Root
            </span>
            <strong className="mt-1 block truncate font-mono text-foreground">
              {mediaRoot}
            </strong>
          </div>
          <div className="rounded border border-border bg-background p-3">
            <span className="block text-[11px] text-muted-foreground">
              Allowed CORS Origin (PUBLIC_SITE_ORIGIN)
            </span>
            <strong className="mt-1 block truncate font-mono text-foreground">
              {publicSiteOrigin || "Same-origin only (not set)"}
            </strong>
          </div>
          <div className="rounded border border-border bg-background p-3">
            <span className="block text-[11px] text-muted-foreground">
              Last Updated
            </span>
            <strong className="mt-1 block font-mono tabular-nums text-foreground">
              {new Date(settings.updatedAtIso).toUTCString()}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
