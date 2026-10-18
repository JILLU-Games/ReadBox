# MailStack Security Review for Node.js Migration

> **Authoritative database policy:** ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, after installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem. Any legacy multi-database descriptions below are historical/source context only and are superseded as target architecture.

## Scope and Security Posture

This review describes the inspected reference design and migration risks; it is not a penetration test or a claim that production was accessed. The existing platform is receive-only for hosted mailboxes. Postfix accepts inbound SMTP and validates recipients; Dovecot is configured for LMTP delivery; public SMTP submission, IMAP, POP3, open relay and public registration are not part of the reviewed contract.

The source documents and templates establish useful controls: application object scoping, Argon2, CSRF, login throttling, HTML/CSS sanitization, confined attachment/Maildir paths, least-privilege MariaDB grants, systemd confinement, protected secrets, checksummed backup/restore and verified update assets. The Node migration must preserve these as behavior, not merely copy the UI.

## Local Development Route Protection

`AUTH_ENABLED=false` remains the default. Workspace routes `/users` and `/vcon` require an active authenticated user; `/vcon` additionally requires `isStaff` or `isSuperuser`. With authentication disabled, protected routes redirect to `/sign-in`, whose credential form remains unavailable. This intentionally makes workspace pages inaccessible in the default local mode rather than bypassing authorization. Sign-in, operator-token password reset, Auth.js endpoints and health checks remain outside the protected workspace route group. Protected-route redirects use the fixed local sign-in path and do not accept a return URL.

## Verified Trust Boundaries

| Boundary                      | Current control/contract                                                                                                                    | Migration requirement                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Internet SMTP -> Postfix      | Port 25 only; recipient validation via MariaDB maps/views; no SMTP AUTH/open relay.                                                         | Do not route inbound mail through Next.js or add submission/relay capability.                                                 |
| Postfix -> Dovecot -> Maildir | LMTP Unix socket; `vmail` ownership; canonical domain/local-part path.                                                                      | Preserve views, paths, ownership and LMTP service; test active/disabled/unknown recipients.                                   |
| Postfix DB lookup             | Dedicated read-only account; column-scoped access through `SQL SECURITY INVOKER` views; no password hash.                                   | Preserve account separation and exact grants; Node adapter must not reuse the Postfix account.                                |
| Node app -> application DB    | Target is PostgreSQL/Prisma.                                                                                                                | Keep app SQL parameterized; use role separation and schema migrations; no secrets in logs.                                    |
| Node app -> mail-server DB    | Existing MariaDB rows/views remain operational and are modified for mailbox provisioning/status.                                            | Separate credentials/driver and least privilege; validate identifiers, bind values, prevent cross-DB transaction assumptions. |
| Browser -> web app            | HTTPS via Nginx, Unix socket, CSRF/session/security headers, object-scope access.                                                           | Preserve host/origin validation, secure cookies, CSRF, rate limits, safe redirects and anti-enumeration behavior.             |
| Web app -> attachments        | Authorization then confined storage path; optional internal Nginx `X-Accel-Redirect`; no-store/nosniff.                                     | Never expose filesystem paths or mount protected storage as public static content.                                            |
| Public contact -> sendmail    | Separate Unix-socket service, dedicated user, restricted address family, fixed executable/recipient, timeout.                               | Keep it separate from Next request privilege; no user-controlled shell/command/recipient.                                     |
| Web admin -> root updater     | Authenticated admin queues a strict atomic request; root worker validates ownership/mode and official GitHub URLs; verified upgrade script. | Never run updater as Next user or accept arbitrary URLs/commands; keep root worker isolated and checksum/archive gates.       |
| Operators/backups             | Root-owned environment/credential files; coordinated service stop/restore; hashes and unsafe-tar rejection.                                 | Extend to PostgreSQL without omitting existing MariaDB, Maildir, attachments, contact DB, config or service-state contracts.  |

## Security-Critical Behavior to Preserve

