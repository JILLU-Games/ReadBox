# 006 — SEO Verification, Security and Publication Gates

**All new feature gates currently NOT RUN.** Documentation existence != tested implementation. This is a **SEO feature gate**, not full product release GO.

## P01 — One bounded disposable CI
1. New additive Prisma table/schema validation; historical migrations untouched; no second DB.
2. SEO read absent row / failed DB -> **old exact metadata** still renders on `/`, `/contact`, `/privacy`; failed write is visible refusal.
3. Role and same-origin/CSRF guard denies anonymous, non-admin and forged mutation; audit event no secrets.
4. All invalid page IDs, length/control characters, unsafe schemes, external OG images, traversal and script/HTML payloads handled.
5. Safe stored metadata works; canonical unchanged; OG/Twitter consistent; optional social image path validated or omitted.
6. Original Admin Settings values/form, logo/favicon/footer and contact/sign-in functionality unchanged.
7. Focused new SEO tests + typecheck/lint/build in one disposable workflow where feasible; one exact patch/security audit. No live credential/network dependency.

## P02 — One bounded disposable CI
1. AnyInbox brand spelling/copy consistent across H1, metadata, visible About, schema and FAQ. No unsupported SMTP sending/IMAP/public API claims.
2. Script-safe JSON-LD: malicious `</script><script>`/Unicode strings can't break script; visible FAQ matches FAQ schema.
3. Sitemap contains only published public pages with correct canonical origin; no synthetic stale/now lastModified; no private URLs.
4. Noindex on approved auth pages; no private crawler admission; robots disallow `/users/`, `/vcon/` and private `/api/` preserved.
5. PWA icons reflect configured brand if custom asset exists; default ReadBox installs remain unchanged.
6. Public page section IDs, CTA navigation, layout, responsive design, header/footer preserved; one focused test and one exact scope audit.

## External live acceptance — separately authorized
- Independently GET rendered HTML and inspect meta/JSON-LD for `/`, `/contact`, `/privacy`, optional `/about`, robots/sitemap/manifest and public share asset; prior Browserless 429 remains unresolved.
- Validate HTTPS origin, canonical redirects, Search Console/Bing Webmaster **if user authorizes**; check actual indexing and site performance separately. No guaranteed ranking, snippet, AI citation or crawler visibility.
- Existing 17 ReadBox production gates and 7 historical blockers remain in legacy notes; SEO PASS does not close them.

## Audit/stop conditions
After each grouped phase: exact modified-path allowlist, `git diff --check`, secret scan, provenance, deployment skip/no destructive action, one CI run with tested SHA and URL. On scoped failure perform minimal fix and one necessary recheck, otherwise mark BLOCKED/FAILED. No tag/release/VPS migration/live DNS/email or force-push.

## Actual CI attempt ledger (2026-11-20)
| Run | SHA | Scoped evidence | Result |
|---|---|---|---|
| [44710248931](https://github.com/vibtoolshq/ReadBox/actions/runs/44710248931) | `f5bdf26768b9fcc01d92e66436270e4bc326f2a6` | exact 26-path scope PASS, Prisma validate PASS, SEO unit PASS, unrelated readiness fixture `not_ready` vs `ready` | **FAIL** |
| [44710700637](https://github.com/vibtoolshq/ReadBox/actions/runs/44710700637) | `b01d40a6f49fef03bf247b97bf9c18388b199625` | scope PASS, Prisma schema PASS, SEO unit 6/6 PASS, UI SEO+legacy 7/7 PASS, lint `no-control-regex` FAIL | **FAIL** |

**Typecheck, production build, final regex correction and original readiness regression not passed in second run.** The final lint correction is explicitly CI NOT TESTED; do not infer success from the earlier passing unit/UI stages. No production database migration applied. Release/SEO deploy gate **NO-GO**; full ReadBox acceptance still NO-GO.
