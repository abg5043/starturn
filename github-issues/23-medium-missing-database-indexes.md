# [MEDIUM] Missing database indexes on frequently queried columns

**Labels:** `performance` `medium` `backend`

## Summary

The database schema in `src/db.ts` creates tables without indexes on columns that are used as filter conditions in nearly every query. For a personal app with 2 users, this is negligible. However, as nightly log volume grows over months and years, query performance will degrade linearly.

## Missing Indexes

| Table | Column | Used In |
|---|---|---|
| `logs` | `family_id` | Every wakeup query filters by family |
| `logs` | `night_date` | Journal queries filter by date range |
| `subscriptions` | `family_id` | Push subscription lookups |
| `sessions` | `family_id` | Session auth lookups |
| `sessions` | `token` | Session verification (most critical) |

## Current Schema (Excerpt)

`src/db.ts`

```sql
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL,   -- ← no index
  night_date TEXT NOT NULL,     -- ← no index
  ...
)
```

## Fix

Add index creation statements after the `CREATE TABLE` calls:

```ts
db.exec(`
  -- Sessions: token lookup is on the hot path for every authenticated request
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_family_id ON sessions(family_id);

  -- Logs: journal and scheduler queries filter by family and date
  CREATE INDEX IF NOT EXISTS idx_logs_family_id ON logs(family_id);
  CREATE INDEX IF NOT EXISTS idx_logs_family_date ON logs(family_id, night_date);

  -- Subscriptions: push notification lookups by family
  CREATE INDEX IF NOT EXISTS idx_subscriptions_family_id ON subscriptions(family_id);
`);
```

The composite index `(family_id, night_date)` is more useful than two separate indexes for the common query pattern: "get all wakeups for family X on date Y."

## Why This Matters Now

- The `idx_sessions_token` index is genuinely important — session token lookup happens on **every single authenticated API request**, including the 30-second state poll. Without it, the sessions table does a full table scan on every poll.
- This is a zero-risk change: `CREATE INDEX IF NOT EXISTS` is idempotent and safe on existing databases.

## Verification Steps

Run `EXPLAIN QUERY PLAN` on key queries before and after:

```sql
-- Before
EXPLAIN QUERY PLAN
SELECT * FROM sessions WHERE token = 'abc123';
-- Output: SCAN sessions (full table scan)

-- After adding index
EXPLAIN QUERY PLAN
SELECT * FROM sessions WHERE token = 'abc123';
-- Output: SEARCH sessions USING INDEX idx_sessions_token
```
