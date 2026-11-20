# 004 — Existing Error Handling & SEO Negative-Case Plan

## Actual source implementations (not freshly rerun)
| Surface | Existing proof | Status |
|---|---|---|
| Branding validation | `src/core/settings/service.ts:163–220` Zod length and URL checks, `:490–503` per-field errors | SOURCE PRESENT |
| Logo/favicon restriction | `src/core/settings/service.ts:35–73,505–529` size/MIME/extension checking | SOURCE PRESENT |
| Existing Settings admin action | `src/app/(workspace)/vcon/settings/actions.ts:78–81` `requireAdminUser`; `:119–130` revalidation | SOURCE PRESENT |
| Production Settings DB failure | `src/core/settings/service.ts:573–606` rejects unavailable production write | SOURCE PRESENT |
| Settings read fallback | `src/core/settings/service.ts:328–427` cached/default fallback | SOURCE PRESENT |
| UI toast/error handling | `src/components/vcon/settings-console.tsx:100–153` save result and error UI | SOURCE PRESENT |

## Required NEW SEO error contracts — all NOT IMPLEMENTED
| Error ID | Input / failure | Response required | Phase |
|---|---|---|---|
| `SEO_INVALID_PAGE` | Unknown or private page key | 400/field error, no mutation | 01 |
| `SEO_TITLE_INVALID` | Over-limit/control-char title | Field error, leave old value | 01 |
| `SEO_DESCRIPTION_INVALID` | Over-limit/script payload | Reject/escape as appropriate; no raw HTML injection | 01 |
| `SEO_UNSAFE_IMAGE_URL` | Remote/protocol-relative/data/javascript/path traversal | Refuse, same-origin public path only | 01 |
| `SEO_ADMIN_REQUIRED` | Anonymous/non-admin write | Existing role guard denies, no settings leak | 01 |
| `SEO_ORIGIN_REJECTED` | Forged cross-origin request | Follow existing origin/CSRF contract, deny | 01 |
| `SEO_DB_UNAVAILABLE` | DB unavailable or table missing | Safe previous metadata on read; visible failure on write | 01 |
| `SEO_WRITE_CONFLICT` | Concurrent changes | Transactional safe outcome; never phantom success | 01 |
| `SEO_EMPTY_OVERRIDE` | New field blank | Fallback to exact old title/description/OG | 01 |
| `SEO_SCHEMA_UNSAFE` | Embedded `</script>` in JSON-LD field | HTML-script-context-safe serialization | 02 |
| `SEO_CRAWL_POLICY_UNSAFE` | Public rule exposes private inbox or API | Fail static policy check; don't deploy | 02 |
| `SEO_SITEMAP_INVALID` | Private/noncanonical link or fabricated lastmod | Fail test/omit entry | 02 |

## Negative test contract
Exercise anonymous/non-admin save, cross-origin request, overlong Unicode, newlines/control bytes, unsafe schemes, offsite image, path traversal, SQL/HTML/script injection, invalid page, DB outage, no-row fallback, concurrently edited record, and invalid JSON-LD; confirm prior SiteSettings, auth, media, Maildir, DNS and message records unchanged. Scope errors to their own code; no broad unplanned error-handler rewrites.

**Unknown:** Browserless 429 source not diagnosed; do not classify 429 as confirmed application regression. Every added handler's status changes from PLANNED to VERIFIED only with exact tests and SHA.
