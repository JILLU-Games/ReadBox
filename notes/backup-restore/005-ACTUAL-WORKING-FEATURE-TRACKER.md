# 005 — Feature truth table by exact source state

| Feature | Actual MAIN at `c08b9cd77ec3` | BR-03 CANDIDATE at `b8f3fc662d38` | VPS / real R2 |
|---|---|---|---|
| Existing Inbox/auth/navigation/mailserver | Existing sources preserved | Unchanged by 14-path BR-03 patch | NOT retested here |
| Admin Backup route / admin guard | Exists (`page.tsx`) | Unchanged route | Agent on VPS NOT tested |
| Local age encrypted backup | BR-02 source+CI | Existing code retained; disposable regression PASS | Not installed by this work |
| V2 local age verification / job logs | BR-02 source+CI | Retained, disposable PASS | Live status unknown |
| R2 credential form/rotation | Not implemented | `actions.ts`, `backup-console.tsx`, `r2.py` | Real account **NOT TESTED** |
| Encrypted host R2 configuration AESGCM | Not implemented | `r2.py` source + mock test | Host runtime dependency gap OPEN |
| R2 test (list/PUT/GET/DELETE own probe) | Not implemented | Mock test PASS, TLS derived account endpoint | Real connection not verified |
| Manual V2-verified age upload to R2 | Not implemented | R2 fake S3 test PASS incl remote streamed SHA256 | Not deployed |
| Remote history | Not implemented | Owned prefix first 100 objects, return up to 30 | Pagination missing |
| Automatic backup UTC schedule | Not implemented | default OFF, 6/12/24h; in-process 15s tick mock test | Timer not installed; real host untested |
| Auto R2 upload after local backup | Not implemented | Best-effort enqueue; durable handoff gap | Not accepted |
| Local retention | Not implemented | Optional local-only, default OFF; >=3 local, verified remote prerequisite | Real safety untested |
| Remote R2 retention/deletion | Not implemented | **NOT IMPLEMENTED — no bulk/delete-by-prefix** | Not approved |
| R2 upload bounded retry/backoff | Not implemented | **NOT IMPLEMENTED** | Blocker |
| UI test restore | Not implemented | Not implemented; buttons disabled | BR-04 only |
| Guarded production restore | Not implemented | Not implemented; buttons disabled | **NOT AUTHORIZED** |
| GPG legacy conversion | Not implemented | Not implemented | Existing encrypted GPG ≠ age format |

**CI evidence:** [#44203727204](https://github.com/JILLU-Games/ReadBox/actions/runs/44203727204) tests pinned SDK installation, frontend/auth/UI lint+typecheck+build, fake R2 failures, UTC schedule tests, disposable BR02 encrypted snapshot and R05 restore/rollback. **No live Cloudflare bucket or VPS probe.** Source/main and mirror were both `c08b9cd77ec30afc50fe36952eecb982ba90a982` at audit time; candidate is not merged.

**User-facing benefit after accepted/deployed BR-03 (future):** UI-driven R2 offsite encrypted backup without manual WinSCP. Do **not** promise until dependency install, resilience and R2 operator verification are explicitly completed.
