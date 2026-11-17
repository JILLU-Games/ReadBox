# BR-005 — Actual Working vs Planned Feature Tracker

**Original audited source SHA:** `0e8a19e583719e56c054406581bedcf5599f1ace`; **BR-01 verified code SHA:** `f742231e25c5d4969d76cb5ec441b4f23eeddfc8`; **BR-02 source code SHA:** `8041efc9e9bb5c82e47c82f2dff8e69c350844cf` (tree identical to passing CI candidate `5afdd063ba90f9847fd09d9347977a61eed04b51`). `SOURCE IMPLEMENTED` means code exists, `CI VERIFIED` means disposable tests previously succeeded, `OPERATOR-OBSERVED` means supplied VPS output/screenshots (not a fresh source-side execution), and `PLANNED` means not implemented.

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
| New `/vcon/backup` UI and nav link | SOURCE + CI VERIFIED — BR-01 | `src/components/layout/app-shell.tsx:110–118`, `src/app/(workspace)/vcon/backup/page.tsx:1–9`, `src/components/vcon/backup-console.tsx:1–158`; [R-06 CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44186452845) |
| Manual UI-driven encrypted backup | SOURCE + DISPOSABLE CI VERIFIED — BR-02; **NOT VPS INSTALLED** | `src/app/(workspace)/vcon/backup/actions.ts`, `src/components/vcon/backup-console.tsx`, `deployment/backup-agent/executor.py`; [CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44198139364) |
| Persistent backup history, progress and copy logs | SOURCE + DISPOSABLE CI VERIFIED — BR-02 | `deployment/backup-agent/storage.py` atomic root-only journal, `agent.py` status/job, `src/components/vcon/backup-console.tsx`; [CI](https://github.com/JILLU-Games/ReadBox/actions/runs/44198139364) |
| Backup verification from UI | SOURCE + DISPOSABLE CI VERIFIED — BR-02 | `deployment/backup-agent/verification.py` age V2 decrypt/check; CI ciphertext tamper detection; **no restore** |
| Agent installer & IPC bridge | SOURCE + DISPOSABLE CI VERIFIED; **INSTALLER NOT RUN** | `scripts/install/readbox-backup-agent-install.sh`, `deployment/backup-agent/systemd/readbox-backup-agent.service`, Web-only `readbox_backup_ipc` mount, HMAC signed request |
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

### BR-01 actual closed
- Admin Backup nav and read-only UI: IMPLEMENTED + CI PASS at `f742231e25c5d4969d76cb5ec441b4f23eeddfc8`; existing admin guard reused, ten future action buttons disabled, no API/host operation. This is **source UI capability only**, not a connected production backup system.

### BR-02 actual closed (source, CI only)
- Local age-encrypted backup, Verify V2, durable root-only jobs/logs, private signed IPC: **SOURCE IMPLEMENTED + DISPOSABLE CI PASS** at source `8041efc9e9bb5c82e47c82f2dff8e69c350844cf` (tested identical tree). R2, auto schedules and all restore remain disabled. Opt-in host installer and live VPS integration **NOT EXECUTED**.

### BR-03 target expected
- R2 and schedule: NOT STARTED → result pending. Never upload plaintext.

### BR-04 target expected
- Isolated test restore and protected production restore *capability*: NOT STARTED → result pending. CI must not touch VPS production data.

**Summary:** BR phases `2/4` complete (BR-01, BR-02 source/CI); `2/4` remain (BR-03–04). BR-02 changes exactly 18 approved code paths plus five phase-status notes. Other ReadBox source features, production data and VPS unchanged; source CI is **not** live deployment acceptance.
