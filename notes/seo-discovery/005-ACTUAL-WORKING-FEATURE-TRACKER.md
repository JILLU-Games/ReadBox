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
