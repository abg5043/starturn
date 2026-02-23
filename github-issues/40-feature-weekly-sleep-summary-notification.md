# [FEATURE] Weekly Sleep Summary — push notification recapping last week's progress

**Labels:** `feature` `enhancement` `notifications` `analytics`

## Summary

Every Monday morning, send both parents a push notification summarizing last week's sleep data. This turns the app from a real-time tool into a progress narrative — parents look forward to the Monday recap as a signal of how things are trending.

This reuses all the existing push notification infrastructure and the insights data; it just needs a new scheduler trigger and a formatted message.

## Notification Design

### Good week
```
┌────────────────────────────────────────────────────┐
│  🌙 StarTurn Weekly Recap                          │
│  Last week: 9 wakeups total — down from 15!        │
│  Best night: Wednesday · slept through ⭐           │
│  Alice handled 4 nights · Bob handled 3            │
└────────────────────────────────────────────────────┘
```

### Average week
```
┌────────────────────────────────────────────────────┐
│  🌙 StarTurn Weekly Recap                          │
│  Last week: 13 wakeups · avg 1.9/night             │
│  Most active: 1–3 AM                               │
│  Similar to the week before                        │
└────────────────────────────────────────────────────┘
```

### Improving trend
```
┌────────────────────────────────────────────────────┐
│  🌙 StarTurn Weekly Recap                          │
│  3 full nights last week 🌟🌟🌟                    │
│  Monthly average: 1.1/night — half what it was!    │
└────────────────────────────────────────────────────┘
```

## Data Required

All computable from existing logs:

```ts
interface WeeklySummary {
  weekOf: string;           // "Nov 11 – Nov 17"
  totalWakeups: number;
  avgPerNight: number;
  fullNights: number;       // nights with 0 wakeups
  bestNight: string | null; // date of lowest wakeup night
  vsLastWeek: number;       // delta from previous week's total
  peakHour: number | null;  // hour of day with most wakeups
  parent1Nights: number;
  parent2Nights: number;
}
```

## Scheduler Implementation

Add a weekly summary check to the existing `setInterval` scheduler alongside the current evening reminder:

```ts
// In the scheduler (server.ts)
function shouldSendWeeklySummary(now: Date, timezone: string): boolean {
  // Send Monday mornings between 8:00–8:05 AM in the family's timezone
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const isMonday = localTime.getDay() === 1;
  const hour = localTime.getHours();
  const minute = localTime.getMinutes();
  return isMonday && hour === 8 && minute < 5;
}
```

```ts
// In the per-family scheduler block
if (shouldSendWeeklySummary(now, setting.timezone)) {
  const summary = computeWeeklySummary(familyId, now, setting);
  if (summary.totalWakeups > 0 || summary.fullNights > 0) {
    const message = formatWeeklySummaryNotification(summary, setting);
    // Send to both parents
    await sendPushToFamily(familyId, message);
  }
}
```

## Summary Builder

```ts
function computeWeeklySummary(familyId: string, now: Date, settings: any): WeeklySummary {
  // Get Mon–Sun of last week
  const lastMonday = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastSunday = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const lastWeekNights = getJournalForRange(familyId, lastMonday, lastSunday);
  const prevWeekNights = getJournalForRange(familyId,
    subWeeks(lastMonday, 1), subWeeks(lastSunday, 1)
  );

  const totalWakeups = lastWeekNights.reduce((sum, n) =>
    sum + n.trips.filter(t => t.action === 'completed_turn').length, 0
  );
  const prevTotal = prevWeekNights.reduce((sum, n) =>
    sum + n.trips.filter(t => t.action === 'completed_turn').length, 0
  );
  const fullNights = lastWeekNights.filter(n =>
    n.trips.filter(t => t.action === 'completed_turn').length === 0
  ).length;

  // Peak hour: which clock hour had the most wakeups?
  const allTimes = lastWeekNights.flatMap(n =>
    n.trips.filter(t => t.action === 'completed_turn').map(t => new Date(t.timestamp).getHours())
  );
  const hourCounts = allTimes.reduce((acc, h) => ({ ...acc, [h]: (acc[h] || 0) + 1 }), {} as Record<number, number>);
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    weekOf: `${format(lastMonday, 'MMM d')} – ${format(lastSunday, 'MMM d')}`,
    totalWakeups,
    avgPerNight: lastWeekNights.length > 0 ? round(totalWakeups / 7, 1) : 0,
    fullNights,
    vsLastWeek: totalWakeups - prevTotal,
    peakHour: peakHour ? Number(peakHour) : null,
    parent1Nights: lastWeekNights.filter(n => n.first_parent === settings.parent1_name).length,
    parent2Nights: lastWeekNights.filter(n => n.first_parent === settings.parent2_name).length,
  };
}
```

## Notification Copy Generator

```ts
function formatWeeklySummaryNotification(summary: WeeklySummary, settings: any): { title: string; body: string } {
  const { totalWakeups, fullNights, vsLastWeek, avgPerNight, parent1Nights, parent2Nights } = summary;

  // Lede: the most interesting thing about this week
  let title = '🌙 StarTurn Weekly Recap';
  let body: string;

  if (fullNights >= 7) {
    body = `Full week, no wakeups!! 🎉 You both deserve a medal.`;
  } else if (fullNights >= 3) {
    body = `${fullNights} full nights last week ${'⭐'.repeat(fullNights)} · ${totalWakeups} total wakeups`;
  } else if (vsLastWeek <= -3) {
    body = `${totalWakeups} wakeups last week — down ${Math.abs(vsLastWeek)} from the week before. Progress! 📈`;
  } else if (vsLastWeek >= 3) {
    body = `Tough week — ${totalWakeups} wakeups (${vsLastWeek} more than last week). Hang in there.`;
  } else {
    body = `${totalWakeups} wakeups last week · avg ${avgPerNight}/night · ${settings.parent1_name} took ${parent1Nights} nights, ${settings.parent2_name} took ${parent2Nights}`;
  }

  return { title, body };
}
```

## Settings Toggle

Add a "Weekly Summary" toggle in Settings next to the evening reminder:

```
┌─────────────────────────────────────────────────┐
│  Weekly Summary                   [  ──●  ]     │
│  Monday morning recap of last week's sleep      │
└─────────────────────────────────────────────────┘
```

Store as `weekly_summary_enabled BOOLEAN DEFAULT 1` in the settings table.

## Deduplication

Track whether a weekly summary was already sent using a `sent_summaries` table or by checking `milestones` with `type = 'weekly_summary'` and `data.week_of` — prevent sending twice if the scheduler runs multiple ticks on the same Monday morning.

## Verification Steps

1. Enable "Weekly Summary" in Settings
2. Log wakeups across 7 nights
3. Simulate Monday 8 AM by triggering the scheduler manually in test mode
4. **Expected:** Both parents receive a push notification with accurate wakeup counts
5. Trigger again within 5 minutes → **Expected:** NOT sent again (deduplication)
6. Next Monday → **Expected:** New summary with updated data
7. Week with all full nights → **Expected:** Celebratory copy variant
8. Week with more wakeups than previous → **Expected:** Empathetic "tough week" copy