- User roles are active Django staff/superusers; mailbox access is derived from memberships, with admins seeing all non-deleted records. Message and attachment lookups must use the same mailbox-scoped authorization, not UUID alone.
- Login failure lockout uses normalized username and client IP. Proxy headers are trusted only when configured behind the known reverse proxy. Client-supplied forwarding headers must not be trusted directly.
- Normal pages use a nonce-bearing CSP and secure headers. Sanitized message HTML has a stricter CSP, no script permission, limited data images, same-origin framing sandbox in the template, and no referrer. Preserve exact behavior under regression fixtures.
- Sanitizer behavior is a security boundary: only configured tags/attributes/protocols, no remote images, no active blocks, bounded CSS input/output/rules/nesting, and strict CSS property/function allowlists. A generic HTML sanitizer replacement alone is not equivalent.
- Attachment names are normalized; stored files use random names and private modes; storage paths are root-confined; download content type is octet-stream with safe disposition, `nosniff`, and private/no-store.
- Maildir scans must reject symlinks/out-of-root paths, not mutate source files, and use a stable idempotency key plus hash to recover after restart.
- Audit detail values are recursively redacted. Current audit persistence is best-effort on database failure, with an error log; operational requirements must decide whether Node keeps this failure mode or requires a separate durable fallback.
- Contact requests consume one-use CSRF before validation, apply size/field/consent/honeypot/timing checks and hash IP/email identifiers for limits. The database contains contact names, email, company, phone and message in plaintext; backups therefore require restricted access, encryption and retention policy.
- Health readiness currently reveals only coarse check status, while Nginx restricts the production ready route to loopback. Preserve both response privacy and the network restriction.
- DNS management has two levels of checking: the admin record-status endpoint reports all generated MX/A-or-AAAA/SPF/DKIM/DMARC records; domain activation check currently verifies expected MX and that the configured mail host resolves. Do not present one result as proof of the other.
- The requested authenticated-app PWA is new relative to the inspected Django app. The public site has a web manifest, but no app manifest link or service-worker registration was found. Service-worker cache rules must exclude authenticated HTML, mail, attachments and APIs.
- The requested Segoe UI-only interface differs from current Inter/system font tokens. Segoe UI is not guaranteed on a clean Ubuntu deployment; do not download or bundle it without license review. Document and test fallback behavior.

## Findings and Migration Risks

### High: split-database operation is not atomic

Current mailbox/domain workflows coordinate filesystem, app MariaDB and mail-server MariaDB. Replacing app MariaDB with PostgreSQL creates a third system of record for lifecycle operations. A PostgreSQL rollback cannot undo a MariaDB change or a Maildir action. Implement a lock/idempotent state machine, compensation and reconciliation tooling; test failures after each external side effect.

### High: live mail and application data have different sources of truth

Maildir is authoritative, whereas indexed bodies/metadata and extracted attachments are derivative. A database-only restore may omit new mail or desynchronize counters; a pre-upgrade Maildir restore can discard mail accepted after backup. Keep Postfix/Dovecot online during app maintenance, ingest the final Maildir delta before reopening the UI, and define coordinated recovery.

### High: auth migration can lock out all users

Django password strings use Django's encoded Argon2 format and user flags determine admin access. Verify the exact encoded format with the proposed Node verifier before importing. If verification is not demonstrably compatible, explicitly approve password reset and secure admin bootstrap; never silently transform hashes. Existing sessions may rely on Django's signing secret and should be invalidated or migrated by an explicit design.

### High: privilege escalation exposure through updates

The current root updater downloads release assets and executes an upgrade script. Preserve strict official-origin checks, checksum/archive verification, exact request keys, owner/mode checks, locking, migration acknowledgment, and systemd write confinement. A Next route must only enqueue a narrow request and must never run shell commands or gain root access.

### High: migration may weaken message HTML/attachment protections

MIME parsing and the sanitizer contain custom recovery and resource-loading controls. Parser/sanitizer library behavior changes can introduce XSS, remote tracking, resource exhaustion or broken business mail. Pin reviewed libraries and require original-fixture differential tests plus browser tests for CSP/sandbox behavior before shadow ingestion.

### Medium: collation/constraint drift

MariaDB `utf8mb4_unicode_ci` and explicit lower-case unique constraints are not PostgreSQL's default behavior. Case-only duplicate addresses, Unicode normalization, length limits and NULL semantics can cause rejected imports or duplicate entities. Preflight duplicates and test database constraints before cutover.

### Medium: backup/restore path assumes Django + MariaDB today

Current scripts dump the application and mail schemas from MariaDB and execute Django management commands during restore. They are not PostgreSQL-ready. Do not cut over until the new scripts create verified PostgreSQL backups, restore all dependent storage/configuration, validate checksums and restore services safely.

### Medium: contact data and delivery semantics

