# [HIGH] No confirmation dialog on "Skip my turn" / "Let me take over"

**Labels:** `bug` `high` `ux`

## Summary

The skip and takeover buttons fire their API calls immediately on tap — no confirmation dialog. These are significant, non-reversible overrides. At 3 AM, when parents are half-asleep, accidental taps of nearby buttons are highly likely.

Compare: the journal's delete action already has a confirmation. These more consequential actions do not.

## Buttons Without Confirmation

`src/App.tsx:760,772`

```tsx
<button onClick={() => handleOverrideTurn('skip')}>Skip my turn</button>
<button onClick={() => handleOverrideTurn('takeover')}>Let me take over for {partnerName}</button>
```

## Impact

- Parent accidentally taps "Skip my turn" — their turn is passed, partner is woken for nothing
- Parent accidentally taps "Let me take over" — a push notification is sent to partner unnecessarily
- No undo is possible

## Fix: Inline Confirmation Pattern

Rather than a modal (which is heavier UX and harder on mobile at night), consider an inline confirmation that replaces the button content:

```
Step 1 — Normal state:
  ┌──────────────────────────────┐
  │  ↪  Skip my turn             │
  └──────────────────────────────┘

Step 2 — After first tap (button expands):
  ┌──────────────────────────────┐
  │  Are you sure? Pass this     │
  │  wakeup to {partnerName}?    │
  │  ┌──────────┐ ┌──────────┐  │
  │  │ Yes, skip│ │  Cancel  │  │
  └──────────────────────────────┘
```

Implementation sketch:

```ts
const [pendingAction, setPendingAction] = useState<'skip' | 'takeover' | null>(null);

// First tap — show confirmation
const requestOverrideTurn = (actionType: 'skip' | 'takeover') => {
  setPendingAction(actionType);
};

// Second tap — actually fires
const confirmOverrideTurn = async () => {
  if (!pendingAction) return;
  await handleOverrideTurn(pendingAction);
  setPendingAction(null);
};
```

```tsx
{pendingAction === 'skip' ? (
  <div className="rounded-xl bg-white/10 p-4">
    <p className="text-sm text-indigo-100 mb-3">
      Pass this wakeup to {partnerName}?
    </p>
    <div className="flex gap-2">
      <button onClick={confirmOverrideTurn} className="flex-1 ...">Yes, skip my turn</button>
      <button onClick={() => setPendingAction(null)} className="flex-1 ...">Cancel</button>
    </div>
  </div>
) : (
  <button onClick={() => requestOverrideTurn('skip')}>
    Skip my turn
  </button>
)}
```

## Alternatives Considered

- **Modal dialog:** Heavier; harder to dismiss at night; adds overlay complexity
- **Long-press:** Non-discoverable on web
- **Inline confirmation (recommended):** Same position, second deliberate tap required, easily cancellable

## Verification Steps

1. Enter night mode and tap "Skip my turn"
2. **Expected:** Confirmation UI appears in place of the button
3. Tap "Cancel" — **Expected:** Returns to original button, no API call made
4. Tap "Skip my turn" again → confirm → **Expected:** Override fires successfully
5. Test same flow for "Let me take over"
