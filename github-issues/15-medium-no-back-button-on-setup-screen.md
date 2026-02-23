# [MEDIUM] No "Back" button on Setup screen — users can get stuck

**Labels:** `ux` `medium` `onboarding`

## Summary

The `SetupScreen` component has no way to navigate back to the email entry step. If a user arrives at setup accidentally, wants to use a different email address, or changes their mind, they are stuck — their only escape is to close the tab and return to the app fresh.

This is especially problematic because the setup step comes right after email auth, and users who have created accounts but not yet set up will land here every time they return.

## Comparison

The "Check Your Email" screen (`App.tsx:429`) correctly has a Back button:

```tsx
<button onClick={() => setAuthStatus('email-entry')}>
  ← Back
</button>
```

`SetupScreen` has no equivalent.

## Affected Code

`src/components/SetupScreen.tsx` — no back navigation rendered.

## Fix

Add an `onBack` prop to `SetupScreen` and render a back button:

```ts
// SetupScreen.tsx
interface SetupScreenProps {
  onComplete: () => void;
  onBack: () => void; // ← new
}

export default function SetupScreen({ onComplete, onBack }: SetupScreenProps) {
  return (
    <div ...>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-indigo-300 hover:text-white transition-colors text-sm mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Use a different email
      </button>

      {/* ... rest of setup form */}
    </div>
  );
}
```

```ts
// App.tsx — where SetupScreen is rendered
<SetupScreen
  onComplete={handleSetupComplete}
  onBack={() => {
    // Clear the partial account if needed, or just go back to email entry
    setAuthStatus('email-entry');
  }}
/>
```

## Mockup

```
┌──────────────────────────────────────────┐
│  ← Use a different email                 │  ← top-left, subtle
│                                          │
│         ✨ Set Up StarTurn               │
│                                          │
│  Your name                               │
│  ┌──────────────────────────────────┐   │
│  │  Alice                           │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ...                                     │
└──────────────────────────────────────────┘
```

## Consideration

If a partial family record was created during email auth, navigating back should be safe — setup completion requires explicit "Get Started" submission, so a half-filled form doesn't corrupt anything.

## Verification Steps

1. Enter an email and advance to the Setup screen
2. **Expected:** "← Use a different email" link is visible
3. Tap it → **Expected:** Returns to email entry screen
4. Enter a different email → **Expected:** Fresh setup flow initiates
