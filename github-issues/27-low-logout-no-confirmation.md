# [LOW] Logout has no confirmation or feedback

**Labels:** `ux` `low`

## Summary

`handleLogout` immediately clears all state and logs the user out on first click. There is no confirmation dialog and no toast saying "You have been signed out." The user is just suddenly on the login screen, which can be disorienting.

## Affected Code

`src/App.tsx:308-319` — `handleLogout` runs synchronously on click with no guard.

## Fix

### Option A: Confirmation dialog (simple inline pattern)

```tsx
const [confirmLogout, setConfirmLogout] = useState(false);

{/* In the settings modal: */}
{!confirmLogout ? (
  <button
    onClick={() => setConfirmLogout(true)}
    className="... text-red-300 hover:text-red-200"
  >
    Sign Out
  </button>
) : (
  <div className="flex items-center gap-2">
    <p className="text-sm text-red-300">Sign out of StarTurn?</p>
    <button onClick={handleLogout} className="text-red-300 underline text-sm">Yes</button>
    <button onClick={() => setConfirmLogout(false)} className="text-indigo-300 underline text-sm">Cancel</button>
  </div>
)}
```

### Option B: Toast on the login screen (minimal change)

```ts
const handleLogout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  // ... clear state
  setAuthStatus('email-entry');
  showToast('You have been signed out.'); // toast on login screen
};
```

Option A is preferred as it prevents accidental logouts.

## Mockup — Inline Confirmation

```
Settings modal, bottom section:

Before tap:
  ┌─────────────────────────────┐
  │        Sign Out             │  ← subtle red text
  └─────────────────────────────┘

After tap:
  ┌─────────────────────────────────────────┐
  │  Sign out of StarTurn?  [Yes]  [Cancel] │
  └─────────────────────────────────────────┘
```

## Verification Steps

1. Open Settings
2. Tap "Sign Out"
3. **Expected:** Confirmation prompt appears
4. Tap "Cancel" → **Expected:** Stays logged in, settings still open
5. Tap "Sign Out" → "Yes" → **Expected:** Logged out with toast confirmation
