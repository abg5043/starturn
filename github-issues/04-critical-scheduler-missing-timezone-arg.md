# [CRITICAL] Evening reminder scheduler uses server timezone instead of family timezone

**Labels:** `bug` `critical` `notifications` `backend`

## Summary

The evening reminder scheduler passes only 3 arguments to `computeNightContext()` when the function requires 4. The missing fourth argument is the family's IANA timezone. As a result, "last night" is computed using the server's local timezone instead of the family's, meaning families in different timezones receive incorrectly attributed nightly summaries.

## Affected Code

`server.ts:333`

```ts
// Bug: timezone argument is missing
const nightCtx = computeNightContext(subDays(now, 1), setting.bedtime, wakeTime);
```

The function signature (from usage elsewhere in the file) requires:

```ts
computeNightContext(date, bedtime, wakeTime, timezone)
```

Compare with the correct call on `server.ts:278`:

```ts
const ctx = computeNightContext(now, setting.bedtime, wakeTime, setting.timezone);
```

## Impact

- A family in UTC-6 with a server in UTC+0 will have "last night" computed 6 hours off
- Evening reminders reference the wrong night's data
- The wrong parent may be told it's their turn in the reminder notification
- This is silent — no error is thrown, wrong data is just used

## Fix

Pass `setting.timezone` as the fourth argument:

```ts
// server.ts:333
const nightCtx = computeNightContext(
  subDays(now, 1),
  setting.bedtime,
  wakeTime,
  setting.timezone  // ← add this
);
```

## Verification Steps

1. Register a family with timezone set to a zone far from the server's
2. Set the evening reminder time to fire in 1–2 minutes (adjust system clock or lower the interval for testing)
3. Trigger the scheduler
4. **Expected:** Reminder references the correct night for the family's local timezone
5. **Actual (current):** Reminder may reference the wrong night or wrong parent

## Related

- See also issue #05 — one bad timezone can crash the entire scheduler loop
