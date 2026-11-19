# Domains, Manual Mode, Cloudflare DNS and DKIM

**Who can use this:** administrators. These controls live at **Admin → Mail & Domains → Domains**. ReadBox is an **inbound-only** service: DKIM private-key provisioning makes a public TXT record available but does not enable outbound signing.

## New domain: two supported paths

**Manual Mode — Use another Cloudflare account** is intended for a domain whose DNS zone is outside the configured ReadBox Cloudflare credentials. On **Add domain**, enter the bare domain name, turn Manual Mode ON, choose **Preview DNS**, review records and check **I have reviewed the DNS records** before **Add domain**. The zone selector is bypassed; there is no create-time Cloudflare DNS POST from the manual branch (`src/components/vcon/domain-form.tsx:641-665`, `src/app/(workspace)/vcon/domains/actions.ts:createDomainAction`).

**Automatic setup** is the default when Manual Mode is OFF. It requires selection of an accessible **active Cloudflare zone**. The selected zone is revalidated by exact ID before provisioning; no arbitrary other account is implicitly authorized. The automated path invokes escrow-gated DKIM provisioning and safe preflight/readback for MX, A/AAAA, SPF, DKIM and DMARC; failures leave the saved domain disabled rather than falsely reporting activation.

## Manual DKIM and DNS publication

1. Open the saved domain (**Manage & DNS**) and **uncheck** `Publish DKIM TXT to configured Cloudflare zone (otherwise manual copy)`.
2. Click **Provision / Repair DKIM**. If the checkbox remains checked with no selected zone, `Select a Cloudflare zone before publishing DNS.` is an expected refusal, not a key-generation failure.
3. After the public key is available and the escrow-gated step succeeds, download the **updated** Cloudflare zone file. The preview before provisioning may contain a noncopyable placeholder.
4. In the external account, inspect or manually import MX and TXT records. Do not replace unrelated DNS records. The MX target can be outside the domain's own zone (for example, an existing central mail hostname); **never import an out-of-zone A/AAAA owner into this domain's zone**.
5. Use **Inspect all DNS records** for a five-record status view and **Run routing check** to persist required **MX + mail-host A/AAAA** verification. Activate the domain only once routing verification succeeds.

## Record types and interpretation

| Record | Purpose | Verified by |
|---|---|---|
| MX | Where inbound mail is routed | Routing verification |
| Mail-host A/AAAA | Resolves the MX target to the expected server IP | Routing verification |
| SPF TXT | Sender policy, relevant chiefly to outbound reputation | Separate deliverability inspection |
| `mail._domainkey` TXT | Public DKIM key | Separate deliverability inspection |
| `_dmarc` TXT | DMARC policy | Separate deliverability inspection |

The green **DNS verified** badge on a domain is routing status; it is **not** automatically proof that DKIM/DMARC/SPF TXT records are publicly correct. Deleting a domain is restricted (e.g. not default/with mailboxes). Changing an established Cloudflare zone binding is refused.

**Live scope:** 2026-11-20 operator evidence showed `vibmail.my` and `pypal.pl` Active with received Gmail test mail; this is not independent authoritative DKIM TXT or full release signoff.

**Code:** `src/core/domains/service.ts`, `src/core/dns/{records,resolver,cloudflare-auto,domain-automation,dkim-provision}.ts`, `src/app/api/vcon/domains/[uuid]/dkim/route.ts`, `src/components/vcon/{domain-form,dns-records-panel}.tsx`. [Historical and live evidence](../../DOMAIN-AUTOMATION.md).
