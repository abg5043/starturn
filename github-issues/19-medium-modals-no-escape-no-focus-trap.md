# [MEDIUM] Modals do not close on Escape key — no focus trap

**Labels:** `ux` `accessibility` `medium`

## Summary

None of the three modals (Settings, Journal, Help) respond to the Escape key. Once a modal is open, users must click the X button or the backdrop to close it. Additionally, keyboard-navigating users can Tab through the modal and escape it into the content behind — which is both a usability bug and a WCAG 2.1 violation (Success Criterion 2.1.2 — no keyboard trap in a good sense; dialogs must trap focus).

## Affected Modals

- `src/App.tsx` — Settings modal
- `src/components/JournalModal.tsx` — Night Journal modal
- `src/components/HelpModal.tsx` — Help modal

## Fix — Escape Key

Add a `useEffect` that listens for `keydown` and closes the modal:

```ts
// Generic reusable hook
function useEscapeKey(onEscape: () => void, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onEscape]);
}
```

Usage in each modal:

```ts
// In HelpModal.tsx
useEscapeKey(onClose, true);

// In JournalModal.tsx
useEscapeKey(onClose, true);

// In App.tsx for Settings
useEscapeKey(() => setShowSettings(false), showSettings);
```

## Fix — Focus Trap

When a modal opens, focus should move to the first focusable element inside it and tab should cycle within the modal:

```ts
function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, [isActive]);
}
```

## Additional: Modal ARIA Attributes

While adding focus management, also add proper ARIA roles:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  ref={modalRef}
>
  <h2 id="modal-title">Settings</h2>
  ...
</div>
```

## Verification Steps

1. Open the Help modal using the ? button
2. Press Escape → **Expected:** Modal closes
3. **Actual (current):** Nothing happens

4. Open the Settings modal
5. Tab through all interactive elements
6. **Expected:** Focus cycles within the modal, never reaches content behind overlay
7. **Actual (current):** Tab eventually exits the modal to the main page content
