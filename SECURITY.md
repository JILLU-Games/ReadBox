# Security Policy

## Supported Versions

We provide security patches and updates for the active release line:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

The ReadBox project takes the security of our users and their communication data seriously. If you discover a security vulnerability or suspect an authorization flaw, please report it responsibly:

1. **Do not create a public GitHub issue.** Public issues disclose vulnerabilities before patches can be developed.
2. Email the maintainers directly at: **security@readbox.local** (or submit via the administrator contact portal).
3. Include detailed reproduction steps, proof of concept (if applicable), and affected component versions.
4. Maintain confidentiality until an advisory and fix have been published.

We acknowledge security reports within 48 hours and work with reporters to coordinate responsible disclosure.

## Security Architecture & Defenses

ReadBox incorporates multiple defense-in-depth mechanisms:

- **Isolated Email Rendering:** User messages render inside a restricted `<iframe sandbox="allow-same-origin allow-popups">` governed by strict `Content-Security-Policy` headers, preventing client-side script execution and cross-site scripting (XSS).
- **Argon2id Authentication:** All user and administrative credentials use Argon2id password hashing with brute-force lockout protection.
- **Fail-Closed Database Access:** The application fails closed in production when the PostgreSQL database is unreachable or misconfigured, preventing silent fallback to unauthenticated mock state.
- **Path Confinement:** Filesystem operations on Maildir storage and attachment files enforce strict boundary checks to prevent path traversal attacks.
- **Rate-Limiting & CSRF Protection:** Public-facing endpoints (such as contact inquiries) enforce single-use CSRF tokens and database-backed rate-limiting to prevent automated abuse.
- **Audit Trails:** Administrative operations, login attempts, and policy changes are logged to an immutable audit table with sensitive fields automatically redacted.
