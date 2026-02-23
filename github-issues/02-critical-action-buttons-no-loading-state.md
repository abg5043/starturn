# [CRITICAL] Action buttons have no loading/disabled state — double-tap can corrupt turn order

**Labels:** `bug` `critical` `data-integrity`

## Summary

The three primary night-mode action buttons — "Done — Going Back to Bed", "Skip my turn", and "Let me take over" — do not disable themselves or show a loading state while their API calls are in-flight. On a slow or congested network, a half-asleep parent tapping a button twice can trigger duplicate or conflicting API calls that corrupt the turn order.

## Current Behavior

All three buttons fire their handlers immediately on every click with no guard:

```tsx
// src/App.tsx:752-780
<button onClick={handleDone}>Done — Going Back to Bed</button>
<button onClick={() => handleOverrideTurn('skip')}>Skip my turn</button>
<button onClick={() => handleOverrideTurn('takeover')}>Let me take over</button>
```

None of the handlers set any `isLoading` state or disable the button during the request.

## Failure Scenarios

**Double-tap "Done":**
- Two `POST /api/complete-turn` requests fire
- First toggles the turn to parent B, second toggles it back to parent A
- Net result: the turn appears to have not changed, or the nightly log has two entries

**Double-tap "Skip":**
- Two overrides fire in quick succession
- Schedule is offset by two slots instead of one

**Tap "Done" + tap "Skip" before response:**
- Race condition between two different override types
- State is unpredictable at server side depending on which resolves last

## Affected Code

- `src/App.tsx:229-245` — `handleDone`
- `src/App.tsx:247-255` — `handleOverrideTurn`

## Fix

Add a shared `isActionLoading` state (or individual per-button states) and apply them to all three buttons.

```ts
const [isActionLoading, setIsActionLoading] = useState(false);

const handleDone = async () => {
  if (isActionLoading) return;
  setIsActionLoading(true);
  try {
    // ... fetch + confetti
  } finally {
    setIsActionLoading(false);
  }
};

const handleOverrideTurn = async (actionType: 'skip' | 'takeover') => {
  if (isActionLoading) return;
  setIsActionLoading(true);
  try {
    // ... fetch
  } finally {
    setIsActionLoading(false);
  }
};
```

```tsx
<button
  onClick={handleDone}
  disabled={isActionLoading}
  className={`... ${isActionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
>
  {isActionLoading ? (
    <span className="flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
    </span>
  ) : (
    'Done — Going Back to Bed'
  )}
</button>
```

Apply `disabled={isActionLoading}` to the skip and takeover buttons as well.

## Comparison

The "Resend Invite" button already does this correctly with a `resendingInvite` state. Apply the same pattern here.

## Verification Steps

1. Enable network throttling to "Slow 3G" in DevTools
2. Rapidly double-tap "Done — Going Back to Bed"
3. **Expected:** Second tap is ignored; button stays disabled until response returns
4. **Actual (current):** Two requests fire; turn index may be wrong afterward
5. Check the journal — **Expected:** exactly one entry for this wakeup
