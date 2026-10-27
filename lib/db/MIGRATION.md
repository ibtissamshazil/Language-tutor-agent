# Account migration

The runner also applies `003-learning-context.sql`: a nullable canonical lesson
association on conversations and lookup indexes. It neither copies chat content
nor assigns legacy ownership. Learning summaries are rebuilt from live sources.

Stop API writers and take a PostgreSQL backup with `pg_dump` using your normal
secret-managed connection configuration. Verify that backup can be restored to
an isolated database before proceeding. Do not commit backups or connection URLs.

Run `node lib/db/migrate.mjs` from the workspace root. This transaction is
repeatable: it adds accounts, sessions and nullable ownership, replaces global
completion uniqueness with per-account uniqueness, and adds insert triggers.
It does not delete or assign historical records. Messages retain their parent
and existing cascade rules. NULL ownership is exclusively for legacy rows.
Do not use schema push/force-push for this transition: triggers are intentional.

The runner first applies `000-baseline.sql` to bootstrap empty databases.
Existing tables are left untouched. It then applies the account and sign-in
migrations in order. Each SQL file is transactional and repeatable. Tests run
this same runner against both an empty schema and a populated legacy schema.

The same runner also applies `002-signin-methods.sql` repeatably. This preserves
existing password hashes, marks existing accounts as email-unverified, allows
passwordless accounts and adds code challenges, shared rate limits, and OAuth
state. See `docs/sign-in-setup.md` for first-verification credential protections.

Rollback: stop the API and restore the backup into a separate database first.
Prefer a forward fix retaining ownership; never run the old globally accessible
API against a database containing private account data. A backup restore after
new writes loses those writes, so export/preserve them and obtain approval first.

Future administrative assignment requires explicit data-owner approval identifying
the exact conversation IDs, completion IDs and verified destination account.
Back up first; inside a transaction inspect those records, update only rows with
`user_id IS NULL`, and check affected counts before commit. Messages follow their
conversation owner automatically. Completion conflicts must be reviewed rather
than deleted automatically. No signup, including the first, performs assignment.
