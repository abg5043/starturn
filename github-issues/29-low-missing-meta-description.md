# [LOW] No `<meta name="description">` tag — poor social sharing and SEO

**Labels:** `low` `seo` `pwa`

## Summary

`index.html` is missing a `<meta name="description">` tag. This affects:
- Link preview cards when the app URL is shared on iMessage, WhatsApp, Slack, etc.
- Search engine indexing (minor — it's an app, not a public site)
- Browser bookmark suggestions

## Current `index.html` `<head>`

```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StarTurn</title>
  <!-- no description meta -->
</head>
```

## Fix

Add description, Open Graph, and Apple-specific tags:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StarTurn — Fair Night Duty for Parents</title>

  <meta name="description" content="StarTurn helps co-parents fairly alternate nighttime baby duty, track wakeups, and stay coordinated — so everyone gets more sleep." />

  <!-- Open Graph (for link previews on social/messaging apps) -->
  <meta property="og:title" content="StarTurn" />
  <meta property="og:description" content="Fair night duty tracking for tired parents." />
  <meta property="og:type" content="website" />

  <!-- Apple PWA -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="StarTurn" />

  <!-- Theme color for browser chrome -->
  <meta name="theme-color" content="#312e81" />
</head>
```

## Bonus: App Icon

`manifest.json` and `index.html` currently reference `vite.svg` (the default Vite logo) as the favicon and app icon. Before sharing publicly, this should be replaced with a StarTurn-branded icon.

## Verification Steps

1. Share the app URL in an iMessage or Slack message
2. **Expected:** Rich preview card with app name and description
3. **Actual (current):** URL shown with no preview, generic icon, no description
