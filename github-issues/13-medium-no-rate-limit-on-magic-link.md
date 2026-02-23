# [MEDIUM] No rate limiting on magic link endpoint — inbox flooding possible

**Labels:** `security` `medium` `backend`

## Summary

`POST /api/auth/request-link` sends a magic link email to any provided address without any rate limiting. Anyone who knows a user's email address can flood their inbox by making repeated requests to this endpoint.

## Impact

- Malicious actor can spam a user's inbox with StarTurn emails
- Could be used to disrupt app access (inbox-filling as harassment)
- Could exhaust email service quota (Resend free tier: 100 emails/day)

## Fix

Add per-email rate limiting using a simple in-memory store (sufficient for a personal app):

```ts
// server.ts — near top, after imports
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= maxRequests) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}
```

```ts
// In POST /api/auth/request-link handler
app.post('/api/auth/request-link', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();

  // Allow max 3 magic link requests per email per 10 minutes
  const allowed = checkRateLimit(`magic-link:${email}`, 3, 10 * 60 * 1000);
  if (!allowed) {
    return res.status(429).json({
      error: 'Too many sign-in attempts. Please wait 10 minutes before trying again.'
    });
  }

  // ... rest of handler
});
```

Frontend should handle 429:

```ts
if (res.status === 429) {
  const data = await res.json();
  setEmailError(data.error);
  return;
}
```

## Cleanup

The in-memory store should be periodically cleaned up to prevent accumulation:

```ts
// Clean expired rate limit entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 60 * 60 * 1000);
```

## Verification Steps

1. Send 3 magic link requests for the same email quickly
2. On the 4th: **Expected:** 429 response, error message shown in UI
3. Wait 10 minutes
4. **Expected:** Requests are allowed again
