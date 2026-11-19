---
title: "Public website and contact inquiries"
description: "Manage the ReadBox public website, branding, contact form, and administrator inquiries."
order: 60
draft: false
---

ReadBox includes public pages, even when the mailbox workspace requires authentication.

| Public route | Purpose |
|---|---|
| `/` | Product overview, workspace and sign-up links |
| `/contact` | Contact/support inquiry form |
| `/privacy` | Privacy information using configurable site settings |
| `/sign-up` | Account registration when enabled by administrator |
| `/sign-in` | User sign-in |
| `/vcon/login` | Administrator sign-in |

The public site reads branding, support address, footer content and allowed links from the **Admin → Settings** record. The public settings endpoint returns a formatted safe subset, not admin credentials.

## Contact form behavior

The browser obtains a CSRF token from `GET /api/contact/csrf` and submits JSON to `POST /api/contact` with the `x-readbox-csrf` header. Server-side validation checks request size, timing, rate limits, fields and CSRF replay prevention before recording an inquiry. A 403 security-token failure asks the visitor to reload; do not bypass it.

Administrators review inquiries at **Admin → Users & Security → Contact inquiries**, including submitted time, sender, organization, topic, message preview and a detail dialog. Contact submissions are not equivalent to mailbox emails and are not an SMTP send/relay feature.

## Branding and data

**Admin → Settings** supports logo, favicon, site name/tagline, contact details, footer text and public links. The server restricts media paths/MIME types and size (logo max 5 MiB, favicon max 512 KiB). Public media is served through `/api/media/[...path]` with confined-path handling and security headers.

**Source:** `src/app/{page,contact/page,privacy/page}.tsx`, `src/core/contact/service.ts`, `src/app/api/contact/{route,csrf/route}.ts`, `src/core/settings/service.ts`, `src/components/public/`, `src/components/vcon/inquiries-console.tsx`.
