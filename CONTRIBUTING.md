# Contributing to ReadBox

Thank you for your interest in contributing to **ReadBox**! We are committed to building an open, welcoming, and high-quality self-hosted email management ecosystem.

## How to Contribute

### Reporting Issues
- Check existing GitHub issues before opening a new one to avoid duplicates.
- Provide clear context, environment details (Docker, Node.js version, OS), steps to reproduce, and logs if applicable.
- For security vulnerabilities, refer to [SECURITY.md](SECURITY.md) instead of creating a public issue.

### Feature Suggestions
- Open a GitHub Discussion or Issue describing the feature, problem it solves, and proposed technical design.
- Ensure suggestions align with ReadBox's core invariants: single PostgreSQL database, Maildir storage standard, and strict sandboxed security.

### Submitting Pull Requests
1. Fork the repository and create a feature branch (`feature/your-feature-name` or `fix/issue-description`).
2. Adhere to TypeScript strict mode and ESLint standards.
3. Add relevant unit or UI tests covering your changes.
4. Verify all quality gates pass locally before submitting:
   ```bash
   npm run db:validate
   npm run typecheck
   npm run lint
   npm run test:unit
   npm run test:ui
   npm run build
   ```
5. Submit a pull request with a clear description of changes, motivation, and verification steps.

## Development Standards

- **TypeScript:** Strict type safety throughout the codebase.
- **Components:** Next.js 15 App Router conventions, React Server Components by default, Tailwind CSS for styling.
- **Database:** Prisma ORM targeting the single PostgreSQL database. Schema modifications must include safe migration scripts.
- **Testing:** Unit tests using Node.js built-in test runner (`node:test`) and UI tests using Vitest and React Testing Library.
