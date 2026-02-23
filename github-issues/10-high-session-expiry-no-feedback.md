# [HIGH] Session expiry silently dumps user to login screen with no explanation

**Labels:** `bug` `high` `ux` `auth`

## Summary

When a session expires while the app is actively in use, the 401 response from `/api/state` causes the app to silently switch to `authStatus = 'unauthenticated'` — the user is just suddenly on the login screen. No message, no explanation. They may think the app crashed or they accidentally did something.

## Affected Code

`src/App.tsx:207-208`

```ts
if (res.status === 401) {
  setAuthStatus('unauthenticated');
  return null;
}
```

## User Experience Impact

A parent who left the app open overnight (exactly the use case) will often have their session expire. When they open the app the next morning, they're on the login screen. They have no idea why. This is especially confusing because:
- They may not remember their email address
- They may think something is wrong with the app
- They may not realize their progress/state is safe and waiting

## Fix

Before redirecting, show a brief toast or notification explaining what happened:

```ts
if (res.status === 401) {
  showToast('Your session has expired — please sign in again.', { duration: 5000 });
  setAuthStatus('unauthenticated');
  return null;
}
```

Also pre-fill the email field on the login screen if we have it in localStorage:

```ts
// On login screen render, check for last-used email
useEffect(() => {
  const savedEmail = localStorage.getItem('starturn_last_email');
  if (savedEmail) setEmail(savedEmail);
}, []);

// In handleEmailSubmit, save the email
localStorage.setItem('starturn_last_email', email);
```

This way, when a user is returned to login after session expiry, their email is pre-filled and they just need to tap "Continue."

## Enhanced UX Mockup

```
┌────────────────────────────────────────────────┐
│  ⚠  Your session expired — sign in to continue │  ← toast, 5 seconds
└────────────────────────────────────────────────┘

Then on login screen:
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐    │
│  │  alice@example.com           │    │  ← pre-filled from localStorage
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │          Continue            │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

## Verification Steps

1. Log in and use the app
2. Manually expire the session: delete the session cookie in DevTools → Application → Cookies
3. Trigger any action (or wait for the 30s poll)
4. **Expected:** Toast "Your session has expired — please sign in again" → login screen with email pre-filled
5. **Actual (current):** Silently redirected to empty login screen
