"use client";

import {
  AlertBanner, Button, Input, Label, Panel, PanelBody, PanelHeader, SectionTitle,
  Textarea,
} from "@/components/ui";
import type { SeoPageKey, SeoPageValues, SeoSaveResult, SeoSettingsSnapshot } from "@/core/seo/types";
import { useState, useTransition } from "react";

const PAGE_OPTIONS: { key: SeoPageKey; label: string; path: string }[] = [
  { key: "home", label: "Homepage", path: "/" },
  { key: "contact", label: "Contact", path: "/contact" },
  { key: "privacy", label: "Privacy", path: "/privacy" },
];

interface SeoSettingsConsoleProps {
  readonly initial: SeoSettingsSnapshot;
  readonly publicOrigin: string;
  readonly fallbacks: Record<SeoPageKey, { title: string; description: string }>;
  readonly onSave: (form: FormData) => Promise<SeoSaveResult>;
}

export function SeoSettingsConsole({
  initial, publicOrigin, fallbacks, onSave,
}: SeoSettingsConsoleProps) {
  const [pageKey, setPageKey] = useState<SeoPageKey>("home");
  const [drafts, setDrafts] = useState(initial.pages);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [pending, startTransition] = useTransition();
  const active = drafts[pageKey];

  function edit(field: keyof SeoPageValues, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], [field]: value },
    }));
    setError("");
    setSuccess("");
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({});
    const selected = pageKey;
    const payload = new FormData();
    payload.set("pageKey", selected);
    payload.set("title", active.title);
    payload.set("description", active.description);
    payload.set("imagePath", active.imagePath);
    startTransition(async () => {
      try {
        const result = await onSave(payload);
        if (!result.ok || !result.settings) {
          setError(result.error || "SEO settings could not be saved.");
          setFieldErrors(result.fieldErrors || {});
          return;
        }
        setDrafts((prev) => ({ ...prev, [selected]: result.settings! }));
        setSuccess("SEO settings saved.");
      } catch {
        setError("SEO settings could not be saved.");
      }
    });
  }

  const preview = fallbacks[pageKey];
  const pagePath = PAGE_OPTIONS.find((page) => page.key === pageKey)?.path || "/";
  const url = publicOrigin ? publicOrigin.replace(/\/$/, "") + pagePath : pagePath;

  return (
    <section className="space-y-3" aria-labelledby="seo-settings-title">
      <Panel>
        <PanelHeader>
          <SectionTitle>SEO &amp; Discovery</SectionTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {!initial.databaseConnected ? (
            <AlertBanner variant="error">SEO settings database is unavailable. Existing public metadata remains active; saving is disabled.</AlertBanner>
          ) : null}
          {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
          {success ? <AlertBanner variant="success">{success}</AlertBanner> : null}
          <form id="seo-settings-form" onSubmit={save} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="seo-page">Public page</Label>
              <select
                id="seo-page"
                value={pageKey}
                onChange={(event) => {
                  setPageKey(event.target.value as SeoPageKey);
                  setError("");
                  setSuccess("");
                  setFieldErrors({});
                }}
                className="w-full rounded-none border border-border bg-background px-2 py-2 text-xs text-foreground"
              >
                {PAGE_OPTIONS.map((page) => (
                  <option key={page.key} value={page.key}>{page.label} ({page.path})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="seo-title">SEO title</Label>
              <Input id="seo-title" name="seo_title" value={active.title} maxLength={120}
                aria-invalid={!!fieldErrors.title} onChange={(event) => edit("title", event.target.value)}
                placeholder={preview.title} />
              {fieldErrors.title ? <p role="alert" className="text-xs text-destructive">{fieldErrors.title}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="seo-description">Meta description</Label>
              <Textarea id="seo-description" name="seo_description" rows={2} maxLength={320}
                aria-invalid={!!fieldErrors.description} value={active.description}
                onChange={(event) => edit("description", event.target.value)}
                placeholder={preview.description} />
              {fieldErrors.description ? <p role="alert" className="text-xs text-destructive">{fieldErrors.description}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="seo-image">Social image path (optional)</Label>
              <Input id="seo-image" name="seo_image" maxLength={255} value={active.imagePath}
                aria-invalid={!!fieldErrors.imagePath}
                onChange={(event) => edit("imagePath", event.target.value)}
                placeholder="/icons/brand-social.png" />
              <p className="text-xs text-muted-foreground">
                Existing public PNG, JPEG or WebP path under /icons/ or /api/media/site-settings/ only. No upload or external URL.
              </p>
              {fieldErrors.imagePath ? <p role="alert" className="text-xs text-destructive">{fieldErrors.imagePath}</p> : null}
            </div>
            <div className="border border-border bg-muted p-3" aria-label="Search preview">
              <p className="text-xs text-muted-foreground">Search preview · {url}</p>
              <p className="mt-1 text-sm font-medium text-primary">{active.title || preview.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {active.description || preview.description}
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !initial.databaseConnected}>
                {pending ? "Saving..." : "Save SEO"}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground">
            Empty fields use the existing page metadata. Branding, privacy text and site layout are not changed.
          </p>
        </PanelBody>
      </Panel>
    </section>
  );
}
