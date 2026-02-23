# [LOW] Journal loads all log records at once — no pagination

**Labels:** `performance` `low` `backend`

## Summary

`GET /api/journal` fetches all wakeup log records for the family from the database in a single query. After a year of consistent use (say 2 wakeups/night × 365 nights = ~730 records), the journal modal will load significantly more data than the user needs to see.

## Current Query (Approximate)

`server.ts` — journal endpoint:

```ts
const nights = db.prepare(`
  SELECT * FROM logs
  WHERE family_id = ?
  ORDER BY night_date DESC, logged_at ASC
`).all(familyId);
```

No `LIMIT` or `OFFSET`.

## Impact

- Initial journal load grows linearly with time
- All data transferred on every journal open, even if user only wants to see the last 7 days
- Browser memory usage grows with dataset

## Fix — Paginate or Limit

### Option A: Limit to most recent N nights (simplest)

```ts
const recentNights = db.prepare(`
  SELECT DISTINCT night_date FROM logs
  WHERE family_id = ?
  ORDER BY night_date DESC
  LIMIT 30
`).all(familyId);
```

### Option B: Cursor-based pagination

```ts
// GET /api/journal?before=2024-11-01&limit=14
const { before, limit = 14 } = req.query;

const nights = db.prepare(`
  SELECT * FROM logs
  WHERE family_id = ?
    ${before ? 'AND night_date < ?' : ''}
  ORDER BY night_date DESC
  LIMIT ?
`).all(before ? [familyId, before, limit] : [familyId, limit]);
```

Frontend then shows a "Load more" button at the bottom of the journal.

### Option C: Infinite scroll

Automatically fetches more records as the user scrolls toward the bottom of the journal.

Option A (limit to 30 nights) is the pragmatic choice for a personal app. Add a "Load more" link if users want to go further back.

## Mockup — Load More Pattern

```
┌──────────────────────────────────────┐
│  Nov 14     2 wakeups  Alice  3:12   │
│  Nov 13     1 wakeup   Bob    2:44   │
│  ...                                 │
│  Oct 16     3 wakeups  Alice  ...    │
│  ─────────────────────────────────  │
│         Showing last 30 nights       │
│         [  Load earlier nights  ]    │
└──────────────────────────────────────┘
```

## Verification Steps

1. Insert 100+ log records directly into the DB (or use a script)
2. Open the journal modal and inspect the network request
3. **Expected (with fix):** Only 30 days of records returned; "Load more" available
4. **Actual (current):** All records fetched regardless of count
