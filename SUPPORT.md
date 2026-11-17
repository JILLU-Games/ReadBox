# Getting Support for ReadBox

Thank you for choosing **ReadBox**, open-source software by **[Vib Tools](https://vib.tools/)**. We provide multiple support channels for operators, self-hosters, developers, and teams.

---

## 1. Official Documentation & Self-Help

Before opening a ticket or reaching out, review the documentation resources:

- **[README.md](README.md):** Quickstart guide, Docker Compose and Coolify deployment instructions, and core features.
- **[SECURITY.md](SECURITY.md):** Security practices, vulnerability reporting, and architecture invariants.
- **[CONTRIBUTING.md](CONTRIBUTING.md):** Development setup, local testing, and pull request procedures.
- **`docs/` Directory:** Detailed architectural blueprints, data models, and migration guides.

---

## 2. Community & Public Support

- **GitHub Discussions:** Join discussions, share self-hosted deployment architectures, and ask questions in [GitHub Discussions](https://github.com/vibtoolshq/readbox/discussions).
- **GitHub Issues:** If you have discovered a reproducible bug or wish to propose an enhancement, submit a report via [GitHub Issues](https://github.com/vibtoolshq/readbox/issues).

---

## 3. Direct Support from Vib Tools

For technical assistance, corporate deployments, integration inquiries, or direct help from the development team:

- **Product Support Email:** [support@vibtools.io](mailto:support@vibtools.io)  
  *Use for technical questions, setup assistance, and troubleshooting.*
- **General Company Inquiries:** [hello@vibtools.io](mailto:hello@vibtools.io)  
  *Use for partnerships, press, and organizational inquiries.*
- **Phone / WhatsApp Support:** `+880 1795-470603`  
  *Business hours: GMT+6 (Asia/Dhaka timezone).*
- **Head Office:**  
  Vib Tools HQ  
  5660 Kochakata, Nageswari  
  Kurigram, Rangpur  
  Bangladesh

---

## 4. Common Troubleshooting Quick Tips

### A. Database Connection Refused
If ReadBox displays a database unavailable banner in production:
- Ensure the `DATABASE_URL` environment variable is defined and reachable from the container.
- For Docker Compose, verify the `db` service is healthy: `docker compose ps`.
- Check database credentials and confirm the PostgreSQL database port is accessible.

### B. Ingestion Worker Not Running
If new incoming emails are stored on disk but not appearing in the user workspace:
- Confirm the `worker` service is active in Docker Compose: `docker compose logs worker`.
- Check `/health/ready` — it reports the last heartbeat of the Maildir ingestion process.
- Verify that the `readbox_vmail` volume mount is shared between Postfix/Dovecot and the worker container.

### C. Updating System in Container Mode
In Docker Compose or Coolify:
- The `/vcon/system-update` dashboard automatically displays container orchestrator status.
- Deploy new versions by rebuilding or pulling the latest image tag through your orchestrator.
