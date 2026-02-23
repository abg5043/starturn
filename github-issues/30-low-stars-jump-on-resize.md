# [LOW] Stars jump to random positions on any window resize

**Labels:** `low` `ui` `animation`

## Summary

`StarryBackground.tsx` re-initializes all stars with new random positions whenever the browser window is resized. On mobile, this happens frequently — when the keyboard appears/disappears, when the browser address bar hides/shows on scroll, and on device rotation. All stars visibly "jump" to new positions, creating jarring discontinuity.

## Affected Code

`src/components/StarryBackground.tsx:50-56` (approximately)

```ts
const handleResize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars(); // ← generates new random positions for all stars
};

window.addEventListener('resize', handleResize);
```

## Fix — Resize Canvas Without Reinitializing Stars

On resize, update the canvas dimensions and rescale existing star positions proportionally rather than reinitializing:

```ts
const handleResize = () => {
  const prevWidth = canvas.width;
  const prevHeight = canvas.height;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Scale existing star positions to new dimensions
  const scaleX = canvas.width / prevWidth;
  const scaleY = canvas.height / prevHeight;
  stars.forEach(star => {
    star.x *= scaleX;
    star.y *= scaleY;
  });
  // No reinit — stars keep their relative positions
};
```

## Alternative: Debounce the Resize

At minimum, debounce the resize handler so rapid consecutive resizes (keyboard appearing) don't each trigger a reinit:

```ts
let resizeTimeout: ReturnType<typeof setTimeout>;
const handleResize = () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initStars(); // Only reinit after resize settles (300ms)
  }, 300);
};
```

The proportional scaling approach is visually smoother; the debounce is the minimal fix.

## Verification Steps

1. Open the app on a mobile device or in browser with DevTools open
2. Resize the browser window continuously
3. **Expected (with fix):** Stars drift smoothly; no sudden jumps
4. **Actual (current):** All stars snap to new random positions on every resize event
5. On mobile: open the soft keyboard → stars jump; close it → stars jump again
