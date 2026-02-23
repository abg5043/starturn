# [LOW] Setting bedtime equal to wake time causes app to get stuck in permanent night mode

**Labels:** `bug` `low` `validation`

## Summary

If a user sets bedtime and wake time to the same value (e.g., both `22:00`), the `computeIsNight` function returns `true` for every minute of the day except the exact bedtime minute. The app gets stuck in permanent night mode and the daytime countdown/dashboard is never shown.

## The Math

```
btMins === wtMins === 1320 (22:00)
At 10:00 (600 mins): 600 >= 1320 || 600 < 1320 → false || true → true (night!)
At 22:00 (1320 mins): 1320 >= 1320 || 1320 < 1320 → true || false → true (night!)
```

Every time except exactly 22:00... which also evaluates to true. So always night mode.

## Affected Code

`src/App.tsx:79` and equivalent in `server.ts`.

## Fix — Frontend Validation in Settings and Setup

Prevent saving when bedtime equals wake time:

**In Settings (`src/App.tsx`):**

```ts
const saveSettings = async () => {
  if (settingsBedtime === settingsWakeTime) {
    showToast('Bedtime and wake time cannot be the same.');
    return;
  }
  // ... proceed
};
```

**In Setup (`src/components/SetupScreen.tsx`):**

```ts
const handleSubmit = () => {
  if (bedtime === wakeTime) {
    setError('Bedtime and wake time cannot be the same.');
    return;
  }
  // ... proceed
};
```

**Backend validation too (`server.ts` settings endpoint):**

```ts
if (bedtime && wakeTime && bedtime === wakeTime) {
  return res.status(400).json({ error: 'Bedtime and wake time cannot be the same.' });
}
```

## Verification Steps

1. Open Settings and set both bedtime and wake time to the same value (e.g., `22:00`)
2. Save
3. **Expected:** Validation error shown — "Bedtime and wake time cannot be the same."
4. **Actual (current):** Settings save successfully, app stuck in permanent night mode
