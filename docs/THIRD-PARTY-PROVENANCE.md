# R-06 third-party provenance and licensing boundary

**Review status (2026-11-17): SOURCE INVENTORY ONLY — legal/distribution clearance NOT GIVEN.** Finding `RB-P2-08` and release gate RG-16 remain OPEN until independent review.

| Evidence in tracked source | Actual conclusion |
|---|---|
| [Root ReadBox LICENSE](../LICENSE) | Declares MIT copyright 2026 Vib Tools and ReadBox contributors |
| [Historical reference LICENSE](../reference/MailStack/LICENSE) | Declares GNU Affero General Public License, independently from the root license |
| [Historical reference NOTICE](../reference/MailStack/NOTICE.md) | Explicitly identifies AGPL-3.0-or-later, naming/branding restrictions, and further dependent license inventory |
| [Historical reference dependency notices](../reference/MailStack/mailbox-app/LICENSES.md) | Additional review required for actual redistributed reference/derivatives |
| [Docker build ignore rules](../.dockerignore) | `reference` is excluded from the declared Docker build context — not proof about every possible release bundle or copyright derivation |

**Required rule:** the root ReadBox MIT notice does **not** relicense historical MailStack reference AGPL contents. Never delete/edit `reference/MailStack/LICENSE` or `reference/MailStack/NOTICE.md` to conceal licensing requirements. AGPL distribution/network-source obligations, derivative work assessment, attribution, other dependencies and source-trademark restrictions require actual qualified review before distributing a verified artifact.

R-06 CI validates the existence of literal license/NOTICE markers and the `.dockerignore` boundary. It **cannot determine** whether the shipped production image or any future source archive contains copyrighted reference material, whether modified historical code has been incorporated, or whether AGPL obligations have been satisfied. These matters require explicit human sign-off with the **exact release SHA and artifact inventory**.

- No source reference code, LICENSE, NOTICE or third-party files changed in R-06.
- No legal or security clearance is claimed from automated tests.
- No tags, releases, Docker images or VPS were published.
- The [manual acceptance runbook](PRODUCTION-ACCEPTANCE-RUNBOOK.md) keeps RG-16 and original finding `RB-P2-08` OPEN pending independent evidence.
