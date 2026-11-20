# 001 — Verified Findings & Risk Register

Audit basis: frozen source `8e5b01b65c6f451dbbfabef64ca429687592e455` + one live Homepage Browserless HTML. **OPEN** means improvement pending; a risk without reproduction must remain **UNVERIFIED**, not a proven outage.

| ID | Severity | Exact frozen proof / observation | Classification | Owner |
|---|---|---|---|---|
| SEO-F01 | P1 | Live `<title>Any Inbox...`, while intended brand string `AnyInbox`. `src/app/layout.tsx:9–29` derives siteName from Admin SiteSettings. | LIVE BRAND INCONSISTENCY | P01 |
| SEO-F02 | P1 | `src/core/settings/service.ts:75–118` SiteSettings lacks page-specific SEO fields; `settings-console.tsx:204–245,426–449` has brand/footer only. `page.tsx:45–61` computes title from tagline and description from footer. | CONFIRMED MISSING EDITOR | P01 |
| SEO-F03 | P1 | `src/app/page.tsx:304–307` hardcodes generic H1; live H1 matches. Site tagline at `:309–315` is separate. | CONFIRMED CONTENT GAP | P02 |
| SEO-F04 | P2 | `src/app/page.tsx:73–85` declares OG/Twitter text but no `images`; live head showed no `og:image`. | CONFIRMED SOCIAL PREVIEW GAP | P01 |
| SEO-F05 | P2 | `src/app/robots.ts:17–18` disallows `/api/`, while branded favicon uses `/api/media/site-settings/...`. Actual crawl failure unknown; robots endpoint received 429 during separate tool check. | CONFIRMED POLICY + UNVERIFIED IMPACT | P02 |
| SEO-F06 | P2 | `sign-in/page.tsx:24–32` and `sign-up/page.tsx:24–33` set title/referrer without explicit noindex; robots currently disallows sign-in but not sign-up. | CONFIRMED SOURCE GAP, INDEX STATE UNKNOWN | P02 |
| SEO-F07 | P2 | `src/app/sitemap.ts:11–33` hardcodes 2026-04-12 `lastModified` for every public URL. | CONFIRMED STALE SIGNAL | P02 |
| SEO-F08 | P2 | `src/app/page.tsx:240–288` emits Organization/WebApplication/FAQPage based on site settings and hardcoded FAQ. JSON string is inserted in a script: script-breakout escape risk to test, not an exploit assertion. | SOURCE + SECURITY REVIEW | P02 |
| SEO-F09 | P2 | `src/app` tree has no `about/` directory; lacks a single verified, concise product-identity page (optional, not mandatory for SEO). | VERIFIED OPPORTUNITY | P02 |
| SEO-F10 | P2 | `src/app/manifest.ts:16–59` still includes `/icons/readbox-192.png`, `readbox-512.png` and `readbox.svg` defaults even when custom favicon added. | CROSS-BRAND FALLBACK RISK | P02 |
| SEO-F11 | P2 | `contact/page.tsx:36–64` and `privacy/page.tsx:26–49` use fixed descriptions, not independent Admin fields. | CONFIRMED | P01 |
| SEO-F12 | P2 | `layout.tsx:9–29` has ReadBox defaults; new SEO DB read must be optional/fail-safe and preserve previous title/description on failure. | DESIGN GATE, NOT BUG REPRO | P01 |
| SEO-F13 | P3 | `public-site-footer.tsx:40–115` uses fixed nav; Admin edits footer description but cannot add About link. | OPTIONAL NARROW CHANGE | P02 |

## Explicit non-findings / don't rewrite
**Already implemented:** canonical Home/Contact/Privacy; homepage robots index/follow metadata; OG and Twitter **text**; root application metadata; robots and sitemap **generator source**; JSON-LD Organization/WebApplication/FAQPage; Admin branding/logo/favicon/footer save and errors. Preserve them, add focused editable overrides.

**Truth limitations:** source having sitemap/robots does not certify publicly accessible endpoint. Browserless 429 does not prove Google blocked. AI-specific `llms.txt` is neither necessary nor guaranteed to improve AI inclusion. Don't invent rankings, feature claims, security certifications or third-party reviews.

## Production relevance
This is a scoped **SEO feature/readiness** register, not the original ReadBox product forensic blocker list. Outstanding release gates in legacy notes continue independently.
