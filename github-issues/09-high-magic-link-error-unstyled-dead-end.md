# [HIGH] Magic link error page is unstyled, dead-end plain text

**Labels:** `bug` `high` `ux` `onboarding`

## Summary

When a user taps an expired or invalid magic link, the server returns a raw plain-text error response — black text on a white page, no styling, no app chrome, no navigation. This is a dead end: there is no button to request a new link, no navigation back to the app, and no visual indication this is even the right website.

## Affected Code

`server.ts:531`

```ts
if (!result) return res.status(400).send('Invalid or expired link. Please request a new one.');
```

## What the User Sees

```
Invalid or expired link. Please request a new one.
```

Plain black 16px text on a white background. No header, no buttons, no brand.

## Why This Matters

Magic links expire, especially if:
- The user requested multiple links and used an older one
- The link email was delayed in spam
- The user waited too long before tapping

This is a **very common onboarding failure path** that new users will hit frequently.

## Fix

Replace the `res.send()` with a full HTML page that:
1. Matches the app's visual style (indigo/dark gradient, card, Lucide-style icon)
2. Has a clear CTA to request a new link
3. Links back to the app root

```ts
if (!result) {
  return res.status(400).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Link Expired — StarTurn</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%);
          font-family: system-ui, -apple-system, sans-serif;
          color: #e0e7ff;
        }
        .card {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          max-width: 380px;
          width: 90%;
          text-align: center;
          backdrop-filter: blur(12px);
        }
        .icon { font-size: 2.5rem; margin-bottom: 1rem; }
        h1 { font-size: 1.4rem; font-weight: 600; margin-bottom: 0.75rem; }
        p { color: rgba(199,210,254,0.8); line-height: 1.6; margin-bottom: 1.5rem; }
        a {
          display: inline-block;
          background: #6366f1;
          color: white;
          text-decoration: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          font-weight: 500;
          transition: background 0.2s;
        }
        a:hover { background: #4f46e5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🔒</div>
        <h1>Link Expired</h1>
        <p>This sign-in link has expired or has already been used. They're only valid for 15 minutes.</p>
        <a href="/">Request a New Link</a>
      </div>
    </body>
    </html>
  `);
}
```

## Mockup

```
┌────────────────────────────────────┐
│           🔒                       │
│                                    │
│        Link Expired                │
│                                    │
│  This sign-in link has expired or  │
│  has already been used. They're    │
│  only valid for 15 minutes.        │
│                                    │
│  ┌──────────────────────────────┐  │
│  │     Request a New Link       │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

(dark indigo gradient background, glass card, matches app brand)

## Verification Steps

1. Request a magic link
2. Modify the token in the URL to be invalid (change a character)
3. Navigate to the modified URL
4. **Expected:** Styled error page with "Request a New Link" button
5. **Actual (current):** Unstyled plain text error on white background
6. Tap "Request a New Link" → **Expected:** Returns to the app email entry screen
