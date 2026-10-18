# Worker Boundaries

> **Authoritative database policy:** ReadBox uses one PostgreSQL database only. Workers needing application or database-backed mail-server management data must use that same database through approved typed interfaces and least-privilege roles/schemas; do not add MariaDB, MySQL, SQLite, or a second database. Maildir and message/attachment files remain on the filesystem.

Dedicated persistent Node workers are part of the target architecture, but no worker process is implemented in the foundation phase. Planned entry points are delivery indexing, isolated contact handling, and privileged update request processing. Do not run persistent loops in Next.js request handlers; do not connect these placeholders to production services.
