---
title: "Contributing to ReadBox safely"
description: "Source change control, repository mirrors, documentation standards and licensing boundaries."
order: 90
draft: false
---

ReadBox's root `AGENTS.md` governs all implementation work. Read it with `CONTRIBUTING.md`, `SECURITY.md` and the evidence notes before changing runtime behavior.

## Change workflow

1. Freeze the current authoritative `vibtoolshq/ReadBox` source SHA and confirm the target branch/worktree state.
2. Define the exact change, defect or documentation boundary. Enumerate file allowlist, protected behavior and explicit non-goals.
3. Inspect existing page/action/service/DB contracts before editing. Preserve Next.js user/admin role boundaries and the **single PostgreSQL** database policy.
4. Implement only the approved scope. Never modify applied migrations or existing private host credentials as a side effect.
5. Run **one appropriate focused test batch**, then one changed-path and security review. If a test fails, make only the minimal scoped correction and one necessary recheck.
6. Record what was verified versus not run, including exact SHA/CI job URL for executable changes. Do not mark source-only checks as production acceptance.
7. On explicit authorization, commit and perform **non-force same-SHA** source/backup synchronization. The designated backups are dedicated `backup/dns-final-primary-20261119` branches, not necessarily the backup repositories' `main`.
8. Treat stable release, live VPS, public DNS and restore as separate approvals and independently accepted operations.

## License and attribution

The root ReadBox source declares MIT licensing. The retained `reference/MailStack` contains independently licensed AGPL material and notices. Do not silently copy from that tree into the active runtime or distribute bundled reference material without the human provenance/distribution review documented in `docs/THIRD-PARTY-PROVENANCE.md`.

## Documentation contributions

Use `docs/index.md` and `docs/MANIFEST.md` as the current navigation; cite actual source paths and symbols; distinguish implementation, CI, operator observation and unverified scope. Historical planning materials should be clearly labeled as historical, not erased or rewritten to imply work was already performed.

**Source:** `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `docs/THIRD-PARTY-PROVENANCE.md`.
