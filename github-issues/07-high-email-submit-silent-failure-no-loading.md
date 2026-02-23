# [HIGH] Email submit fails silently — no error message, no loading state

**Labels:** `bug` `high` `ux` `onboarding`

## Summary

Two problems on the email entry screen:

1. `handleEmailSubmit` catches network/server errors and only logs to console — the user sees nothing if it fails
2. The "Continue" button has no disabled/loading state during the API call — users on slow connections will tap repeatedly

Both problems compound each other: multiple silent failed requests with no feedback.

## Affected Code

`src/App.tsx:323-346` — error handler:

```ts
} catch (e) {
  console.error('Error looking up email:', e);
  // ← no toast, no error state, nothing shown to user
}
```

`src/App.tsx:502` — Continue button:

```tsx
<button onClick={handleEmailSubmit}>
  Continue
</button>
```

No `disabled` prop, no loading indicator.

## Mockup — Loading State

```
┌──────────────────────────────────────┐
│  Enter your email to get started     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  parent@example.com          │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ⟳  Sending magic link...   │    │  ← disabled, spinner
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

## Mockup — Error State

```
┌──────────────────────────────────────┐
│  Enter your email to get started     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  parent@example.com          │    │
│  └──────────────────────────────┘    │
│                                      │
│  ⚠ Couldn't send the link. Check    │
│    your connection and try again.    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │          Continue            │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

## Fix

```ts
const [isEmailLoading, setIsEmailLoading] = useState(false);
const [emailError, setEmailError] = useState<string | null>(null);

const handleEmailSubmit = async () => {
  setEmailError(null);
  setIsEmailLoading(true);
  try {
    const res = await fetch('/api/auth/request-link', { ... });
    if (!res.ok) throw new Error('Server error');
    setAuthStatus('check-email');
  } catch (e) {
    console.error('Error looking up email:', e);
    setEmailError('Couldn\'t send the link. Check your connection and try again.');
  } finally {
    setIsEmailLoading(false);
  }
};
```

```tsx
{emailError && (
  <p className="text-red-300 text-sm flex items-center gap-1">
    <AlertCircle className="w-4 h-4" />
    {emailError}
  </p>
)}

<button
  onClick={handleEmailSubmit}
  disabled={isEmailLoading || !email.trim()}
>
  {isEmailLoading ? (
    <span className="flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4" /> Sending...</span>
  ) : 'Continue'}
</button>
```

## Verification Steps

1. Block `/api/auth/request-link` in DevTools Network
2. Enter an email and tap "Continue"
3. **Expected:** Button disables + shows spinner, then error message appears
4. **Actual (current):** Button appears to do nothing; console shows error

Also test the happy path with throttled network:
5. Slow 3G → tap Continue once → **Expected:** button stays disabled until response
