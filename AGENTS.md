## Database Policy (Authoritative)

ReadBox uses exactly one PostgreSQL database for all application and database-backed mail-server management data. Prisma remains the application ORM. Any future Postfix/Dovecot database integration must use this same PostgreSQL database, with separate schemas and least-privilege roles where supported, and only after the installed versions, configuration, schema, and lookup contract are verified. Do not add or connect MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain filesystem data. Legacy multi-database descriptions in project documents are historical/source context only; they are not the target architecture or authorization to add another database.

## Scope-Locked Production Phase Implementation Rules (Authoritative)

- Every phase follows notes/000-BASELINE-FREEZE.md, notes/001-PRODUCTION-RELEASE-BLOCKERS.md, and notes/002-PRODUCTION-PHASE-ROADMAP.md. Work only on the phase's enumerated findings and allowlisted file/contract sections; do not expand scope silently.
- Preserve all existing app UI/UX, screens, routes, authentication/authorization, data, and unrelated features unless a specifically approved finding requires a narrow change. Never edit an already applied Prisma migration; keep exactly one PostgreSQL database.
- Finish all scoped code/config/test patches together. **Run one focused verification pass for the completed phase**, followed by one patch/scope audit. Do not launch recurring test loops or unnecessarily repeat the same CI commands. A failing focused test may receive only the minimal scoped repair and a necessary recheck; never mark a failing phase successful.
- At phase closure, update notes/003 (progress), notes/004 (error handling), notes/005 (actual working), and notes/006 (release gates), with exact tested SHA, CI run URL, negative cases and real-vs-unverified behavior. Record completed/remaining phases and the next already documented phase. GitHub source and mirror must be synchronized to the **same commit SHA**, preserving history with fast-forward only.
- GitHub Actions is the default automated verification method; one bounded CI run per phase where possible. No live sending, destructive VPS action, deployment, release/tag, or secret operation without explicit authorization. All production mailserver GO gates remain NO-GO until actual staging evidence exists.
- The implementation phase requires user authorization each time. Explain exactly what changed, what was fixed, what remained unchanged, and give one short copy-ready approval prompt for the next phase. Do not misrepresent plans or CI-only results as production-ready.

## Mandatory Compact Phase Execution — One Verification, One Closure

These rules are authoritative for all future ReadBox updates, fixes and features, including work delegated to AI agents.

1. **Scope Lock first:** audit the actual frozen source and the currently approved phase allowlist. Make all approved edits together; never alter an unrelated feature, screen, authentication, PostgreSQL schema, mailserver, production data or deployment without explicit authorization.
2. **One focused verification per completed phase:** after implementing the scoped patch, run one appropriate bounded disposable/local-or-CI verification and one exact changed-path/security audit. Do not create a chain of repeated, redundant verification loops, rerun unchanged successful tests, or stretch one phase with unrelated checks.
3. **Failures must be fixed, not ignored:** when that focused verification reveals a specific defect, make only the minimal in-scope correction and **one necessary focused recheck of that failure**. If still blocked, record an accurate FAIL/BLOCKED result and close the attempt without claiming success or expanding scope. Never mark failing security checks PASS.
4. **Close immediately after evidence:** record exact source SHA, CI/job result, modified paths, safety findings, implemented versus unverified features, remaining blockers and source/mirror SHA parity in the approved phase notes; commit and perform non-force exact sync. Do not delay closure for optional repeated testing. If verification or sync is blocked, report it explicitly and do not claim a fully closed phase.
5. **Next phase requires user approval:** provide a compact phase summary and one short copy-ready next-phase command. No unapproved VPS action, live sending, restore, release/tag or production credential use. Avoid time-consuming verification for its own sake.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
