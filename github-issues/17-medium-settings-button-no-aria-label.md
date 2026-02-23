# [MEDIUM] Settings gear icon has no aria-label — inaccessible to screen readers

**Labels:** `accessibility` `medium`

## Summary

The settings button in the header has no `aria-label`. Screen readers will announce it as "button" with no context, making it impossible to discover via assistive technology. The adjacent Help button correctly uses `aria-label="Help"`.

## Affected Code

`src/App.tsx:575-580`

```tsx
<button
  onClick={() => setShowSettings(true)}
  className="p-2 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm"
>
  <Settings className="w-6 h-6" />
</button>
```

Compare with the Help button:

```tsx
<button
  aria-label="Help"  // ← correct
  onClick={() => setShowHelpModal(true)}
  ...
>
  <HelpCircle className="w-5 h-5" />
</button>
```

## Fix

Add `aria-label` to the settings button:

```tsx
<button
  aria-label="Settings"
  onClick={() => setShowSettings(true)}
  className="p-2 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm"
>
  <Settings className="w-6 h-6" />
</button>
```

Also audit any other icon-only buttons (journal open button, close buttons on modals) to ensure they all have `aria-label` attributes.

## Additional Accessibility Quick Wins

While in this area:
- Modal overlays should have `role="dialog"` and `aria-modal="true"`
- Modal headings should be referenced with `aria-labelledby`
- Close buttons should have `aria-label="Close"`

Example:
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="settings-title">
  <h2 id="settings-title">Settings</h2>
  <button aria-label="Close settings" onClick={...}>
    <X className="w-5 h-5" />
  </button>
</div>
```

## Verification Steps

1. Install a screen reader (VoiceOver on Mac, NVDA on Windows)
2. Tab to the settings gear button in the header
3. **Expected:** Announces "Settings, button"
4. **Actual (current):** Announces "button" with no description
