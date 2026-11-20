## SEO-02 candidate functionality — NOT YET CI VERIFIED
- Added source-only public site identity helper for AnyInbox origin, five factual inbound-only FAQs, safe JSON-LD, compact /about page, sitemap change without synthetic dates, route-level sign-in/sign-up noindex, public branding image crawl exception, and conditional manifest favicon.
- Existing branded Admin SEO settings remain unchanged; new About content is source-managed, not a new Admin CMS.
- Default ReadBox origin retains original visible Homepage H1 and FAQ. SiteName stored in Admin settings remains unchanged; Home metadata override still uses SEO-01 configuration.

# 005 — Actual Feature Inventory

Use truth labels: **SOURCE PRESENT**, **LIVE OBSERVED**, **NOT TESTED**, **MISSING SOURCE**, **CI VERIFIED**, **LIVE ACCEPTED**. A code path or rendered HTML is not proof of end-to-end business operation.

| Component | Frozen proof | Real status | Proposed phase |
|---|---|---|---|
| Admin name/tagline | `settings-console.tsx:204–244` | SOURCE PRESENT; live title reflects a name but save untested | preserve |
| Admin logo/favicon/footer | `settings-console.tsx:247–346,426–449` | SOURCE PRESENT; branded media URL live observed | preserve |
| Existing Home title/meta description | `app/page.tsx:45–61` | LIVE OBSERVED | P01 extend |
| Home canonical/OG/Twitter text | `app/page.tsx:70–89` | LIVE OBSERVED | preserve |
| Contact and Privacy metadata | `app/contact/page.tsx:36–64`; `privacy/page.tsx:26–49` | SOURCE PRESENT, LIVE NOT VERIFIED | P01 extend |
| Organization/WebApplication/FAQ schema | `app/page.tsx:240–288` | LIVE OBSERVED, validation NOT TESTED | P02 refine |
| Robots/sitemap generation | `app/robots.ts`; `app/sitemap.ts` | SOURCE PRESENT, LIVE ENDPOINTS NOT VERIFIED (429) | P02 |
| PWA manifest | `app/manifest.ts` | SOURCE PRESENT, live manifest tag only | P02 |
| Separate page-specific Admin SEO | No model/form/service | MISSING SOURCE | P01 |
| Homepage OG image override | `app/page.tsx:73–85` lacks image | MISSING SOURCE | P01 |
| Configurable Hero H1 | `app/page.tsx:304–307` fixed | MISSING SOURCE | P02 |
| Explicit auth pages noindex | `sign-in` / `sign-up` page metadata lacks robots flag | MISSING SOURCE | P02 |
| Public About identity page | `src/app/about` not present at freeze | MISSING SOURCE | P02 |
| Google/Bing indexing and AI search citations | external engines | NOT TESTED, no guarantees | external |

## Per-phase update record
For each implemented feature write source SHA, CI URL/negative cases, actual live/Not Tested and feature limitations. Current SEO feature additions = **zero**. ReadBox's existing inbox, domain and DKIM capabilities are historical/source/previous operator evidence and **not retested** during this audit.

## SEO-01 candidate implementation (2026-11-20) — not accepted
- SOURCE CANDIDATE branch `implementation/readbox-seo01-20261120` contains separate `SiteSeoSettings` model/table, safe admin update action, `SeoSettingsConsole` sibling, optional override for Home/Contact/Privacy metadata and optional restricted same-origin image path. UI and unit focused tests passed at `b01d40a6`.
- STATUS: **IMPLEMENTED IN CANDIDATE / CI INCOMPLETE / NOT IN MAIN / NOT LIVE**. No production migration has run and no admin user has saved a live SEO value. Existing branding remains untouched.
- The follow-up lint-only correction is not CI-verified. Health-readiness fixture and build/typecheck gates pending; Phase-01 0/2 closed; Phase-02 remains NOT STARTED.

## 2026-11-20 — Actual candidate feature status after CI success

**SOURCE + CI VERIFIED at `610ff3670911cd61b403513c4a74400f64fae361`, NOT DEPLOYED:** the independent SEO field model/database migration, approved admin-only SEO sibling panel, validated write/read service, page SEO overrides for Home/Contact/Privacy, and optional restricted same-origin existing social image path. Existing Settings UI and legacy public metadata fallbacks are covered by unit/UI/build gates.
- 6/6 SEO unit and metadata PASS; 7/7 SEO+legacy UI PASS; 7/7 readiness PASS; lint/typecheck/build PASS. Existing unapproved public copy, auth, mail and DNS code untouched.
- No production schema migration applied. A fresh deployment of candidate without running migrations will show legacy metadata/fail-close SEO writes until migration is separately approved and applied.
- **Actual live feature status = NOT TESTED**. No real Admin save in anyinbox.cc, search-engine/AI indexing acceptance, OG asset fetch, or VPS operation occurred.
- SEO-02 features and AI discovery page/crawl policy **remain pending**.

## 2026-11-20 — SEO-02 actual feature tracker update

| Feature | Actual evidence | Live status |
|---|---|---|
| AnyInbox branded H1/FAQ, generic ReadBox fallback | SOURCE + CI VERIFIED | NOT DEPLOYED |
| Script-safe JSON-LD and visible FAQ parity | SOURCE + CI VERIFIED | NOT DEPLOYED |
| /about and footer link | SOURCE + CI VERIFIED (build + UI) | NOT DEPLOYED |
| Public-only sitemap/no fabricated lastModified | SOURCE + CI VERIFIED | NOT DEPLOYED |
| Robots policy and auth-page noindex | SOURCE + CI VERIFIED | NOT DEPLOYED |
| Conditional PWA favicon | SOURCE + CI VERIFIED; live installation untested | NOT DEPLOYED |
| Search engine/AI indexing | No external acceptance evidence | NOT VERIFIED |

No SEO-02 Prisma change, Admin brand-data rewrite, mailserver or UI redesign. SEO-01 migration and production rollout still need independent authorization.
