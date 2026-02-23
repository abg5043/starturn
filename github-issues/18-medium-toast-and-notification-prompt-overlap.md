# [MEDIUM] Toast notification and push permission prompt overlap at `bottom-6`

**Labels:** `bug` `medium` `ui`

## Summary

The toast notification and the push notification onboarding prompt are both positioned at `fixed bottom-6`. If a toast fires while the notification prompt is visible (e.g., just after login when the prompt appears and an action triggers a success toast), they render on top of each other as an illegible overlapping mess.

## Affected Code

`src/App.tsx:1152` — toast:
```tsx
<div className="fixed bottom-6 left-1/2 -translate-x-1/2 ...">
  {toast}
</div>
```

`src/App.tsx:1115` — notification prompt:
```tsx
<div className="fixed bottom-6 right-6 left-6 ...">
  Enable push notifications...
</div>
```

Both are at `bottom-6` (~24px from bottom). They overlap completely.

## Mockup — Current Broken State

```
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 [Enable notifications █████████]  ← notification prompt
    [  ✓ Settings saved!     ]      ← toast overlapping on top
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

## Fix — Stack Them Vertically

When the notification prompt is showing, move the toast above it:

**Option A: Dynamic toast offset (CSS variable)**

Measure the notification prompt height and offset toast accordingly:
```tsx
const notificationPromptRef = useRef<HTMLDivElement>(null);
const [toastOffset, setToastOffset] = useState(24); // default bottom-6 = 24px

useEffect(() => {
  if (showNotificationPrompt && notificationPromptRef.current) {
    const height = notificationPromptRef.current.offsetHeight;
    setToastOffset(24 + height + 12); // 12px gap
  } else {
    setToastOffset(24);
  }
}, [showNotificationPrompt]);

// Toast:
<div style={{ bottom: `${toastOffset}px` }} className="fixed left-1/2 -translate-x-1/2 ...">
```

**Option B: Fixed stacking with Tailwind classes (simpler)**

```tsx
// Toast — bump up when prompt is visible
<div className={`fixed ${showNotificationPrompt ? 'bottom-32' : 'bottom-6'} left-1/2 -translate-x-1/2 transition-all ...`}>
```

**Option C: Single notification area (best long-term)**

Consolidate all bottom UI into a single stacking container:

```tsx
<div className="fixed bottom-6 inset-x-0 px-6 flex flex-col gap-3 items-center pointer-events-none">
  {showNotificationPrompt && <NotificationPrompt className="pointer-events-auto w-full" />}
  {toast && <Toast className="pointer-events-auto" message={toast} />}
</div>
```

## Verification Steps

1. Log in to the app as a new user (notification prompt should appear at bottom)
2. Trigger a settings save or any action that fires a success toast
3. **Expected:** Toast appears above the notification prompt, both are fully readable
4. **Actual (current):** Toast and prompt overlap; text is illegible
