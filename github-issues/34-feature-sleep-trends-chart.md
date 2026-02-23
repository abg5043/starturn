# [FEATURE] Sleep Trends — chart showing wakeup improvement over time

**Labels:** `feature` `enhancement` `journal` `analytics`

## Summary

Add an "Insights" view to the journal modal that shows a visual chart of wakeup counts over the past 90 days, a rolling average, and milestone callouts. This directly answers the question: *"Is our baby's sleep actually getting better?"* — with data.

All of this is computable from the existing `logs` table. No new data collection needed.

## What We Can Compute From Existing Data

```
logs table: parent_name, action, timestamp, night_date
```

From this we can derive:
- **Wakeup count per night** — count of `completed_turn` + `took_over` logs per `night_date`
- **Slept-through nights** — nights with 0 wakeup logs
- **Rolling 7-day average** — avg wakeups per night over any trailing window
- **Initial stretch** — `first_wakeup_timestamp - bedtime_of_that_night` (bedtime from settings)
- **Monthly comparison** — this month's avg vs last month's avg

## New API Endpoint

```
GET /api/insights
```

Response:

```json
{
  "nights": [
    { "night_date": "2024-11-14", "wakeup_count": 2, "initial_stretch_mins": 147 },
    { "night_date": "2024-11-13", "wakeup_count": 0, "initial_stretch_mins": null },
    ...
  ],
  "rolling7": [
    { "week_ending": "2024-11-14", "avg_wakeups": 1.4 },
    ...
  ],
  "thisMonthAvg": 1.6,
  "lastMonthAvg": 2.8,
  "totalNightsLogged": 87,
  "sleptThroughCount": 12
}
```

## UI — Insights Tab in Journal Modal

Add a tab switcher at the top of the journal modal:

```
┌─────────────────────────────────────────────┐
│  Night Journal                         ✕    │
│  ─────────────────────────────────────────  │
│  [  Log  ]  [  Insights  ]                  │
│  ─────────────────────────────────────────  │
```

### Insights Tab Layout

```
┌─────────────────────────────────────────────┐
│  📉 Wakeups Over Time                       │
│                                             │
│  5 ┤                                        │
│  4 ┤  ▪                                     │
│  3 ┤  █  ▪  ▪                               │
│  2 ┤  █  █  █  ▪  ▪  ▪                      │
│  1 ┤  █  █  █  █  █  █  ▪  ▪  ▪  ▪         │
│  0 ┤  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ○  ○  │
│     Oct              Nov          →  recent │
│                                             │
│  ─────────── rolling 4-week avg ─────────── │
│                                             │
│  ┌────────────┐  ┌────────────┐             │
│  │  This month │  │ Last month │             │
│  │  1.6 / night│  │ 2.8 / night│             │
│  │  ↓ 43% less │  │            │             │
│  └────────────┘  └────────────┘             │
│                                             │
│  ┌────────────┐  ┌────────────┐             │
│  │  87 nights  │  │ 12 full    │             │
│  │  logged     │  │ nights 🌟  │             │
│  └────────────┘  └────────────┘             │
└─────────────────────────────────────────────┘
```

## Implementation Notes

### Chart Library

Use `recharts` (already lightweight, React-native, works well with Tailwind):

```bash
npm install recharts
```

```tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={160}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="wakeupGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
      </linearGradient>
    </defs>
    <Area
      type="monotone"
      dataKey="wakeup_count"
      stroke="#818cf8"
      fill="url(#wakeupGradient)"
      strokeWidth={2}
      dot={false}
    />
    <XAxis dataKey="night_date" hide />
    <YAxis allowDecimals={false} width={20} stroke="rgba(255,255,255,0.3)" />
    <Tooltip
      contentStyle={{ background: 'rgba(30,27,75,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
      labelFormatter={(d) => new Date(d + 'T12:00').toLocaleDateString()}
      formatter={(v: number) => [`${v} wakeup${v === 1 ? '' : 's'}`, '']}
    />
  </AreaChart>
</ResponsiveContainer>
```

### Computing Initial Stretch

```ts
// server.ts — in /api/insights
function computeInitialStretchMins(
  nightDate: string,    // YYYY-MM-DD
  firstWakeupTimestamp: string,
  bedtime: string       // HH:mm from settings
): number | null {
  if (!firstWakeupTimestamp) return null; // slept through — no wakeup to measure to

  const [btH, btM] = bedtime.split(':').map(Number);
  // Bedtime is on `nightDate`, first wakeup is somewhere between nightDate and nightDate+1
  const bedtimeMs = new Date(`${nightDate}T${bedtime}:00`).getTime();
  const wakeupMs = new Date(firstWakeupTimestamp).getTime();

  // Sanity check: wakeup should be after bedtime
  if (wakeupMs <= bedtimeMs) return null;

  return Math.round((wakeupMs - bedtimeMs) / 60000); // minutes
}
```

### "This Month vs Last Month" Stat Cards

```tsx
const improvementPct = lastMonthAvg > 0
  ? Math.round(((lastMonthAvg - thisMonthAvg) / lastMonthAvg) * 100)
  : 0;

<div className="rounded-xl bg-white/5 border border-white/10 p-4">
  <p className="text-2xl font-bold text-white">{thisMonthAvg.toFixed(1)}</p>
  <p className="text-xs text-indigo-300/70">wakeups/night this month</p>
  {improvementPct > 0 && (
    <p className="text-xs text-green-400 mt-1">↓ {improvementPct}% from last month</p>
  )}
</div>
```

## Empty State

When fewer than 7 nights are logged:

```
┌─────────────────────────────────────────────┐
│  📊  Insights                               │
│                                             │
│  Log a few more nights to start seeing      │
│  sleep trends here.                         │
│                                             │
│  Progress charts appear after 7 nights.     │
└─────────────────────────────────────────────┘
```

## Verification Steps

1. Log 10+ nights of wakeup data (mix of 0, 1, 2, 3 wakeups)
2. Open Journal → Insights tab
3. **Expected:** Area chart showing wakeup counts by night, recent on right
4. **Expected:** "This month" and "Last month" stat cards with correct averages
5. Navigate back after logging a new wakeup → **Expected:** Chart updates
6. Check with < 7 nights → **Expected:** Empty/encourage state shown
