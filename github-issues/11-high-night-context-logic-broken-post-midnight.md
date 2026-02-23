# [HIGH] Night-context logic is incorrect for post-midnight bedtimes

**Labels:** `bug` `high` `logic` `backend`

## Summary

The `computeIsNight` function uses the logic `totalMins >= btMins || totalMins < wtMins` to determine if it's currently nighttime. This formula is only correct when bedtime is in the PM and wake time is in the AM (e.g., 22:00–07:00). For less conventional but valid schedules, the formula produces wrong results.

The same logic exists in both the frontend and backend, so both are affected.

## Affected Code

`src/App.tsx:79` (frontend):
```ts
return totalMins >= btMins || totalMins < wtMins;
```

`server.ts` — equivalent logic in `computeNightContext`.

## Incorrect Scenarios

### Scenario A: Early-morning bedtime (e.g., new parent shifts)
- Bedtime: `01:00`, Wake: `08:00`
- At 05:00: `300 >= 60 || 300 < 480` → `true || true` → **night** ✓ (correct)
- At 00:30: `30 >= 60 || 30 < 480` → `false || true` → **night** ← WRONG (it's before bedtime)

### Scenario B: Same time for both
- Bedtime: `22:00`, Wake: `22:00` (both set to same)
- `btMins === wtMins`, so `totalMins >= 1320 || totalMins < 1320` is always true at every minute except exactly 22:00
- App is permanently in night mode. Daytime UI never renders.

### Scenario C: Wake time after bedtime (afternoon nap scenario)
- Bedtime: `13:00`, Wake: `16:00`
- `btMins = 780`, `wtMins = 960`
- At 14:00 (840): `840 >= 780 || 840 < 960` → `true || true` → **night** ✓
- At 12:00 (720): `720 >= 780 || 720 < 960` → `false || true` → **night** ← WRONG

## Fix

The correct formula depends on whether the sleep window crosses midnight:

```ts
function computeIsNight(currentMins: number, btMins: number, wtMins: number): boolean {
  if (btMins === wtMins) return false; // prevent always-night edge case

  const crossesMidnight = btMins > wtMins;
  if (crossesMidnight) {
    // e.g., 22:00–07:00: night if >= 22:00 OR < 07:00
    return currentMins >= btMins || currentMins < wtMins;
  } else {
    // e.g., 01:00–08:00: night if >= 01:00 AND < 08:00
    return currentMins >= btMins && currentMins < wtMins;
  }
}
```

Also add frontend validation preventing bedtime === wake time (see issue #32 — bedtime validation).

## Server-Side Fix

The same correction needs to be applied to `computeNightContext` in `server.ts`.

## Verification Steps

1. Set bedtime to `01:00` and wake to `08:00`
2. At midnight (00:30), check the app
3. **Expected:** Shows daytime UI (it's not yet bedtime)
4. **Actual (current):** Shows night mode

5. Set bedtime and wake to the same time (e.g., both `22:00`)
6. **Expected:** Error or default shown; daytime UI visible during the day
7. **Actual (current):** Permanently stuck in night mode
