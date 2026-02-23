# [FEATURE] Sleep Stretch Tracker — visualize how long baby's initial stretch is growing

**Labels:** `feature` `enhancement` `analytics` `journal`

## Summary

The single most meaningful signal for "is our baby getting better at sleep" is: **how long is the initial uninterrupted stretch between bedtime and the first wakeup?** This number tends to grow week over week as babies mature.

We can compute this from existing data: `(first wakeup timestamp) - (bedtime from settings)` for each logged night. On nights with no wakeups, the "stretch" spans the entire night.

This is the specific feature the user asked for: *"a way to track when those stretches occur so that we can do data analysis and see how it's getting better over months."*

## The Core Metric: Initial Stretch

```
Night starts at bedtime (settings.bedtime)

Example night with one wakeup:
  10:00 PM  bedtime
  12:47 AM  first wakeup (completed_turn logged)
  ─────────────────────────────
  2h 47m    initial stretch ← this is the number that should grow

Example night with no wakeups:
  10:00 PM  bedtime
  07:00 AM  wake time (settings.wake_time)
  ─────────────────────────────
  9h 00m    full night ← displayed as "Slept through! 🌟"
```

Over 90 days, if baby is improving, this chart should trend upward.

## UI — "Sleep Stretch" Section in Insights Tab

(Part of the Insights tab introduced in issue #34)

```
┌─────────────────────────────────────────────┐
│  ⏱ Initial Sleep Stretch                    │
│  How long baby slept before first waking    │
│                                             │
│   9h ┤                          ╭──○  ○     │
│   6h ┤              ╭──          │           │
│   4h ┤        ╭──╯              │           │
│   3h ┤  ╭──╯                                │
│   2h ┤╯                                     │
│   1h ┤──────────────────────────────────    │
│       Sep        Oct        Nov  → recent   │
│                                             │
│  ●  = slept through ○  = first wakeup time  │
│                                             │
│  Recent average:  3h 42m                    │
│  A month ago:     2h 09m                    │
│  ↑ Getting longer! ✨                       │
└─────────────────────────────────────────────┘
```

## Data Shape

```ts
interface StretchDataPoint {
  night_date: string;
  stretch_mins: number | null;  // null = no data logged for this night
  slept_through: boolean;       // true = no wakeups at all
}
```

- `slept_through: true` → render as full bar (stretch = bedtime to wake_time), special dot/marker
- `stretch_mins: null` → night not logged, skip in chart
- `stretch_mins > 0` → normal bar

## Computing in API

```ts
// In GET /api/insights handler, server.ts
const stretchData = nights.map(night => {
  const firstWakeup = night.trips.find(t =>
    t.action === 'completed_turn' || t.action === 'took_over'
  );

  if (!firstWakeup) {
    // Night was logged (exists in DB) but no wakeups = slept through
    const [wtH, wtM] = wakeTime.split(':').map(Number);
    const [btH, btM] = bedtime.split(':').map(Number);
    // Full night stretch in minutes
    let fullNightMins = (wtH * 60 + wtM) - (btH * 60 + btM);
    if (fullNightMins < 0) fullNightMins += 24 * 60; // crosses midnight
    return { night_date: night.night_date, stretch_mins: fullNightMins, slept_through: true };
  }

  const bedtimeMs = new Date(`${night.night_date}T${bedtime}:00`).getTime();
  const firstWakeupMs = new Date(firstWakeup.timestamp).getTime();
  const stretch_mins = Math.max(0, Math.round((firstWakeupMs - bedtimeMs) / 60000));

  return { night_date: night.night_date, stretch_mins, slept_through: false };
});
```

## "Getting Longer" Trend Indicator

Compare the mean stretch of the last 14 nights vs the 14 nights before that:

```ts
const last14 = stretchData.slice(-14).filter(d => d.stretch_mins != null);
const prev14 = stretchData.slice(-28, -14).filter(d => d.stretch_mins != null);

const avgLast14 = mean(last14.map(d => d.stretch_mins));
const avgPrev14 = mean(prev14.map(d => d.stretch_mins));

const trendDirection = avgLast14 > avgPrev14 ? 'improving' : 'similar';
const trendDelta = Math.abs(avgLast14 - avgPrev14); // minutes
```

Show as:
```
↑ Getting longer — up 34 min in the past two weeks ✨
→ About the same as two weeks ago
↓ Slightly shorter recently (rough patch?)
```

## "Slept Through" Highlights on Chart

On the area/line chart, render "slept through" nights as distinct colored dots — gold or green stars — so they're visually distinct from "these 5 nights all had a 6h stretch":

```tsx
// Custom dot renderer for recharts
const renderDot = (props: any) => {
  if (props.payload.slept_through) {
    return <Star key={props.key} x={props.cx - 6} y={props.cy - 6} fill="#fbbf24" />;
  }
  return <circle key={props.key} cx={props.cx} cy={props.cy} r={2} fill="#818cf8" />;
};
```

## Milestone: "Longest Stretch Yet!"

When a new personal best initial stretch is logged, trigger a confetti burst and a toast:

```
🎉 New record! Baby slept 5h 12m before waking — longest yet!
```

This is computed by comparing the new stretch against `MAX(stretch_mins)` in historical data.

## Verification Steps

1. Log several nights with varying first-wakeup times
2. Open Insights → Sleep Stretch section
3. **Expected:** Line chart with stretch in minutes/hours, trending upward if data shows improvement
4. Log a night with no wakeups
5. **Expected:** That night shows as a full-height bar/dot marked with a star
6. Calculate manually: `first_wakeup_timestamp - bedtime` for one night and verify it matches displayed value
7. After 14+ nights, verify "trend" indicator shows correct direction
