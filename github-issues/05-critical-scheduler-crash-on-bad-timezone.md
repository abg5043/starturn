# [CRITICAL] One family with invalid timezone crashes the scheduler for all families

**Labels:** `bug` `critical` `backend` `notifications`

## Summary

The notification scheduler iterates over all families in a `forEach` loop with a single outer `try/catch`. If any one family has a corrupted or invalid IANA timezone string, `Intl.DateTimeFormat` throws an exception that is caught by the outer handler — stopping all remaining families from being processed. A single bad record in the database silently breaks push notifications for every other family.

## Affected Code

`server.ts:273` — outer try/catch wraps the entire `allSettings.forEach()` loop:

```ts
try {
  allSettings.forEach((setting) => {
    // ...
    const ctx = computeNightContext(now, setting.bedtime, wakeTime, setting.timezone);
    // ^ If setting.timezone is invalid (e.g., 'America/BadZone'), Intl throws here
    // The forEach is aborted, and no subsequent families are processed
  });
} catch (err) {
  console.error('Scheduler error:', err);
}
```

## Failure Scenario

1. Family A has timezone `'America/New_York'` → processed fine
2. Family B has timezone `'Not/ATimezone'` (corrupt DB value) → `Intl.DateTimeFormat` throws
3. Families C, D, E... are never reached
4. The outer catch logs a single error message
5. Nobody's notifications fire for this scheduler tick

## Fix

Move the `try/catch` **inside** the `forEach` loop so errors are isolated per-family:

```ts
allSettings.forEach((setting) => {
  try {
    if (!setting.timezone || !isValidTimezone(setting.timezone)) {
      console.warn(`Skipping family ${setting.family_id}: invalid timezone '${setting.timezone}'`);
      return; // skip just this family
    }

    const ctx = computeNightContext(now, setting.bedtime, wakeTime, setting.timezone);
    // ... rest of per-family logic

  } catch (err) {
    console.error(`Scheduler error for family ${setting.family_id}:`, err);
    // continue to next family
  }
});
```

### Helper: `isValidTimezone`

```ts
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
```

## Additional Improvements

Also validate timezone at the point of saving in `POST /api/setup` and `POST /api/settings`:

```ts
if (timezone && !isValidTimezone(timezone)) {
  return res.status(400).json({ error: 'Invalid timezone' });
}
```

## Verification Steps

1. Manually corrupt a timezone value in the DB: `UPDATE settings SET timezone = 'Bad/Zone' WHERE family_id = 1`
2. Trigger the scheduler (restart server or shorten the interval)
3. **Expected:** Family 1 is skipped with a warning, all other families still receive notifications
4. **Actual (current):** All families after Family 1 in the iteration order receive no notifications
