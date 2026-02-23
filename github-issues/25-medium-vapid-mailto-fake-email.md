# [MEDIUM] VAPID mailto is hardcoded to `test@example.com`

**Labels:** `bug` `medium` `backend` `notifications`

## Summary

The Web Push VAPID configuration uses `test@example.com` as the contact email. VAPID's `mailto:` field is used by push services to contact the app developer if their server is misbehaving. Using a fake address could cause push services to throttle, reject, or deprioritize push messages from this server.

## Affected Code

`server.ts:110` (approximately):

```ts
webpush.setVapidDetails(
  'mailto:test@example.com',  // ← fake address
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);
```

## Fix

Replace with a real contact email, ideally from an environment variable so it can be changed without a code deploy:

```ts
const vapidContactEmail = process.env.VAPID_CONTACT_EMAIL || 'your-real-email@example.com';

webpush.setVapidDetails(
  `mailto:${vapidContactEmail}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);
```

Add `VAPID_CONTACT_EMAIL` to `.env.example`:

```
VAPID_CONTACT_EMAIL=your@email.com
```

## Verification Steps

1. Search `server.ts` for `test@example.com`
2. Replace with real email via environment variable
3. Verify push notifications still deliver correctly after the change
