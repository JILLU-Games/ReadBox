## Description
Please include a summary of the changes and the related issue. Please also include relevant motivation and context.

Fixes #(issue)

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Verification Gates
Please verify that your branch passes all required quality checks:

- [ ] `npm run db:validate` — Prisma schema validates against invariants
- [ ] `npm run typecheck` — TypeScript strict type check passes without errors
- [ ] `npm run lint` — ESLint rules pass with 0 errors
- [ ] `npm run test:unit` — All unit test suites pass
- [ ] `npm run test:ui` — All 70 Vitest UI component tests pass
- [ ] `npm run build` — Production build compiles successfully

## Security Considerations
- [ ] Does not weaken authentication, password hashing, or session validation
- [ ] Does not bypass sandboxed iframe email reader isolation
- [ ] Does not add a second database (adheres to single PostgreSQL policy)
- [ ] Does not expose secrets, credentials, or private keys
