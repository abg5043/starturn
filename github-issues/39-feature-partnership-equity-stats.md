# [FEATURE] Partnership Equity Stats — see how fairly the nights are split

**Labels:** `feature` `enhancement` `analytics` `journal`

## Summary

Add a fairness/equity view showing how many nights and wakeups each parent has handled — this month, all time, and over a rolling window. This serves two purposes: (1) makes each parent feel seen and appreciated for their effort, and (2) helps catch drift if the alternating schedule has been overridden so many times that one person is carrying most of the load.

## Data Available

From existing logs: `parent_name` is recorded on every `completed_turn` and `took_over` entry. This is enough to compute:

- Wakeups handled per parent (per month, all time)
- Nights "owned" per parent (first wakeup of the night determines ownership)
- Skipped turns per parent (`skipped_turn` action)

## UI — Equity Section in Insights Tab

```
┌─────────────────────────────────────────────┐
│  🤝 Partnership                             │
│                                             │
│  This month (November)                      │
│                                             │
│  Alice ─────────────────────────── 52%      │
│  Bob   ─────────────────xxxxxxxx── 48%      │
│                                             │
│  Alice: 18 nights · 26 wakeups              │
│  Bob:   17 nights · 24 wakeups              │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  All time (87 nights total)                 │
│                                             │
│  Alice ─────────────────────────── 54%      │
│  Bob   ──────────────────────────── 46%     │
│                                             │
│  Longest streak: Alice, 4 nights in a row   │
│                                             │
│  Thanks for showing up for each other. ✨   │
└─────────────────────────────────────────────┘
```

## Computing "Night Ownership"

A night is "owned" by whoever handled the first wakeup (matches existing `first_parent` field in `getJournal()`):

```ts
const nightsByParent = nights.reduce((acc, night) => {
  const owner = night.first_parent;
  if (owner) {
    acc[owner] = (acc[owner] || 0) + 1;
  }
  return acc;
}, {} as Record<string, number>);
```

## Computing Wakeup Counts

```ts
// Total wakeups handled by each parent
const wakeupsByParent = allTrips
  .filter(t => t.action === 'completed_turn' || t.action === 'took_over')
  .reduce((acc, trip) => {
    acc[trip.parent_name] = (acc[trip.parent_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
```

## API Response Shape

Include in `GET /api/insights`:

```json
{
  "partnership": {
    "thisMonth": {
      "parent1": { "nights": 18, "wakeups": 26, "skips": 1 },
      "parent2": { "nights": 17, "wakeups": 24, "skips": 0 }
    },
    "allTime": {
      "parent1": { "nights": 47, "wakeups": 68 },
      "parent2": { "nights": 40, "wakeups": 58 }
    },
    "longestStreak": {
      "parent_name": "Alice",
      "streak": 4
    }
  }
}
```

## Equity Bar Component

```tsx
function EquityBar({ parent1, parent2, label }: {
  parent1: { name: string; nights: number };
  parent2: { name: string; nights: number };
  label: string;
}) {
  const total = parent1.nights + parent2.nights;
  const pct1 = total > 0 ? Math.round((parent1.nights / total) * 100) : 50;
  const pct2 = 100 - pct1;

  return (
    <div className="mb-4">
      <p className="text-xs text-indigo-300/60 mb-2">{label}</p>
      <div className="flex rounded-full overflow-hidden h-2">
        <div
          className="bg-indigo-400 transition-all duration-700"
          style={{ width: `${pct1}%` }}
        />
        <div
          className="bg-purple-400"
          style={{ width: `${pct2}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-indigo-300">{parent1.name} — {pct1}%</span>
        <span className="text-purple-300">{parent2.name} — {pct2}%</span>
      </div>
    </div>
  );
}
```

## Encouraging Copy for Different Scenarios

```ts
function partnershipMessage(pct1: number): string {
  const diff = Math.abs(pct1 - 50);
  if (diff <= 5) return 'You\'re splitting nights almost perfectly. Team work. ✨';
  if (diff <= 15) return 'Roughly even — the schedule is working. 💪';
  if (diff <= 25) return 'One of you is carrying a bit more right now. That\'s okay — sleep is hard.';
  return 'The split is pretty uneven this month. Worth a conversation if it\'s intentional.';
}
```

The tone is supportive, not accusatory. The goal is visibility, not scoring.

## Verification Steps

1. Log several nights alternating between parents (using skip/takeover to create some imbalance)
2. Open Insights → Partnership
3. **Expected:** Equity bar shows correct split for this month
4. **Expected:** Wakeup counts per parent are accurate
5. Wait for the month rollover (or simulate by changing night_dates) and verify "this month" resets
6. **Expected:** "All time" continues to accumulate correctly
