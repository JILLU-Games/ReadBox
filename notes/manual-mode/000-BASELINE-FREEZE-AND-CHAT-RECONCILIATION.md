# 000 — Latest ReadBox baseline freeze and last-chat reconciliation

**Source freeze:** Primary vibtoolshq/ReadBox/main 2f1d16b2cd373cd332e79ddae2ef771deaf52928, Git tree 7be1bd36a312c780ea17b587f5525769fc2761d2 (2026-11-19, Asia/Dhaka). This is an immutable inspected input, not an assertion that the new documentation commit is the same SHA. All code excerpts are read-only observations pinned to this commit; any shown proposed patch is NOT applied. User-requested current scope: only the Add Domain Manual Mode checkbox for another Cloudflare account and its indispensable in-zone DNS export guard. No production operation, application code edit, schema, CI workflow, live DNS/R2/VPS or release is authorized by this documentation step.

## Immutable SHA and architecture freeze

| Subject | Verified read-only value |
|---|---|
| Primary repository | https://github.com/vibtoolshq/ReadBox |
| Inspected current main | 2f1d16b2cd373cd332e79ddae2ef771deaf52928 |
| Git tree | 7be1bd36a312c780ea17b587f5525769fc2761d2 |
| Previous focused R06 executable CI | 4d0b124af57c8d407bf609540b8b8b7a69a479b5; https://github.com/vibtoolshq/ReadBox/actions/runs/44509947742 |
| Exact primary application files observed | src/components/vcon/domain-form.tsx; src/core/dns/records.ts; src/components/vcon/dns-records-panel.tsx; src/app/(workspace)/vcon/domains/actions.ts |
| Database architecture | Single PostgreSQL/Prisma (AGENTS.md), existing Maildir + inbound-only mailserver |
| This documentation action | notes/** ONLY; source/security/runtime untouched |

The baseline source SHA is frozen even when these notes are later committed to a newer documentation-only HEAD. Do not claim that any prior CI ran on that new notes-only commit. Before future implementation, recheck HEAD and compare executable blobs with this snapshot; stop if the source changed.

## Exact latest project-chat requirement

The user's latest discussion requested a **Manual Mode — Use another Cloudflare account** checkbox on Add Domain. When ON, zone selection is skipped; **no automatic Cloudflare DNS publication**; create/save the domain using the existing manual path, then from its Edit screen provision/repair DKIM with Publish **unchecked**; existing verified root-only encrypted R2 escrow must remain mandatory; then download the Cloudflare DNS zone file, import it into the other account, inspect/rerun DNS checks and enable only after verified routing. When OFF, automatic zone selection and current automatic setup must behave exactly as before. The file must not export the central mail.anyinbox.cc A/AAAA owner into a different zone. This was a **discussion/approval-ready proposal**, not an already implemented checkbox.

## Last chat's three-domain operator evidence (not fresh inspection)

| Domain | Recorded mailbox | Operator/chat outcome | Confidence |
|---|---|---|---|
| mailiq.shop | ellis.carter43@mailiq.shop | Active; DNS verified; automatic MX/SPF/DKIM/DMARC, DKIM provisioning, 5/5 DNS inspection, Gmail -> inbox PASS | Recorded screenshot/test summary |
| softlo.com | logan.harris@softlo.com | Active; DNS verified; automatic records and Gmail -> inbox PASS | User reported two newer domains working, chat screenshot summary |
| mailvib.com | e.rodriguez@mailvib.com | Active; DNS verified; automatic records and Gmail -> inbox PASS | User reported two newer domains working, chat screenshot summary |

**Distinction:** These are prior operator/chat results and must not be relabeled as newly independently tested at 2f1d16b2cd373cd332e79ddae2ef771deaf52928. No independently accepted age/R2 disaster recovery, key custody, host restoration or formal legal signoff was established. Thus do not re-run completed domain onboarding as a mandatory Manual Mode patch prerequisite, and do not mark all original 7 production findings or 17 release gates closed.

## Invariants / hard denies

Existing three domains, bound Cloudflare zones, imported records, MX routes, DKIM private keys and R2 escrow objects, active mailboxes/messages, DNS provider accounts, auth/access, Prisma schema/migrations, Postfix/Dovecot, UI outside the Add Domain control and deployment scripts stay unchanged. No live domain add, live DNS publish, production restore, VPS, release/tag or forced Git update.
