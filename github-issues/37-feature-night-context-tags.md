# [FEATURE] Night Context Tags — annotate nights with "teething", "sick", "travel", etc.

**Labels:** `feature` `enhancement` `journal` `analytics`

## Summary

Let parents tag each night with optional context labels (teething, sick, growth spurt, hot room, good nap day, travel, etc.). Over time, this enables powerful pattern detection: *"On teething nights, baby averages 3.2 wakeups. On normal nights: 1.1."* It also explains outliers — rough nights don't feel as discouraging when you can attribute them to a cause.

## New Data Required

Add a `night_tags` column to the `logs` table (stored at the night level):

**Option A: New `nights` table** (cleanest long-term)

```sql
CREATE TABLE IF NOT EXISTS nights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id TEXT NOT NULL,
  night_date TEXT NOT NULL,      -- YYYY-MM-DD
  tags TEXT DEFAULT '[]',        -- JSON array of tag strings
  note TEXT DEFAULT NULL,        -- optional freeform note
  UNIQUE(family_id, night_date)
);
```

This separates night-level metadata from per-wakeup logs cleanly.

**Option B: Add to existing logs** (simpler, no schema change)

Store tags as a special log entry: `action = 'night_tags'`, `parent_name = JSON.stringify(tags)`.

**Recommendation: Option A** (nights table). It's slightly more work but keeps the data model clean and makes querying straightforward.

## Preset Tags

```ts
const PRESET_TAGS = [
  { id: 'teething',      label: '🦷 Teething',       color: 'orange' },
  { id: 'sick',          label: '🤒 Sick',            color: 'red'    },
  { id: 'growth_spurt',  label: '📈 Growth Spurt',   color: 'purple' },
  { id: 'travel',        label: '✈️ Travel',           color: 'blue'   },
  { id: 'good_naps',     label: '😴 Good Nap Day',   color: 'green'  },
  { id: 'hot_room',      label: '🌡 Hot Room',        color: 'amber'  },
  { id: 'clocks_changed',label: '🕐 Time Change',    color: 'gray'   },
  { id: 'developmental', label: '🧠 Developmental',  color: 'indigo' },
];
```

## UI — Tag Entry in Journal Night Card

In each night card in the journal, add a tag row below the wakeup entries:

```
┌─────────────────────────────────────────────┐
│  Thursday, November 14          2 wakeups   │
│  ───────────────────────────────────────    │
│  Alice  ·  1:22 AM                          │
│  Alice  ·  3:47 AM                          │
│  ───────────────────────────────────────    │
│  🦷 Teething  ×   [+ Add tag]               │
└─────────────────────────────────────────────┘
```

Tapping "+ Add tag" opens a tag picker:

```
┌──────────────────────────────────────┐
│  What was going on that night?       │
│                                      │
│  [🦷 Teething ✓]  [🤒 Sick]         │
│  [📈 Growth Spurt] [✈️ Travel]       │
│  [😴 Good Nap Day] [🌡 Hot Room]    │
│  [🕐 Time Change]  [🧠 Developmental]│
│                                      │
│  ┌──────────────────────────────┐   │
│  │ + Custom tag...              │   │
│  └──────────────────────────────┘   │
│                                      │
│              [Done]                  │
└──────────────────────────────────────┘
```

Selected tags appear as chips in the night card. Tags can be removed by tapping the ×.

## UI — Tag Insights in Insights Tab

```
┌─────────────────────────────────────────────┐
│  🏷 Tag Analysis                            │
│                                             │
│  Teething nights (8 total)                  │
│  ████████████████████ avg 3.2 wakeups       │
│                                             │
│  Sick nights (3 total)                      │
│  ████████████████████████ avg 4.0 wakeups   │
│                                             │
│  Normal nights (61 total)                   │
│  █████████ avg 1.1 wakeups                  │
│                                             │
│  Good nap day nights (12 total)             │
│  ██████ avg 0.8 wakeups  ← interesting!     │
└─────────────────────────────────────────────┘
```

## API Endpoints

```
GET  /api/nights/:nightDate/tags       → { tags: string[], note: string }
POST /api/nights/:nightDate/tags       → { tags: string[], note?: string }
```

```ts
// POST /api/nights/:nightDate/tags
app.post('/api/nights/:nightDate/tags', authenticateRequest, (req, res) => {
  const { nightDate } = req.params;
  const { tags, note } = req.body;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(nightDate)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  const familyId = (req as any).familyId;
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

  db.prepare(`
    INSERT INTO nights (family_id, night_date, tags, note)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(family_id, night_date) DO UPDATE SET tags = excluded.tags, note = excluded.note
  `).run(familyId, nightDate, tagsJson, note ?? null);

  res.json({ success: true });
});
```

## Why This Feature Is Special

Context tags transform the journal from a *ledger* into a *story*. When you look back at a rough October, you see "*sick × 2, teething × 3, growth spurt × 1*" and realize it wasn't random regression — it was circumstance. That reframe is emotionally valuable at 3 AM and analytically valuable when talking to a pediatrician.

## Verification Steps

1. Open the journal for a logged night
2. Tap "+ Add tag" → **Expected:** Tag picker opens
3. Select "Teething" → **Expected:** Tag chip appears on the night card, saved on close
4. Open Insights → Tag Analysis
5. **Expected:** "Teething nights" row shows this night and updates avg wakeup count
6. Tag 5 more nights with different tags
7. **Expected:** Horizontal bar comparison shows clearly which context causes more wakeups
