# 002 — Exactly TWO Implementation Phases and Exact Scope Locks

**PLANNED ONLY; per-phase explicit approval is mandatory.** Frozen source: `8e5b01b65c6f451dbbfabef64ca429687592e455`. No broad refactor. Existing UI/theme/layout, footer structure, auth, Prisma existing models/migrations, mailserver, SMTP/DNS, Maildir, backup/R2, production data, VPS and deployment remain untouched unless explicitly named below. Use the **same existing PostgreSQL instance**, never a second DB.

## Phase-01 / SEO-01 — Independent Admin Page SEO Foundation
Scope: SEO-F01, F02, F04, F11, F12. Create compact sibling **Admin → Settings → SEO & Discovery** section (not replacement or redesign of Branding). Store validated per-page titles/descriptions for `/`, `/contact`, `/privacy`; optional *same-origin existing public image path* for OG; separate preview. Empty/missing SEO row returns **exact previous metadata**.

**EXACT executable-path allowlist, limited to described owned sections:**
1. `prisma/schema.prisma` — append isolated `SiteSeoSettings` model only; leave `SiteSettings` and all other models unchanged.
2. `prisma/migrations/20261120000000_seo01_site_seo_settings/migration.sql` — new additive table only; timestamp collision means STOP and obtain updated approval. Never edit applied migrations.
3. `src/core/seo/types.ts` — NEW field definitions.
4. `src/core/seo/validation.ts` — NEW bounded Zod schema (page allowlist, title, description, image path).
5. `src/core/seo/service.ts` — NEW DB reads/writes with existing Prisma client, audit, fail-safe metadata fallback and fail-closed writes.
6. `src/core/seo/metadata.ts` — NEW centralized metadata override resolver; preserve previous canonical/OG/Twitter fallback.
7. `src/app/(workspace)/vcon/settings/seo-actions.ts` — NEW guarded admin server action using current auth, origin/CSRF and cache revalidation contract.
8. `src/components/vcon/seo-settings-console.tsx` — NEW accessible compact sibling panel, page selector and preview.
9. `src/app/(workspace)/vcon/settings/page.tsx` — ONLY add sibling SEO component/load, preserve existing `SettingsConsole` props/form.
10. `src/app/page.tsx` — ONLY `generateMetadata` region `L45–91`.
11. `src/app/contact/page.tsx` — ONLY `generateMetadata` `L36–65`.
12. `src/app/privacy/page.tsx` — ONLY `generateMetadata` `L26–50`; actual legal text unchanged.
13. `tests/seo/seo-settings.test.ts` — NEW DB/guard/invalid-input contracts.
14. `tests/seo/page-metadata.test.ts` — NEW exact fallback and override tests.
15. `tests/ui/seo-settings.test.tsx` — NEW panel/preview/negative tests.
16. `.github/workflows/seo01-disposable-ci.yml` — NEW read-only least-privilege scoped CI; disposable DB only.
17. `notes/seo-discovery/{003,004,005,006,007}.md` — documentation updates at closure.

**Not permitted in P01:** any public H1/cards/FAQ/CTA changes, edits to `settings-console.tsx`, new media endpoint, arbitrary OG upload pipeline, new origin/env variable, external SEO API, secret access or live migration. If a custom social image upload needs extra storage code, mark it DEFERRED/BLOCKED pending explicit exception, not a silent scope expansion.

**P01 negative acceptance:** unauthorized action denied; cross-origin/forged save refused; long values, control characters, script markup and external/`javascript:`/`data:`/`//`/path-traversal image URLs rejected; no public save endpoint; fail-save preserves original values; database/table unavailable read retains prior page rendering, write fails visibly; stored values survive simulated restart; existing branding unaffected; one focused disposable CI + scope/security diff.

## Phase-02 / SEO-02 — Brand Content, Crawl Policy & AI-readable Identity
After P01 verified closure/approval only. Scope: SEO-F03, F05–10, F13. Use approved factual AnyInbox copy, optional concise `/about` page, consistent FAQ/JSON-LD, index rules, truthful sitemap dates and conditional installed-app icon selection. **No new page builder.**

**EXACT executable-path allowlist, limited to described owned sections:**
1. `src/app/page.tsx` — only current H1/feature-copy/FAQ content arrays and homepage JSON-LD, preserve sections/markup/CTA/layout.
2. `src/core/seo/brand.ts` — NEW verified brand facts, scoped per-site (do not globally rename ReadBox OSS).
3. `src/core/seo/structured-data.ts` — NEW safe JSON-LD factory/serialization.
4. `src/app/about/page.tsx` — NEW compact public About route with visible facts/canonical.
5. `src/app/sitemap.ts` — only include published About + stable truthful modified date or omit it; no generated-now timestamps.
6. `src/app/robots.ts` — only ensure intended public pages/assets crawled; keep `/users/`, `/vcon/`, private `/api/` protected; no blanket allow.
7. `src/app/sign-in/page.tsx` — only metadata `robots` noindex, without touching auth UI/flow.
8. `src/app/sign-up/page.tsx` — only metadata noindex when approved, signup remains functional.
9. `src/app/manifest.ts` — only per-instance custom icons; preserve default ReadBox site behavior and PWA `start_url`.
10. `src/components/public/public-site-footer.tsx` — only optional About link; no restyle.
11. `src/components/vcon/seo-settings-console.tsx` — only if P01 schema already supports safe brand-content controls; otherwise static approved copy, no new model.
12. `tests/seo/ai-discovery.test.ts` — NEW robots/sitemap/schema/manifest tests.
13. `tests/ui/seo-public-pages.test.tsx` — NEW content/markup regression.
14. `.github/workflows/seo01-disposable-ci.yml` — only extend bounded P02 checks.
15. `notes/seo-discovery/{003,004,005,006,007,008}.md` — closure logs.

**Prohibited P02:** `llms.txt` as fabricated ranking solution, broad crawler API openings, tracking pixels, analytics platform, CMS/blog, arbitrary admin page HTML, mail compose/send/SMTP changes, outbound credentials, third-party external calls, default open-source ReadBox global rebrand, legal/privacy text rewrite, extra migrations.

## Both phases: compact execution contract
- Recheck Primary SHA/tree and historical proof; obtain **specific phase approval**. If baseline diverges, compare exact changes and amend scope first.
- Apply **one grouped patch** under that phase only; one focused disposable CI and one exact changed-path/secret/security audit, with at most minimal defect repair + one focused recheck. Failure = BLOCKED/FAIL, not PASS.
- Log `003–007`: tested SHA, run URL, errors/negative cases, modified-path inventory, user-visible behavior, external-not-tested truth and next phase.
- Commit after evidence; exact non-force source/dedicated-backup SHA sync only when authorized and technically possible; otherwise report parity pending. No unapproved VPS deployment, live DB migration, DNS, SMTP, tag or release.
- **Totals:** 2 phases, 0 completed, 2 pending. Next only Phase-01.
