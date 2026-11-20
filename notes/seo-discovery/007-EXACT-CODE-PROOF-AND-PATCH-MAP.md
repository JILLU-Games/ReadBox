## SEO-02 exact patch ownership and retained behaviors
- Baseline `1485258654c36d27d9b2c2e51942072aaa66e346`; planned/implementation branch `implementation/readbox-seo02-20261120`.
- `src/app/page.tsx`: replace fixed public H1 and FAQ data use with site-specific copy, feed same FAQs to JSON-LD. Keep generateMetadata, existing CSS/layout/CTA, user-facing panels, links and mail logic untouched.
- `src/core/seo/brand.ts`: isolate AnyInbox to exact HTTPS origin, retain ReadBox H1/FAQ defaults. `structured-data.ts`: script-safe JSON-LD serialization.
- `src/app/about/page.tsx`: new minimal public factual page; `sitemap.ts`: add About, omit unverified lastModified; `robots.ts`: narrowly allow site settings public assets and keep private API deny; `sign-in/sign-up`: metadata-only noindex.
- `src/app/manifest.ts`: if AnyInbox branded favicon exists, omit ReadBox fallback icons; default OSS install behavior stays.
- `src/components/public/public-site-footer.tsx`: optional About link only; no redesign.
- CI branch-specific diff against exact 1485258 baseline; no Prisma files allowed. SEO-01 previous CI contract preserved.

# 007 — Immutable Code Blocks, Patch Ownership and Regression Map

**All excerpts below are existing source evidence at `8e5b01b65c6f451dbbfabef64ca429687592e455`. They are NOT implementation diff.** Base link format: `https://github.com/vibtoolshq/ReadBox/blob/8e5b01b65c6f451dbbfabef64ca429687592e455/PATH#LNUMBER`.

## Proof E01 — SEO metadata currently coupled to branding (`src/app/page.tsx:L45–61`)
```ts
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";
  const tagline =
    settings.siteTagline ||
    "Self-Service Custom-Domain Mailboxes & Private Team Workspaces";
  const title = `${siteName} — ${tagline}`;
  const description =
    settings.footerDescription ||
    `${siteName} provides self-service user sign-up, custom-domain mailboxes, shared team inboxes, and automated message retention.`;
```
P01 patch only metadata resolver on `page.tsx:L45–91` with exact old fallback. `contact/page.tsx:L36–65` and `privacy/page.tsx:L26–50` analogous. OG/Twitter exists at `page.tsx:L73–85` but images absent.

## Proof E02 — Site Settings has no SEO fields (`src/core/settings/service.ts:L75–89`)
```ts
export interface SiteSettingsRecord {
  readonly id: bigint;
  readonly siteName: string;
  readonly siteTagline: string;
  readonly logoPath: string;
  readonly faviconPath: string;
  readonly supportEmail: string;
  readonly contactPhone: string;
  readonly officeAddress: string;
  readonly footerDescription: string;
  readonly copyrightText: string;
  readonly sourceCodeUrl: string;
  readonly privacyUrl: string;
  readonly updatedAt: Date;
}
```
P01 adds separate `SiteSeoSettings`; no existing field/model modifications.

## Proof E03 — Existing Admin protected save (`src/app/(workspace)/vcon/settings/actions.ts:L78–87`)
```ts
export async function saveSiteSettingsAction(
  formData: FormData,
): Promise<SaveSiteSettingsActionResult> {
  const admin = await requireAdminUser();
  const reqHeaders = await headers();
```
At `:119–130` revalidates home/contact/privacy/sign pages and manifest. P01 creates distinct `seo-actions.ts`, same security model. `src/app/(workspace)/vcon/settings/page.tsx:L34–41` currently returns a single `SettingsConsole`; append a sibling panel only. Existing UI fields `src/components/vcon/settings-console.tsx:L204–245,426–449` must not change.

## Proof E04 — Hardcoded live H1 (`src/app/page.tsx:L303–315`)
```tsx
<PageTitle className="text-balance">
  Self-service custom-domain mailboxes and private team
  workspaces.
</PageTitle>
```
P02 narrow H1/copy override. All CSS/CTA/section anchors untouched.

