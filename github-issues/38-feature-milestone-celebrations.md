# [FEATURE] Milestone Celebrations — acknowledge sleep progress with confetti moments

**Labels:** `feature` `enhancement` `ux` `journal`

## Summary

The journal is a record of exhausting nights. Milestones reframe it as a record of *progress*. Add automatic milestone detection that triggers celebrations when key thresholds are crossed — both immediately when a wakeup is logged and surfaced in the Insights tab as a timeline.

These moments are rare and worth celebrating: *first full night*, *first 4-hour stretch*, *a week with no 4+ wakeup nights*. Parents deserve confetti for those.

## Milestone Types

```ts
type MilestoneType =
  | 'first_full_night'          // first night with 0 wakeups
  | 'first_long_stretch'        // first initial stretch > 4h
  | 'full_night_streak'         // N consecutive nights with 0 wakeups
  | 'low_wakeup_week'           // entire week with ≤ 7 total wakeups (avg < 1/night)
  | 'best_stretch_ever'         // new personal best on initial stretch
  | 'nights_logged'             // 30, 60, 90 nights of consistent tracking
  | 'wakeup_count_down'         // monthly avg drops below a threshold (2→1, 1→0.5)
```

## Detection Logic

Run milestone detection server-side after every `POST /api/complete-turn`:

```ts
async function checkMilestones(familyId: string, settings: any): Promise<MilestoneEvent[]> {
  const milestones: MilestoneEvent[] = [];
  const nights = getJournal(familyId); // already computed
  const stretchData = computeAllStretches(nights, settings.bedtime);

  // First full night
  const fullNights = nights.filter(n =>
    n.trips.filter(t => t.action === 'completed_turn' || t.action === 'took_over').length === 0
  );
  if (fullNights.length === 1 && !hasMilestone(familyId, 'first_full_night')) {
    milestones.push({ type: 'first_full_night', night_date: fullNights[0].night_date });
  }

  // New longest stretch
  const latestStretch = stretchData[stretchData.length - 1]?.stretch_mins;
  const previousMax = Math.max(...stretchData.slice(0, -1).map(d => d.stretch_mins ?? 0));
  if (latestStretch && latestStretch > previousMax && previousMax > 0) {
    milestones.push({
      type: 'best_stretch_ever',
      value_mins: latestStretch,
      previous_mins: previousMax
    });
  }

  // 3-night full-night streak
  const recentNights = nights.slice(0, 3);
  const allFullRecently = recentNights.every(n =>
    n.trips.filter(t => t.action === 'completed_turn').length === 0
  );
  if (recentNights.length === 3 && allFullRecently && !hasMilestone(familyId, 'full_night_streak_3')) {
    milestones.push({ type: 'full_night_streak', streak_length: 3 });
  }

  return milestones;
}
```

## DB: Milestone Storage

```sql
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id TEXT NOT NULL,
  type TEXT NOT NULL,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  data TEXT DEFAULT '{}'  -- JSON for extra info (stretch minutes, streak length, etc.)
);
```

## Response — Include Milestones in Complete-Turn Response

```ts
// POST /api/complete-turn response
{
  "success": true,
  "milestones": [
    {
      "type": "best_stretch_ever",
      "message": "New record! Baby slept 5h 12m before waking — longest yet!",
      "value_mins": 312,
      "previous_mins": 287
    }
  ]
}
```

The frontend checks for `milestones` in the response and triggers celebrations.

## Frontend — Celebration UI

```ts
// In handleDone(), after confirming success:
const data = await res.json();

// Normal confetti for completing the turn
confetti({ ... });

// Additional milestone celebration if one was hit
if (data.milestones?.length > 0) {
  const milestone = data.milestones[0];

  // Bigger confetti burst
  confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });

  // Special milestone toast (longer duration)
  showToast(milestone.message, { duration: 6000, icon: '🌟' });
}
```

## Milestone Messages

```ts
function milestoneMessage(m: MilestoneEvent): string {
  switch (m.type) {
    case 'first_full_night':
      return '🌟 First full night! Baby slept through — you both did it!';
    case 'best_stretch_ever':
      return `🎉 New record! Baby slept ${formatMins(m.value_mins)} straight — longest yet!`;
    case 'full_night_streak':
      return `✨ ${m.streak_length} full nights in a row! Keep it going!`;
    case 'low_wakeup_week':
      return '🙌 Best week ever — average less than 1 wakeup per night!';
    case 'nights_logged':
      return `📓 ${m.count} nights logged. You're building a real picture of your sleep.`;
    case 'wakeup_count_down':
      return `📉 Monthly average down to ${m.avg.toFixed(1)} wakeups — clear improvement!`;
  }
}
```

## Insights Tab — Milestone Timeline

```
┌─────────────────────────────────────────────┐
│  🏆 Milestones                              │
│                                             │
│  ⭐ Nov 12  First full night!               │
│  🎉 Nov 8   New stretch record: 5h 12m      │
│  ✨ Nov 1   3 nights in a row with no       │
│             wakeups                         │
│  📓 Oct 15  90 nights logged               │
│  🏆 Oct 3   Best week yet: avg 0.9         │
│             wakeups/night                   │
│  ⭐ Sep 22  First stretch over 4 hours      │
│                                             │
│  (Your journey so far)                      │
└─────────────────────────────────────────────┘
```

## Verification Steps

1. Log enough nights to approach a milestone (e.g., don't log any wakeups for one night)
2. Complete the "Done" flow for that night
3. **Expected:** Larger confetti burst, milestone toast with specific message, 6-second display time
4. Open Insights → Milestones
5. **Expected:** That milestone appears in the timeline with date
6. Log the same milestone type again (second full night)
7. **Expected:** Milestone does NOT fire again (already unlocked); only "streak" type fires on consecutive occurrences
8. Log 3 consecutive full nights
9. **Expected:** "3 nights in a row" milestone fires