Contact submission and notification are synchronous; SQLite records pending/sent/failed state and failures return 503. Moving it into the main Next process/database changes isolation and failure coupling. Preserve the separate service boundary and fixed sendmail behavior; approve any storage consolidation and retention changes separately.

### Medium: PWA cache could expose mailbox data

A service worker can outlive logout and serve cached responses to the next browser user. Scope caching to fingerprinted public assets and a generic offline response; use network-only/no-store for all authenticated/app/API/message/attachment paths. Test cache contents after login/logout and service-worker update.

### Medium: font distribution and runtime availability

The desired Segoe UI font is proprietary and may not exist on a clean Ubuntu host. Use the named font only when provided by the operating system/user environment; do not package or download it without legal approval. Test documented fallback on Linux, Windows and macOS.

### Medium: observed source/document contract discrepancies

- `soft_delete_mailbox()` and `deleted` status exist, but current web delete routes call permanent `purge_mailbox()`.
- `rebuild_missing` is recorded in heartbeat details but does not select a separate code path in the ingestion scan.
- Source version files report `1.3.5.5`, while some documentation text references older release lines.

Resolve these before acceptance tests are frozen; do not silently choose the more destructive or more feature-rich interpretation.

## Operational Dependencies and Configuration

The supported source installation is a clean Ubuntu Server 24.04 LTS single-node host with root/sudo, inbound TCP 25/80/443, public A/AAAA and MX records, working PTR/rDNS review and a provider allowing inbound SMTP. Nginx terminates TLS and proxies the app over a Unix socket. systemd supervises app, ingestion, contact and updater; MariaDB/Postfix/Dovecot/Nginx remain host services.

Installer-generated protected settings include hostnames, database credentials, storage roots, size/worker limits, session/login limits, proxy trust and log paths. Only placeholders are committed in example files. Production settings validate domains, IPs, absolute paths and SQL identifiers. Domain changes after mailboxes exist are a migration, not a simple env update.

SPF/DKIM/DMARC and PTR/rDNS are operational deliverability dependencies; the base installer does not automatically manage all provider-side DNS/reputation concerns. HSTS uses a one-year policy with subdomains/preload flag in the documented reference; review every subdomain before any separate preload-list submission.

## Required Security Acceptance Tests

- [ ] Authentication/role/membership matrix: anonymous, inactive, admin, assigned user, unassigned user; inaccessible objects return non-enumerating responses.
- [ ] CSRF, session cookie flags/expiry, safe redirect, host/origin validation, trusted-proxy behavior and login throttling.
- [ ] Sanitizer corpus: script/style/event handlers, CSS `url`/imports/unsafe functions, external images, data images, malformed HTML/MIME and link protocols; no external request from rendered content.
- [ ] Path traversal, symlink, malformed UUID and attachment filename/header injection tests; no protected bytes/paths leak.
- [ ] Mail server SQL identifier injection tests; values parameterized; Postfix account read-only; app MariaDB account limited to required columns.
- [ ] Mail flow: known, disabled, unknown and alias recipient behavior; no SMTP AUTH, submission, IMAP, POP3 or relay.
- [ ] Ingestion restart/duplicate/oversize/parser error tests; lock exclusion; read-only source; bounded memory and safe attachment cleanup.
- [ ] Contact CSRF reuse/expiry, JSON size, spam/time checks, exact rate thresholds, fixed sendmail target, delivery failure persistence and socket/process identity.
- [ ] Contact CSRF reuse/expiry, JSON size, spam/time checks, exact rate thresholds, fixed sendmail target, delivery failure persistence and socket/process identity.
- [ ] Service-worker cache inspection proves no authenticated HTML, mailbox/message body, attachment or API response is cached; logout followed by a shared-browser user cannot reveal prior content.
- [ ] Light/dark contrast, keyboard focus and Segoe UI/fallback behavior pass on supported desktop/mobile browsers and clean Ubuntu deployment.
- [ ] Update request traversal/origin/checksum/archive/mode/owner/migration tests; prove web process cannot execute root operations.
- [ ] PostgreSQL/MariaDB/mail-storage backup restore, checksum validation, unsafe archive rejection, permissions and post-restore mail delivery.
- [ ] Dependency audit for locked Node runtime and build dependencies; review licenses and release archive content.

## Residual Risk Statement

This source review did not access a production host, validate live DNS, run SMTP/LMTP acceptance, restore a production backup, or execute the original test suite. Existing repository docs report historical test/CI evidence, but those claims were not rerun for this audit. Production acceptance remains an explicit later gate.
