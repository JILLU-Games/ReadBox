# 06 — Scope-Lock Guardrails & Production Cutover Checklist

Supporting operational rules to keep `Phase-01` through `Phase-06` safe, deterministic, and ready for live VPS production deployment.

---

## 1. Strict Phase Execution Guardrails

1. **One Phase at a Time:**
   - Never start `Phase-(N+1)` until `Phase-N` passes its Verification Gate and is logged in `notes/03-phase-completion-log.md`.
2. **File Allowlist Enforcement:**
   - Before editing any file, confirm its path is inside the current phase's **Scope Lock** in `notes/02-phase-roadmap-and-scope-locks.md`.
   - Never modify backend business rules, database schemas (`prisma/schema.prisma`), or unrelated modules unless explicitly required by a logged bug (`BUG-02` in `service.ts`, `BUG-03` in `demo-workspace.ts`, `ERR-01` in `live/route.ts`).
3. **Preserve Existing Business Logic & Contracts:**
   - Preserve all server action parameter/return types, API response shapes (unless fixing a verified silent-failure bug), URL routes, and role guards.
4. **Zero-Regression Verification on Every Phase:**
   - Run `npm run typecheck`, `npm run lint`, and the phase's targeted tests.
   - Visually inspect affected routes in both **Light** and **Dark** themes at Desktop (`1280px+`) and Mobile (`390px`) widths.

---

## 2. Production Cutover Checklist (After Phase-06 Complete)

Before deploying to a live VPS (`DEV_AUTH_MODE=off`):

### A. Security & Auth Environment
- [ ] `NODE_ENV=production`
- [ ] `AUTH_ENABLED=true` and `DEV_AUTH_MODE=off` (never `demo` or `bypass` in production)
- [ ] Strong random `AUTH_SECRET` configured (min 32+ bytes)
- [ ] `ADMIN_SETUP_TOKEN` / bootstrap credentials rotated after initial operator setup (`npm run auth:operator`)
- [ ] `TRUST_PROXY_HEADERS=true` ONLY behind verified Nginx reverse proxy stripping spoofed `X-Forwarded-*` headers

### B. Single PostgreSQL Database & Storage
- [ ] `DATABASE_URL` points to the single PostgreSQL instance
- [ ] `npm run db:migrate` (`prisma migrate deploy`) applied cleanly, including `mailserver` schema roles
- [ ] `MAIL_STORAGE_ROOT` and `ATTACHMENT_STORAGE_ROOT` exist on persistent disk with restricted filesystem permissions
- [ ] Backups verified for both PostgreSQL and Maildir/attachment directories

### C. Mail Server & Background Services
- [ ] Postfix (`pgsql-virtual-domains.cf`, `pgsql-virtual-mailboxes.cf`, `pgsql-virtual-aliases.cf`) & Dovecot (`99-vibmail.conf`) connected using least-privilege PostgreSQL roles
- [ ] Systemd units enabled: `vibmail-web.service`, `vibmail-ingestion.service`, `vibmail-updater.service`
- [ ] Nginx configured (`deployment/templates/nginx/app.conf.tpl`) with HTTPS/TLS, `X-Accel-Redirect` for `/_protected_attachments/`, and security headers

### D. Post-Deploy Smoke Checks
- [ ] `GET /health/live` returns `200`
- [ ] `GET /health/ready` returns `200` (`status: "ready"`)
- [ ] `/sign-in`, `/users`, `/users/mailboxes`, `/users/inbox/[uuid]`, and `/vcon/*` reload cleanly without 404 or redirect-to-home regressions
- [ ] Zero browser console errors (including CSP check on HTML email preview) in Light and Dark mode
