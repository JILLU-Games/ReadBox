# DOMAIN-AUTO-01 — guarded domain onboarding

**Frozen baseline:** `952516a2cac27649824bf14329f511eae6ae9294`.
Source-only implementation. A successful source/CI test is **not** proof of live
Cloudflare account access, production R2 availability, active MX routing, or
outbound DKIM signing.

## Operator workflow

1. Configure **one** Cloudflare API token in the existing private deployment
   secret `READBOX_CF_DNS_TOKEN`, scoped to the required managed zones with
   Zone:Read and DNS:Edit. Never paste the token into issues, code, logs or chat.
   The older single-zone `READBOX_CF_DNS_ZONE_ID/NAME` are not needed for this
   automatic multi-zone flow. No token means **fail closed before key generation**.
2. For each domain, set its registrar nameservers to Cloudflare and make sure the
   intended zone is **active**. The app cannot change registrar delegation.
   Configure authoritative `MAIL_HOSTNAME` and **public** `SERVER_IP` once.
   A shared central mail host outside a new zone is **not modified** by that
   zone's DNS publisher. Its existing A/AAAA must already point to the mail VPS.
3. In Admin > Domains > Add domain, leave **Automatic setup** selected and
   enter the domain name. Domain is initially disabled. The server creates the
   database/mailserver domain record and performs the following guarded steps:
   - Discover the most-specific active zone by exact Cloudflare zone names.
   - Use existing no-network DKIM agent to stage a non-rotating RSA >=2048 key.
   - Invoke the host-only backup-agent HMAC Unix RPC `dkim.escrow`, which
     calls the pinned Python `escrow.py escrow <exact domain>` as root.
   - Confirm encrypted R2 readback / immutable receipt; only then allow the
     DKIM agent to publish its public TXT. The private key never enters Web.
   - Preflight **all** desired MX, mail-host A/AAAA (when inside that zone),
     SPF, DMARC and DKIM TXT names; create **only missing non-conflicting**
     records, no updates/deletes or takeover of root website A/CNAME.
   - Read each created record back via Cloudflare; check public DNS MX and
     mail-host IP. Enable domain only when routing verifies. DNS propagation
     may leave the domain disabled/pending; inspect/recheck DNS from its page.
4. On interruption, **do not Add Domain again**. Use the existing
   **Provision / Repair DKIM** action on the saved domain. That action is
   idempotent, rechecks R2 escrow, keeps the key unchanged and rejects
   unrelated/conflicting DNS records. Uncheck publishing for escrow/public-key
   only without Cloudflare writes.
5. No delivery-signing service was installed. Current Postfix/Dovecot is still
   **inbound-only**; `DKIM signing: inactive` is expected.

## Safety and error contracts

- Only authenticated admin routes/server actions can initiate setup.
  DKIM POST requires same-origin, JSON and anti-cross-site checks. Behind the
  approved reverse proxy the HTTPS Origin must equal its Host, public site
  origin, auth origin or the direct Next URL. Arbitrary external origins fail.
- HMAC-protected, root-only `dkim.escrow` RPC accepts only a normalized
  DNS domain. The host invokes exactly one fixed script and action; it exposes
  **no** arbitrary shell, file path, credential, key content, restore or DNS
  write interface. Unexpected stderr/stdout is discarded from the response.
- `ESCROW_REQUIRED` at first agent stage is a controlled transition,
  not proof of completion. No public key until the separate root receipt
  verifies; conflicts/corrupt remote bytes stop safely.
- All existing records are preflighted before **first** DNS write. Identical
  records are re-used. Different SPF/MX/DMARC/DKIM, proxied mail A, malformed
  response, wrong zone, inactive zone or privilege error are **hard failures**.
  Cloudflare can persist a partial successful create before a later failure;
  rerun is additive/idempotent, never wholesale rollback/deletion.
- Existing Postfix/Dovecot configs, Prisma schema, backup/restore, production
  secrets, volumes, private keys, R2 objects and unrelated pages are not
  modified by this source change.
- If Cloudflare token/zone unavailable, domain creation can persist as
  **disabled** with an explicit failure code, but must not generate a new
  private key. Domain state is not lost. The saved-domain repair action resumes
  once the external prerequisite is fixed.
- `DOMAIN_AUTO01_FOCUSED_DISPOSABLE_PASS` is CI-only; **no VPS deployment,**
  **no production DNS writes, no live key generation, no release/tag**.

## Validation and recovery

Focused disposable tests mock Cloudflare and R2 orchestration boundaries and
exercise zone isolation, safe creates, unchanged existing records, SPF/DKIM
conflicts, non-proxied mail A, narrow host broker execution and redacted errors.
Typecheck and exact changed-path Scope Lock run in the dedicated source workflow.

For production use, operator must first confirm R2 credential custody, host
service deployment, authorized Cloudflare token and public mail-host DNS.
Rollout requires separate explicit approval, guarded pre-update backup,
non-force source/mirror sync, health checks and one controlled domain test.

### Non-goals

Automatic registrar nameserver delegation, certificate issuance, provider IP
reputation/PTR, outbound SMTP delivery or DKIM signing, SMTP/TLS changes,
arbitrary DNS editing, destructive DNS repair, Prisma migrations or broad UI
redesign. Existing conflicts always require an operator decision.
