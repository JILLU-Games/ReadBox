---
title: "Security architecture and trust boundaries"
description: "ReadBox authentication, authorization, mail processing and privileged-host security boundaries."
order: 60
draft: false
---

ReadBox has distinct **public**, **authenticated user**, **administrator**, **mailserver** and **host-only privileged** boundaries. The source contains defense-in-depth controls; this document is not an independent penetration-test attestation.

## Identity and authorization

- Auth.js credentials are processed in `src/auth.ts` and `src/core/auth/credentials.ts`; user and admin logins have separate account tables.
- Password hashing and policy live under `src/core/auth/password.ts` and `password-policy.ts`; tokens are hashed/opaque; reset-required accounts cannot silently bypass activation.
- Auth.js JWT cookies are combined with the **database-backed session registry** in `src/core/auth/session-registry.ts` and per-request user validation. Sign-out and per-user revocation invalidate sessions.
- `src/core/auth/route-guards.ts` gates user/admin routes. Access to mailbox objects is scoped by ownership/membership, effective policy and domain allowlists.
- `AUTH_ENABLED=false` does not grant production access; unsafe developer auth bypasses are guarded by environment policy.

## Email and filesystem

- Postfix is inbound-only; its domain/mailbox lookups use least-privilege roles in the same PostgreSQL database. No open relay, submission or outbound DKIM signing is advertised.
- `src/core/ingestion/sanitizer.ts` applies HTML/CSS filtering; message HTML endpoint uses CSP, no-store and frame restrictions. Potentially unsafe external resources are not trusted by default.
- Maildir/attachment handling uses confined paths, safe filenames, hashes, atomic storage and per-object authorization. The attachment route returns a uniform 404 for absent or unauthorized objects.
- Docker web and worker images are non-root; root-only operations are delegated to isolated host processes.

## DNS, backup and update

- Automatic Cloudflare DNS operations are scoped to explicitly validated active zone IDs, with conflict refusal and readback. Manual Mode must leave Cloudflare publish disabled when using another account.
- DKIM public key release is guarded by an encrypted offsite escrow receipt; private key material stays out of public DNS, web responses and Git source.
- The backup broker's Unix socket requires client peer identity plus HMAC timestamp/nonce. R2 credentials are encrypted on disk and never returned in full from status APIs.
- Production restore is separately gated, requires an ephemeral permit and rollback archive; updater refuses unsafe Git remotes/dirty trees/concurrent backups and creates an Age encrypted snapshot before code update.
- Public contact forms use anti-replay CSRF, input validation and rate limiting; audit targets/details are sanitized.

## Residual risks and non-claims

The 2026-11-20 operator Manual Mode test evidenced basic inbound delivery to two domains; it did **not** independently prove authoritative DKIM TXT, all TLS/PTR/IPv6 paths, complete R2 restore, recovery under outages, MIME attachment matrices or the 17 formal stable-release gates. The root ReadBox MIT license does not automatically relicense historical AGPL reference files under `reference/MailStack`; human provenance/distribution review remains open.

**Source:** `src/auth.ts`, `src/core/{auth,accounts,audit,dns,ingestion,messages,backup,updates}/`, `deployment/backup-agent/`, `docs/THIRD-PARTY-PROVENANCE.md`. See [release acceptance](https://github.com/vibtoolshq/ReadBox/blob/main/docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md).
