# [CRITICAL] "Done — Going Back to Bed" fires confetti on API failure — turn silently not recorded

**Labels:** `bug` `critical` `data-integrity`

## Summary

The primary action of the app — `handleDone` — fires a confetti animation and refreshes state whether or not the API call to `/api/complete-turn` actually succeeded. If the network drops or the server returns an error, the user sees a celebration while the turn was never recorded in the database.

## Current Behavior

```
Parent taps "Done — Going Back to Bed"
  → fetch('/api/complete-turn') fires
  → (regardless of result) confetti fires
  → fetchState() is called
```

If the API fails:
- Confetti fires showing a celebratory success animation
- `fetchState()` re-fetches the stale state (still shows it was their turn)
- The turn log is never written to the database
- No error is shown to the user

## Affected Code

`src/App.tsx:229-245`

```ts
const handleDone = async () => {
  await fetch('/api/complete-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  confetti({ ... });  // ← fires unconditionally
  fetchState();
};
```

## Why This Is Critical

This is the single most important interaction in the app. Silent failures here mean:
- The same parent gets logged as handling duty again the following night (wrong schedule)
- Partners see the wrong person "up next"
- The journal has a missing entry with no indication anything went wrong
- The user has no idea any of this happened — they saw confetti

## Fix

1. Add `try/catch` around the entire function
2. Check `res.ok` before firing confetti
3. Show a visible error toast on failure
4. Only call `fetchState()` after confirmed success

```ts
const handleDone = async () => {
  setIsDoneLoading(true);
  try {
    const res = await fetch('/api/complete-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    confetti({ ... });
    fetchState();
  } catch (err) {
    console.error('Failed to complete turn:', err);
    showToast('Something went wrong. Your turn may not have been saved — please try again.');
  } finally {
    setIsDoneLoading(false);
  }
};
```

## Button State During Request

The button should be disabled and show a loading indicator while the request is in-flight (see also: issue #02 — double-tap protection).

```tsx
<button
  onClick={handleDone}
  disabled={isDoneLoading}
  className={`... ${isDoneLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
>
  {isDoneLoading ? 'Saving...' : 'Done — Going Back to Bed'}
</button>
```

## Verification Steps

1. Open the app at night (or enable dev override for night mode)
2. Open DevTools → Network → set the `/api/complete-turn` request to "Block"
3. Tap "Done — Going Back to Bed"
4. **Expected:** Error toast appears, no confetti, button re-enables
5. **Actual (current):** Confetti fires, no error shown
6. Remove the block, try again — **Expected:** Confetti fires, turn advances correctly
