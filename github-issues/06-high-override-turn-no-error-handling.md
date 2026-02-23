# [HIGH] Skip/Takeover overrides have no error handling — failures are invisible

**Labels:** `bug` `high` `ux` `error-handling`

## Summary

`handleOverrideTurn` in `App.tsx` makes an API call with no `try/catch` and no `res.ok` check. If the network is unavailable or the server errors, the turn override silently fails. The user taps "Skip my turn" at 3 AM believing their partner is now up — but nothing changed.

## Affected Code

`src/App.tsx:247-255`

```ts
const handleOverrideTurn = async (actionType: 'skip' | 'takeover') => {
  if (!state) return;
  await fetch('/api/override-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: actionType })
  });
  fetchState();  // ← re-fetches, may just show stale state
};
```

No error handling of any kind.

## Impact

- Parent "skips" but the turn was never passed — they're still on the hook
- Parent thinks partner was paged via "take over" notification, but nothing was sent
- No feedback to the user that anything went wrong

## Fix

```ts
const handleOverrideTurn = async (actionType: 'skip' | 'takeover') => {
  if (!state || isActionLoading) return;
  setIsActionLoading(true);
  try {
    const res = await fetch('/api/override-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionType })
    });

    if (!res.ok) throw new Error(`Override failed: ${res.status}`);

    fetchState();
  } catch (err) {
    console.error('Failed to override turn:', err);
    showToast('Couldn\'t update the turn. Check your connection and try again.');
  } finally {
    setIsActionLoading(false);
  }
};
```

Use the same `isActionLoading` state described in issue #02 so all three buttons share one lock.

## Verification Steps

1. Throttle network to offline in DevTools
2. Tap "Skip my turn"
3. **Expected:** Toast appears — "Couldn't update the turn. Check your connection and try again."
4. **Actual (current):** Nothing happens visually; tap seems to do nothing
