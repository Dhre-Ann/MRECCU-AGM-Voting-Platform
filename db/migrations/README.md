# Database migrations

SQL migrations for the MRECCU AGM Voting Platform live in this folder.

## Naming convention

Use a sequential, timestamp-prefixed filename so migrations stay ordered and easy to apply by hand (or later via a runner):

```
YYYYMMDDHHMMSS_short_description.sql
```

Examples:

- `20260411090000_create_ballots_table.sql`
- `20260411103000_add_unique_voter_position_index.sql`

Rules:

1. One logical change per file.
2. Prefer additive / reversible wording in the description (`create_…`, `add_…`, `drop_…`).
3. Do not edit a migration after it has been applied against a shared database; add a new file instead.

Applied / present migrations:

- `20260811100000_create_ballots_tables.sql` — `ballot_casts` + `ballot_lines` for per-ballot audit trail
