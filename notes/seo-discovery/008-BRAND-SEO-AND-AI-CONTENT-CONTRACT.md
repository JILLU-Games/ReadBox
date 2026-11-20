# 008 — AnyInbox Brand, SEO Copy and AI-readable Facts

**AnyInbox is a branded deployment of ReadBox.** The reusable open-source ReadBox product, default site settings, repository license and documentation must not be globally renamed.

## Proposed canonical brand copy (editorial, not live until approved)
- Brand: **AnyInbox** (one word; replace inconsistent `Any Inbox` only for the AnyInbox site).
- Site origin: `https://anyinbox.cc/` (derive from verified `PUBLIC_SITE_ORIGIN`, do not hardcode across deployments).
- Primary tagline: **Your Domains. Your Inboxes. One Place.**
- Short slogan: **Email Made Simple.**
- Category: **Custom Domain Email & Inbox Management**.
- Homepage title: **AnyInbox | Custom Domain Email & Inbox Management**.
- Homepage description: **Manage custom email domains, create mailboxes, and receive messages with AnyInbox. A simple, secure platform for organized email management.**
- Homepage H1 (Phase-02): **Your Email. One Simple Workspace.**
- Footer: **AnyInbox simplifies custom-domain email management. Create mailboxes, receive messages, and stay organized in one secure, easy-to-use workspace.**
- Contact title example: **Contact AnyInbox | Custom Domain & Mailbox Support**.
- Privacy title example: **Privacy Policy | AnyInbox**; legal body unchanged unless separately approved.

## Hard claim boundaries
Actual documented workflows include inbound reception, custom-domain setup, mailbox provisioning, shared read access, safe message viewing, attachments and conditional DNS checks. The frozen `docs/users/features/mailboxes-and-inbox.md` explicitly states **NO compose/send page, SMTP submission or public IMAP/POP3**. `docs/users/features/domains-and-dns.md` says routing status does not automatically verify every SPF/DKIM/DMARC TXT record. Do not claim sending, guaranteed deliverability, unlimited storage, perfect privacy, certifications, guaranteed search ranking or AI citations.

## HTML-first and structured data
Public page body is authoritative: one concise H1, original usable copy, real feature limits, meaningful internal links. Use per-page metadata, canonical, accurate og:image when a validated public asset exists. `Organization` / `WebApplication` facts mirror visible branding; FAQ schema mirrors **the same** visible FAQ question/answer wording. Escape JSON-LD script-context safely and never allow arbitrary admin HTML. No fake ratings/reviews/prices/social `sameAs` values.

## AI discovery
Readable server-rendered HTML, clean page architecture, factual About page and normal search-engine crawling matter more than metadata tricks. `llms.txt` is optional and **out of scope**; it is not a required Google AI Search condition or an indexing guarantee. Keep `/users/`, `/vcon/`, private API, message bodies, user identities and support inquiries protected. Robots policy and private-route noindex are distinct controls; test accordingly.

No public OG asset upload/edit, new analytics tracker, search crawler API, SEO ping or content management system is authorized in planning. Phase-02 wording needs an explicit final editorial/claim check before publication.
