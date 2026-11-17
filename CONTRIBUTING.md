# Contributing to ReadBox

Thank you for your interest in contributing to **ReadBox**, maintained by **[Vib Tools](https://vib.tools/)**! We welcome bug fixes, documentation improvements, and feature contributions from the open-source community.

## Mission & Philosophy

> **Build useful tools. Share them openly.**  
> Practical software for real workflows with clean architecture, reproducible testing, and documentation-first engineering.

## How to Contribute

### 1. Code of Conduct
Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in our project repositories or issue trackers.

### 2. Reporting Issues
- Search existing [GitHub Issues](https://github.com/vibtoolshq/readbox/issues) before submitting a new one.
- Use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) with reproduction steps, environment details (Node version, Docker/Coolify setup), and sanitized logs.
- For security vulnerabilities, follow [SECURITY.md](SECURITY.md) and email [support@vibtools.io](mailto:support@vibtools.io) instead of filing a public issue.

### 3. Proposing Features
- Open a feature request via [GitHub Issues](https://github.com/vibtoolshq/readbox/issues) or [GitHub Discussions](https://github.com/vibtoolshq/readbox/discussions).
- Explain the user problem, real-world workflow, and proposed technical solution.
- Respect ReadBox core invariants: single PostgreSQL database, Maildir filesystem standard, and sandboxed reader isolation.

### 4. Development Workflow

```bash
# 1. Fork the repository on GitHub and clone locally
git clone https://github.com/your-username/readbox.git
cd readbox

# 2. Install dependencies
npm install

# 3. Create a local environment file
cp .env.example .env.local

# 4. Start PostgreSQL via Docker Compose
docker compose up -d postgres

# 5. Run Prisma migrations
npm run db:migrate

# 6. Start the development server
npm run dev
```

### 5. Verification Checklist Before Pull Request

Every pull request must pass the automated verification gates:

```bash
# Database schema validation against invariants
npm run db:validate

# TypeScript strict typechecking
npm run typecheck

# Code formatting and ESLint rules
npm run lint

# Core unit test suite
npm run test:unit

# UI components and accessibility suite (16 files, 70 tests)
npm run test:ui

# Production build compilation check
npm run build
```

### 6. Pull Request Guidelines
- Keep pull requests focused on a single change or fix.
- Follow the provided [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
- Ensure new features include unit or UI test coverage.
- Write clear, concise commit messages.

## Community & Contact

- **Organization:** [Vib Tools](https://vib.tools/)
- **GitHub:** [@vibtoolshq](https://github.com/vibtoolshq)
- **General Inquiries:** [hello@vibtools.io](mailto:hello@vibtools.io)
- **Technical Support:** [support@vibtools.io](mailto:support@vibtools.io)
- **WhatsApp / Phone:** `+880 1795-470603`
