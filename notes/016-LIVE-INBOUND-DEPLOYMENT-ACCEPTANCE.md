# 016 — Authorized live inbound deployment: observed acceptance (2026-11-18)

This note records results from operator-provided PuTTY output and screenshots, **not a fresh independent audit**. No raw SMTP bodies, passwords, authentication secrets, PII-rich log files, TLS private keys or backup archives are stored here.

| Check | Operator observation | Evidence scope |
|---|---|---|
| Source and mirror | Both `main` SHA `0849bc8d4f4b703800ba73f157f16d5a742ee6e7` at inspection | GitHub HEAD comparison before this documentation commit |
| HTTPS | `/health/live` HTTP 200, TLS previously checked | Liveness only; not equivalent to `/health/ready` |
| Five Compose services | PostgreSQL/web/worker/Dovecot/Postfix healthy after backup | One VPS snapshot |
| Public SMTP | `173.212.201.250:25`, STARTTLS PASS | Tested from the VPS, not a second independent external probe |
| SMTP security | Nonlocal RCPT `554`; unknown local RCPT `550` | Only those two negative cases |
| Real inbound mail | Gmail-sent “ReadBox External Gmail Test 01” displayed with subject, body, date in authenticated inbox | One successful message; no attachment digest or broad MIME/size negatives |
| System mailboxes | `postmaster@anyinbox.cc` and `abuse@anyinbox.cc` active; one user mailbox active | Dashboard screenshots; assignment/monitoring not validated |
| Local backup | `/var/backups/readbox/20261117T205245Z`, SHA-256 PASS, `pg_restore -l` readable | Backup archive consistency; **not** actual restore |
| Encrypted local archive | `/var/backups/readbox-encrypted/20261117T205245Z.tar.gz.gpg`, owner root mode 0600; symmetric AES256 encryption + decrypt/list PASS | **No** encrypted offsite copy, disaster recovery or isolated restore |
| Operational state | Installation phase manually closed for inbound use | **Not** a formal production release GO |

## Release decision

**R-06 formal production NO-GO remains in force.** Keep the original 32-finding register, seven OPEN entries and 17-gate acceptance contract unchanged until individually evidenced and independently reviewed. This note does not claim all 17 PASS and is not a signed production acceptance report.

Next-phase work: offsite encrypted backup strategy, isolated restore/rollback, monitored capacity/alerting, evidence reconciliation, provenance and dependency signoff, then a separately approved stable release. Avoid repetitive verification loops; one targeted verification per scope-locked phase.
