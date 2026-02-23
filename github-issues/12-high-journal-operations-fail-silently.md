# [HIGH] Journal operations fail without any user feedback

**Labels:** `bug` `high` `ux` `error-handling`

## Summary

All write operations in the journal modal (add wakeup, edit entry, delete entry) silently return on failure with no error message to the user. Additionally, if the initial journal data fetch fails (network error), the user sees "No nights recorded yet" — identical to the legitimate empty state — with no way to distinguish between "no data" and "failed to load."

## Affected Code

`src/components/JournalModal.tsx`:

| Function | Failure behavior |
|---|---|
| `handleDeleteEntry` (line ~285) | Checks `res.ok`, returns silently on failure |
| `handleEditSave` (line ~304) | `console.error()` only |
| `handleAddWakeup` (line ~345) | Checks `res.ok`, returns silently on failure |
| Initial `fetchJournal` (line ~266) | Sets `loading=false`, shows empty state |

## User Impact

- User taps "Delete" and sees the entry disappear from their expectation — but it may not have been deleted
- "Save" appears to succeed (modal closes? or just nothing happens?)
- Empty journal on a data-filled account looks like all records were lost

## Fix — Add Error Toast to All Journal Operations

The app already has a `showToast` utility wired up. Use it:

```ts
const handleDeleteEntry = async (wakeupId: number) => {
  try {
    const res = await fetch(`/api/journal/wakeup/${wakeupId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    fetchJournal(); // re-fetch to confirm deletion
  } catch (err) {
    showToast('Couldn\'t delete that entry. Try again.');
  }
};

const handleEditSave = async () => {
  try {
    const res = await fetch(`/api/journal/wakeup/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: editNote })
    });
    if (!res.ok) throw new Error(`${res.status}`);
    setEditingId(null);
    fetchJournal();
  } catch (err) {
    showToast('Couldn\'t save changes. Try again.');
  }
};
```

## Fix — Distinguish Load Error from Empty State

```ts
const [journalError, setJournalError] = useState(false);

const fetchJournal = async () => {
  setLoading(true);
  setJournalError(false);
  try {
    const res = await fetch('/api/journal');
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    setNights(data);
  } catch (err) {
    console.error('Failed to load journal:', err);
    setJournalError(true);
  } finally {
    setLoading(false);
  }
};
```

```tsx
{/* In the render */}
{journalError ? (
  <div className="text-center text-indigo-200/60 py-12">
    <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
    <p>Couldn't load your journal.</p>
    <button
      onClick={fetchJournal}
      className="mt-3 text-indigo-300 underline text-sm"
    >
      Try again
    </button>
  </div>
) : nights.length === 0 ? (
  <p className="text-center text-indigo-200/60 py-12">No nights recorded yet</p>
) : (
  // normal journal list
)}
```

## Mockup — Load Error State

```
┌─────────────────────────────────┐
│       Night Journal      ✕      │
├─────────────────────────────────┤
│                                 │
│           ⚠                    │
│    Couldn't load your journal.  │
│         [Try again]             │
│                                 │
└─────────────────────────────────┘
```

## Verification Steps

1. Open the journal modal
2. Block the `/api/journal` request in DevTools Network
3. **Expected:** Error state with "Try again" button instead of empty state
4. **Actual (current):** "No nights recorded yet" — indistinguishable from real empty state

5. Add a wakeup entry, then block the writes endpoint
6. Tap "Add Wakeup"
7. **Expected:** Toast — "Couldn't save. Try again."
8. **Actual (current):** Nothing visible to user