## Proof E05 — Actual homepage JSON-LD (`src/app/page.tsx:L240–288`)
```ts
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${baseUrl}/#organization`, name: siteName },
    { "@type": "WebApplication", name: siteName },
    { "@type": "FAQPage", mainEntity: PUBLIC_FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })) },
  ],
};
```
Shown above is a **faithful condensed excerpt** (the full source includes other properties). Actual render uses inline JSON-LD script + `JSON.stringify(jsonLd)` at `:284–288`. P02 validate and escape script-breakout sequences; don't add duplicate graphs. Any schema change must reflect visible FAQ exactly.

## Proof E06 — Robots and sitemap `src/app/robots.ts:L14–21`, `src/app/sitemap.ts:L11–15`
```ts
userAgent: "*",
allow: ["/", "/contact", "/privacy"],
disallow: ["/vcon/", "/users/", "/api/", "/sign-in", "/reset-password"],
```
```ts
const baseUrl = resolvePublicBaseUrl();
const lastModified = new Date("2026-04-12T00:00:00.000Z");
```
P02 preserves private disallow; About only after published; real stable modified date or none. Never assume a 429 proves crawler exclusion.

## Proof E07 — PWA icon cross-brand fallback `src/app/manifest.ts:L16–25,L32–59`
```ts
let siteName = "ReadBox";
let description = "Private team mailbox workspace";
let customFaviconUrl = "";
```
Then hardcoded `/icons/readbox-192.png`, `/icons/readbox-512.png` and `/icons/readbox.svg` entries exist even if custom favicon gets prepended. P02 only per-site conditional selection; OSS defaults intact.

## Proof E08 — Auth metadata `src/app/sign-in/page.tsx:L24–32`
```ts
return {
  title: { absolute: `User sign in | ${siteName}` },
  referrer: "same-origin",
};
```
`src/app/sign-up/page.tsx:L24–33` analogous. P02 metadata-only `robots: { index:false, follow:false }`; do not touch sign-in, sign-up or authorization.

## Proof E09 — Existing validation and DB fail-closed
`src/core/settings/service.ts:L163–173,L193–197` limits tagline to 200 and footer to 2000; `:490–503` maps field errors; `:580–584` refuses settings writes when database missing in production. P01 new SEO service must preserve this behavior.

## Exact patch path/section ownership
| Path | Phase | Allowed section | Must not edit |
|---|---|---|---|
| `src/app/(workspace)/vcon/settings/page.tsx` | P01 | append sibling SEO panel | original SettingsConsole contract |
| `prisma/schema.prisma` + NEW migration | P01 | isolated append/new table | existing models/applied SQL |
| `src/app/page.tsx` | P01 | generateMetadata only | H1/cards/FAQ and page DOM |
| `src/app/contact/page.tsx`, `src/app/privacy/page.tsx` | P01 | metadata only | forms/legal body |
| `src/app/page.tsx` | P02 | approved H1/copy/FAQ/JSON-LD only | layout/CTA/handlers |
| `src/app/robots.ts`, `sitemap.ts`, `manifest.ts` | P02 | narrow discovery policy | private APIs, PWA start_url |
| `src/app/{sign-in,sign-up}/page.tsx` | P02 | metadata only | auth/UI |
| `src/components/public/public-site-footer.tsx` | P02 | optional About link | restyling |
| NEW `tests/seo/**`, `tests/ui/seo-*.test.tsx` | both | scoped tests | broad test rewrites |

Before Phase-01 code edits, re-fetch current code; these frozen line addresses are reference anchors, not blanket permission for neighboring sections.

## Proposed vs actual patch audit — 2026-11-20 candidate
- GitHub commit `f5bdf26768b9fcc01d92e66436270e4bc326f2a6` lists 16 exactly allowlisted executable/test/workflow paths. Planning commit `0345664e67108aeac3b83c5f6c0b352c550909cb` added 10 new notes files only. Scoped `git diff --check` and path guard passed in both CI attempts.
- `prisma/schema.prisma`: append isolated `SiteSeoSettings` only; `prisma/migrations/20261120000000_seo01_site_seo_settings/migration.sql` new table only. Existing `SiteSettings` model and migrations unchanged.
- `src/app/(workspace)/vcon/settings/page.tsx` adds a sibling SEO panel; original `src/components/vcon/settings-console.tsx` file unchanged.
- `src/app/{page,contact/page,privacy/page}.tsx` edits restricted to imports and `generateMetadata` optional override; no public H1/FAQ/CTA/body changes.
- `src/app/(workspace)/vcon/settings/seo-actions.ts`: `requireAdminUser` before write; origin check moved to `src/core/seo/validation.ts` to comply with async-only server-action export rule.
- Runtime persistence, actual live SQL migration, typecheck and build remain unverified. Original Health readiness migration fixture mismatch must be fixed with **explicit additional single-test allowlist**; do not silently edit `tests/admin/phase6-settings-update-health.test.ts`.
- Full source/mirror parity withheld while CI FAIL; no force pushes, production actions or tags.

## 2026-11-20 — Approved one-line exception and exact patch/security proof

**Original test file:** `tests/admin/phase6-settings-update-health.test.ts` baseline migrated-ready fixture. User explicitly approved this single file exception.

```diff
       "20261117010000_postfix_login_identity",
+      "20261120000000_seo01_site_seo_settings",
     ].map((migration_name) => ({
```

Commit: `bd516a5fb2da3d5a4a3558af116ee21e40893b65` (1 addition, 0 deletion, no other files). The migration itself was newly added, so existing hardcoded migration readiness mock otherwise reported `not_ready`.

**Scoped workflow proof:** `.github/workflows/seo01-disposable-ci.yml` adds `tests/admin/phase6-settings-update-health.test.ts` to the existing branch trigger and exact changed-path Python allowlist; commit `610ff3670911cd61b403513c4a74400f64fae361` modifies this workflow only. Workflow still least-privilege `contents: read`, `persist-credentials: false`, no deploy/tag/secrets.

**Exact frozen-to-tested diff:** GitHub compare `8e5b01b65c6f451dbbfabef64ca429687592e455...610ff3670911cd61b403513c4a74400f64fae361`: 27 paths; 10 planning/forensic documentation files plus 17 source/test/workflow paths; no `src/core/auth/`, `src/core/dns/`, `src/core/mailboxes/`, mailserver, deployment, original migrations, `.env`, Docker/Compose or privacy body modification. `prisma/schema.prisma` append-only new model; no existing table rewrite. Settings app page adds a separate sibling component; original `src/components/vcon/settings-console.tsx` unchanged. Public page changes limited to metadata imports/optional resolution; H1/body/FAQ untouched. All other source effects out of scope.
