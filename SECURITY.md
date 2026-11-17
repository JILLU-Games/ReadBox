# Security Policy

## Supported Versions

We actively provide security patches and maintenance updates for the current release line:

| Version | Supported          | Security Status |
| ------- | ------------------ | --------------- |
| 0.1.x   | :white_check_mark: | Active Support  |
| < 0.1.0 | :x:                | Unsupported     |

## Reporting a Security Vulnerability

The **Vib Tools** team takes the security of our users and self-hosted mail infrastructure seriously. If you discover a potential vulnerability, authorization bypass, or security defect in ReadBox, please report it through private channels:

1. **Do not create a public issue.** Public disclosure exposes self-hosted servers before operators have the chance to patch.
2. **Email our security team directly:**
   - **Support & Security:** [support@vibtools.io](mailto:support@vibtools.io)
   - **General Inquiries:** [hello@vibtools.io](mailto:hello@vibtools.io)
   - **Urgent WhatsApp / Phone:** `+880 1795-470603` (GMT+6)
3. **Include the following information:**
   - Detailed description of the vulnerability and attack vector.
   - Exact steps or proof-of-concept (PoC) scripts to reproduce the issue.
   - Impacted software components, routes, or APIs.
   - Suggested mitigations if known.

### Response Commitment
- **Initial Acknowledgment:** Within 48 hours.
- **Triage & Reproduction:** Within 5 business days.
- **Patch & Disclosure:** A security advisory and patched container release will be published in coordination with the reporter.

## Security Architecture & Invariants

ReadBox implements strict defense-in-depth principles:

- **Sandboxed Email Reader:** All incoming HTML emails are rendered in an isolated `<iframe sandbox="allow-same-origin allow-popups">` with a restrictive `Content-Security-Policy: default-src 'none'; img-src data: 'self'` header. Remote scripts, forms, external tracking beacons, and parent DOM modification are blocked by design.
- **Fail-Closed Database Access:** In production (`NODE_ENV=production`), database connections fail closed with explicit `DatabaseConfigurationError` or `DatabaseUnavailableError` exceptions. Silent fallbacks to mock data or dummy accounts are strictly prohibited.
- **Argon2id Authentication:** All user and administrative credentials utilize Argon2id password hashing with IP and account lockout mechanisms to counter brute-force attacks.
- **Filesystem Path Confinement:** Every Maildir operation and attachment download enforces directory confinement checks, completely preventing directory traversal attacks (`../`).
- **Durable CSRF & Rate-Limiting:** Public endpoints, including contact submissions, validate durable CSRF tokens against PostgreSQL records and apply time-windowed IP rate limits.
- **Redacted Audit Trails:** Administrative operations, login attempts, and policy changes are logged to an append-only audit table with sensitive fields automatically redacted.

## R-06 security and release approval boundary (2026-11-17)

- **Automated CI passing is not a live production security review or release approval.** See [release governance](docs/RELEASE-GOVERNANCE.md) and [staging acceptance](docs/PRODUCTION-ACCEPTANCE-RUNBOOK.md). No production deployments, external mail sends, TLS/DNS changes, or tag/release publication occur in the R-06 workflow.
- Original findings `RB-P0-06`, `RB-P1-09`, `RB-P1-10`, `RB-P1-16`, `RB-P2-01`, `RB-P2-07`, `RB-P2-08` remain explicitly OPEN after R-05. No GO without external proof and independent human release authorization.
- Keep all staging evidence private/sanitized: redact raw emails, passwords, cookies, bearer tokens, PostgreSQL DSNs, SMTP credentials, TLS/DKIM keys, backup identities and private IP/address details. Never post live secrets in issues, Actions logs, JSON evidence fixtures or commits.
- Root ReadBox MIT and historical AGPL MailStack reference are separate legal scopes. [Provenance inventory](docs/THIRD-PARTY-PROVENANCE.md) is source-level only and not distribution clearance.
- Public SMTP is inbound-only. Do not mistake CI self-signed TLS, application readiness or a container healthcheck for independent public TCP/25/MX/PTR trust, authenticated inbox arrival, TLS renewal or mailserver integrity.
