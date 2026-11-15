"use client";

import type {
  SaveSiteSettingsActionResult,
  SerializedSiteSettings,
} from "@/app/(workspace)/vcon/settings/actions";
import {
  AlertBanner,
  Button,
  Checkbox,
  FormField,
  Icon,
  Input,
  Label,
  notify,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Textarea,
} from "@/components/ui";
import { Check, ExternalLink, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

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
    const logoInputEl = formElement.elements.namedItem(
      "logo",
    ) as HTMLInputElement | null;
    if (!logoInputEl?.files?.length) {
      formData.delete("logo");
    }
    const faviconInputEl = formElement.elements.namedItem(
      "favicon",
    ) as HTMLInputElement | null;
    if (!faviconInputEl?.files?.length) {
      formData.delete("favicon");
    }
    formData.set("clear_logo", clearLogo ? "true" : "false");
    formData.set("clear_favicon", clearFavicon ? "true" : "false");

    setErrorBanner(null);
    setSuccessBanner(null);
    setFieldErrors({});

    startTransition(async () => {
      try {
        const response = await onSaveSettings(formData);
        if (!response.ok) {
          const msg =
            response.error ?? "Please correct the highlighted fields.";
          setErrorBanner(msg);
          setFieldErrors(response.fieldErrors ?? {});
          notify.error(response.error ?? "Failed to save site settings.");
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

        const successMsg =
          response.message ?? "Settings saved successfully.";
        setSuccessBanner(successMsg);
        notify.success(successMsg);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to save site settings.";
        setErrorBanner(msg);
        notify.error(msg);
      }
    });
  }

  return (
    <section className="space-y-3" aria-labelledby="site-settings-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2">
        <PageTitle id="site-settings-title">Site Settings</PageTitle>
        <Button type="submit" form="site-settings-form" disabled={isPending}>
          <Icon
            glyph={isPending ? RefreshCw : Check}
            className={isPending ? "animate-spin" : undefined}
          />
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {errorBanner ? (
        <AlertBanner variant="error">{errorBanner}</AlertBanner>
      ) : null}

      {successBanner ? (
        <AlertBanner variant="success">{successBanner}</AlertBanner>
      ) : null}

      <form
        id="site-settings-form"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="space-y-3"
      >
        <Panel>
          <PanelHeader>
            <SectionTitle>Brand</SectionTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                id="id_site_name"
                label="Site Name"
                error={fieldErrors.siteName}
              >
                <Input
                  id="id_site_name"
                  name="site_name"
                  type="text"
                  required
                  maxLength={120}
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </FormField>

              <FormField
                id="id_site_tagline"
                label="Site Tagline"
                error={fieldErrors.siteTagline}
              >
                <Input
                  id="id_site_tagline"
                  name="site_tagline"
                  type="text"
                  maxLength={200}
                  value={siteTagline}
                  onChange={(e) => setSiteTagline(e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="id_logo">Site Logo</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Max 5 MB · GIF, JPEG, PNG, SVG, WEBP
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  {settings.logoUrl && !clearLogo ? (
                    <img
                      src={settings.logoUrl}
                      alt="Current site logo"
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 shrink-0 border border-border object-contain p-1"
                    />
                  ) : (
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-muted font-mono text-[11px] font-medium text-muted-foreground">
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
                      className="block w-full text-xs text-muted-foreground file:mr-2.5 file:rounded-none file:border file:border-border file:bg-card file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
                    />
                  </div>
                </div>
                {settings.logoPath ? (
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-mono text-[11px]">
                      {settings.logoPath}
                    </span>
                    <Label className="inline-flex cursor-pointer items-center gap-1.5 font-normal">
                      <Checkbox
                        checked={clearLogo}
                        onChange={(e) => setClearLogo(e.target.checked)}
                      />
                      <span>Clear logo</span>
                    </Label>
                  </div>
                ) : null}
                {fieldErrors.logo ? (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {fieldErrors.logo}
                  </p>
                ) : null}
              </div>

              <div className="border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="id_favicon">Favicon</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Max 512 KB · GIF, ICO, PNG, SVG, WEBP
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  {settings.faviconUrl && !clearFavicon ? (
                    <img
                      src={settings.faviconUrl}
                      alt="Current site favicon"
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 shrink-0 border border-border object-contain p-1.5"
                    />
                  ) : (
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-muted font-mono text-[11px] font-medium text-muted-foreground">
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
                      className="block w-full text-xs text-muted-foreground file:mr-2.5 file:rounded-none file:border file:border-border file:bg-card file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
                    />
                  </div>
                </div>
                {settings.faviconPath ? (
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-mono text-[11px]">
                      {settings.faviconPath}
                    </span>
                    <Label className="inline-flex cursor-pointer items-center gap-1.5 font-normal">
                      <Checkbox
                        checked={clearFavicon}
                        onChange={(e) => setClearFavicon(e.target.checked)}
                      />
                      <span>Clear favicon</span>
                    </Label>
                  </div>
                ) : null}
                {fieldErrors.favicon ? (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {fieldErrors.favicon}
                  </p>
                ) : null}
              </div>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <SectionTitle>Contact Details</SectionTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                id="id_support_email"
                label="Support Email"
                error={fieldErrors.supportEmail}
              >
                <Input
                  id="id_support_email"
                  name="support_email"
                  type="email"
                  maxLength={254}
                  placeholder="support@example.com"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </FormField>

              <FormField
                id="id_contact_phone"
                label="Contact Phone"
                error={fieldErrors.contactPhone}
              >
                <Input
                  id="id_contact_phone"
                  name="contact_phone"
                  type="text"
                  maxLength={40}
                  placeholder="+1 (555) 010-2000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </FormField>
            </div>

            <FormField
              id="id_office_address"
              label="Office Address"
              error={fieldErrors.officeAddress}
            >
              <Input
                id="id_office_address"
                name="office_address"
                type="text"
                maxLength={255}
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
              />
            </FormField>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <SectionTitle>Footer</SectionTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <FormField
              id="id_footer_description"
              label="Public Footer description"
              error={fieldErrors.footerDescription}
            >
              <Textarea
                id="id_footer_description"
                name="footer_description"
                rows={2}
                value={footerDescription}
                onChange={(e) => setFooterDescription(e.target.value)}
              />
            </FormField>

            <FormField
              id="id_copyright_text"
              label="Copyright Text"
              error={fieldErrors.copyrightText}
            >
              <Input
                id="id_copyright_text"
                name="copyright_text"
                type="text"
                maxLength={255}
                value={copyrightText}
                onChange={(e) => setCopyrightText(e.target.value)}
              />
            </FormField>

            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                id="id_source_code_url"
                label="Source Code URL"
                error={fieldErrors.sourceCodeUrl}
              >
                <Input
                  id="id_source_code_url"
                  name="source_code_url"
                  type="url"
                  maxLength={200}
                  value={sourceCodeUrl}
                  onChange={(e) => setSourceCodeUrl(e.target.value)}
                />
              </FormField>

              <FormField
                id="id_privacy_url"
                label="Privacy / Terms URL"
                error={fieldErrors.privacyUrl}
              >
                <Input
                  id="id_privacy_url"
                  name="privacy_url"
                  type="text"
                  maxLength={500}
                  placeholder="/privacy/"
                  value={privacyUrl}
                  onChange={(e) => setPrivacyUrl(e.target.value)}
                />
              </FormField>
            </div>
          </PanelBody>
        </Panel>
      </form>

      <Panel>
        <PanelHeader>
          <SectionTitle>
            Public Branding Feed &amp; Storage Confinement
          </SectionTitle>
          <Button asChild size="sm" variant="outline">
            <a href="/api/site-settings" target="_blank" rel="noreferrer">
              Inspect /api/site-settings
              <Icon glyph={ExternalLink} className="size-3" />
            </a>
          </Button>
        </PanelHeader>
        <PanelBody className="grid gap-2 text-xs sm:grid-cols-3">
          <div className="border border-border bg-background p-2.5">
            <span className="block text-[11px] text-muted-foreground">
              Confined Media Root
            </span>
            <strong className="mt-1 block truncate font-mono font-medium text-foreground">
              {mediaRoot}
            </strong>
          </div>
          <div className="border border-border bg-background p-2.5">
            <span className="block text-[11px] text-muted-foreground">
              Allowed CORS Origin (PUBLIC_SITE_ORIGIN)
            </span>
            <strong className="mt-1 block truncate font-mono font-medium text-foreground">
              {publicSiteOrigin || "Same-origin only (not set)"}
            </strong>
          </div>
          <div className="border border-border bg-background p-2.5">
            <span className="block text-[11px] text-muted-foreground">
              Last Updated
            </span>
            <strong className="mt-1 block font-mono font-medium tabular-nums text-foreground">
              {new Date(settings.updatedAtIso).toUTCString()}
            </strong>
          </div>
        </PanelBody>
      </Panel>
    </section>
  );
}
