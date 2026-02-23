# [FEATURE] Calendar Heatmap — color-coded month view of sleep quality

**Labels:** `feature` `enhancement` `journal` `ui`

## Summary

Add a calendar heatmap to the Insights tab showing each night's wakeup count as a color, giving an instant visual read on sleep patterns over months. Users can see at a glance: "October was rough, November is clearly getting better."

This is the most emotionally satisfying visualization for this use case — it makes the progress visible and real.

## Design

### Color Scale

```
No data logged:   ░  (transparent/dim)
Slept through:    ■  deep green  (#22c55e)
1 wakeup:         ■  light green (#86efac)
2 wakeups:        ■  yellow      (#fde047)
3 wakeups:        ■  orange      (#fb923c)
4+ wakeups:       ■  red         (#f87171)
```

### Mockup — 3-Month View

```
┌─────────────────────────────────────────────┐
│  📅 Sleep Calendar                          │
│                                             │
│  September                                  │
│  Mo Tu We Th Fr Sa Su                       │
│               1  2  3  4  5                 │
│   6  7  ░  ░  ░  ░  ░                       │ ← started logging mid-month
│  13 14 ■  ■  ■  ■  ■  ■  ■                 │
│  20 21 ■  ■  ■  ■  ■  ■  ■                 │
│  27 28 ■  ■  ■                              │
│                                             │
│  October                                    │
│  Mo Tu We Th Fr Sa Su                       │
│               1  2  3  4  5                 │  ← lots of orange/red = rough month
│  ■  ■  ■  ■  ■  ■  ■                       │
│  ■  ■  ■  ■  ■  ■  ■                       │
│  ■  ■  ■  ■  ■  ■  ■                       │
│  ■  ■  ■  ■  ■  ■  ■                       │
│                                             │
│  November                                   │
│  Mo Tu We Th Fr Sa Su                       │
│               1  2  3  4  5                 │  ← trending green = improving!
│  ■  ■  ■  ■  ■  ■  ■                       │
│  ■  ■  ■  ■  ■  ■  ■                       │
│  ■  ■  ■  ■                                 │
│                                             │
│  ░ No data  ■ Full night  ■ 1  ■ 2  ■ 3  ■ 4+  │
└─────────────────────────────────────────────┘
```

### Tap a Day — Detail Popover

Tapping any colored cell opens a small popover:

```
  ┌──────────────────────────────┐
  │  Thursday, Nov 14            │
  │  2 wakeups                   │
  │  Alice · 1:22 AM             │
  │  Alice · 3:47 AM             │
  │                              │
  │  Initial stretch: 3h 22m     │
  └──────────────────────────────┘
```

## Implementation

### Calendar Grid Component

```tsx
interface CalendarDay {
  date: string;         // YYYY-MM-DD
  wakeupCount: number | null; // null = no data
  sleptThrough: boolean;
}

function wakeupCountToColor(count: number | null, sleptThrough: boolean): string {
  if (count === null) return 'bg-white/5';           // no data
  if (sleptThrough || count === 0) return 'bg-green-500';
  if (count === 1) return 'bg-green-300/80';
  if (count === 2) return 'bg-yellow-400/80';
  if (count === 3) return 'bg-orange-400/80';
  return 'bg-red-400/80';                            // 4+
}

function CalendarMonth({
  year, month, days, onDayClick
}: {
  year: number;
  month: number; // 0-indexed
  days: CalendarDay[];
  onDayClick: (date: string) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayMap = new Map(days.map(d => [d.date, d]));

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-indigo-200/80 mb-2">
        {new Date(year, month).toLocaleDateString([], { month: 'long', year: 'numeric' })}
      </h3>
      <div className="grid grid-cols-7 gap-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-indigo-300/40">{d}</div>
        ))}
        {/* Leading empty cells */}
        {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const data = dayMap.get(dateStr);
          const colorClass = wakeupCountToColor(data?.wakeupCount ?? null, data?.sleptThrough ?? false);
          return (
            <button
              key={dateStr}
              onClick={() => data && onDayClick(dateStr)}
              className={`
                aspect-square rounded-md text-xs font-medium transition-transform
                hover:scale-110 active:scale-95
                ${colorClass}
                ${data ? 'cursor-pointer' : 'cursor-default opacity-30'}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Showing Last 3 Months

```tsx
function CalendarHeatmap({ insights }: { insights: InsightsData }) {
  const months = getLastNMonths(3); // returns [{year, month}, ...]
  const dayData = buildCalendarDays(insights.nights); // Map<YYYY-MM-DD, CalendarDay>

  return (
    <div>
      <h2 className="font-semibold text-white mb-4">Sleep Calendar</h2>
      {months.map(({ year, month }) => (
        <CalendarMonth
          key={`${year}-${month}`}
          year={year}
          month={month}
          days={dayData.filter(d => d.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`))}
          onDayClick={handleDayClick}
        />
      ))}
      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-indigo-300/60 mt-2">
        <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Full night
        <span className="w-3 h-3 rounded-sm bg-green-300/80 inline-block" /> 1
        <span className="w-3 h-3 rounded-sm bg-yellow-400/80 inline-block" /> 2
        <span className="w-3 h-3 rounded-sm bg-orange-400/80 inline-block" /> 3
        <span className="w-3 h-3 rounded-sm bg-red-400/80 inline-block" /> 4+
      </div>
    </div>
  );
}
```

## Verification Steps

1. Log nights with varying wakeup counts (0 through 4)
2. Open Journal → Insights → Calendar
3. **Expected:** Each logged night shows a colored cell matching wakeup count
4. **Expected:** Unlogged nights show as dim/transparent
5. Tap a colored day → **Expected:** Popover shows the correct times and who handled each wakeup
6. Verify "slept through" nights show as deep green
7. Verify the color shift is visible comparing a rough week (orange/red) to a good recent week (green)
