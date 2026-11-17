# BR-005 — Actual Working vs Planned Feature Tracker

**As-of audited SHA:** `0e8a19e583719e56c054406581bedcf5599f1ace`; **this is documentation-only**. `SOURCE IMPLEMENTED` means code exists, `CI VERIFIED` means disposable tests previously succeeded, `OPERATOR-OBSERVED` means supplied VPS output/screenshots (not a fresh source-side execution), and `PLANNED` means not implemented.

| Feature | Status | Exact grounding / evidence boundary |
|---|---|---|
| Existing admin grouped sidebar | SOURCE IMPLEMENTED | `src/components/layout/app-shell.tsx:65–118` |
| Administrator route gate | SOURCE IMPLEMENTED | `src/app/(workspace)/vcon/layout.tsx:4–8` |
| Existing superuser helper | SOURCE IMPLEMENTED | `src/core/auth/current-user.ts:114–118` |
| Existing operations page/actions | SOURCE IMPLEMENTED | `src/app/(workspace)/vcon/operations/page.tsx:35–57`; `actions.ts:56–78` |
| Existing audit redaction | SOURCE IMPLEMENTED | `src/core/audit/record.ts:14–31` |
| Existing Docker data stack | SOURCE IMPLEMENTED | `docker-compose.yml:15–273` |
| Existing R-05 age encrypted Compose snapshot | SOURCE + CI VERIFIED (disposable) | `deployment/operations/compose_recovery.py:166–210,296–304`; `r05-rehearsal.sh:48–51` |
| Existing R-05 age restore with rollback | SOURCE + CI VERIFIED (disposable) | `deployment/operations/compose_recovery.py:307–336`; `r05-rehearsal.sh:65–128` |
| Public Gmail mail receipt | OPERATOR-OBSERVED | User-provided authenticated inbox screenshots; not re-tested in this documentation task |
| Current local GPG encrypted backup | OPERATOR-OBSERVED | `/var/backups/readbox-encrypted/20261117T205245Z.tar.gz.gpg` created and decrypt-listed earlier; not in tracked source |
| New `/vcon/backup` UI and nav link | PLANNED — BR-01 | Not in source tree |
| Manual UI-driven encrypted backup | PLANNED — BR-02 | Host agent required |
| Persistent backup history, progress and copy logs | PLANNED — BR-02 | Current update UI React logs are volatile |
| Backup verification from UI | PLANNED — BR-02 | No agent API yet |
| Agent installer & IPC bridge | PLANNED — BR-02 | No `deployment/backup-agent` yet |
| R2 add/edit/rotate/test credentials | PLANNED — BR-03 | No R2 implementation in tracked app |
| R2 manual/automatic upload and history | PLANNED — BR-03 | No R2 implementation |
| Automatic backup schedule, retention | PLANNED — BR-03 | No backup timer/scheduler in tracked app |
| Isolated UI-initiated test restore | PLANNED — BR-04 | Existing R-05 CI script is CLI-only |
| Guarded actual production restore | PLANNED — BR-04, **not enabled** | Host agent, confirmation, rollback and external acceptance required |
| Existing legacy GPG backup direct production restore | UNSUPPORTED UNTIL PROVEN | `age` R-05 engine cannot decrypt `.gpg` artifact |
| Complete host disaster recovery | NOT VERIFIED | Existing snapshots exclude app env/host config/TLS; offsite + real restoration not demonstrated |
| All R-06 stable production gates | NOT COMPLETE | Existing prerelease remains non-stable and no new GO claimed |

## After each implementation phase

Update only features with proof: `status` → `commit SHA` → `CI job URL / exit` → `disposable or authorized real test` → `known limits`. Never infer production-ready from mock data, React UI render, code merged, or a single checksum pass.

### BR-01 target expected
- Admin Backup nav and read-only UI: NOT STARTED → implementation/test result pending. Keep all action buttons disabled until agent integration.

### BR-02 target expected
- Local encrypted backup, Verify, durable jobs/logs, private IPC: NOT STARTED → result pending. No R2/restore production.

### BR-03 target expected
- R2 and schedule: NOT STARTED → result pending. Never upload plaintext.

### BR-04 target expected
- Isolated test restore and protected production restore *capability*: NOT STARTED → result pending. CI must not touch VPS production data.

**Summary:** planned BR phases `0/4` complete; `4/4` remain; existing ReadBox features unchanged by documentation.
