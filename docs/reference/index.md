# ReadBox Reference

Reference material is organized by actual source contracts. The current implementation is the primary source of truth; historical planning documents are explicitly differentiated.

- [Configuration reference](configuration-reference.md): actual environment variables, defaults and precedence
- [Dependencies](dependencies.md): frameworks, runtime packages and service boundaries
- [Glossary](glossary.md): product, security, backup and DNS terminology
- [Audit coverage and verification report](coverage-and-verification.md): files inspected, evidence type, exclusions and open release checks

Related canonical implementation references: [API contracts](../dev/api-reference.md), [Prisma schema](../dev/database-schema.md), [Security](../dev/security.md), [Deployment](../dev/building-packaging.md), [Release governance](../RELEASE-GOVERNANCE.md).

When a source identifier conflicts with a dated `docs/*.md` migration plan, follow the current code and its explicit run-time validation rather than assuming the plan is deployed.
