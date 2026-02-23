# [LOW] No offline support in PWA — network error shown instead of graceful message

**Labels:** `ux` `low` `pwa`

## Summary

The app has a `manifest.json` and a `service-worker.js`, giving it the shell of a PWA. However, the service worker only handles push notification events — it has no caching strategy. If a user opens the installed PWA without a network connection (common scenario: just woken up at 3 AM, still connecting), they see the browser's generic "no internet" error page instead of the app.

## Current `public/sw.js`

Service worker only registers `push` and `notificationclick` listeners. No `install`, `activate`, or `fetch` handlers.

## Fix — Add App Shell Caching

Cache the app shell on install and serve it from cache when offline:

```js
const CACHE_NAME = 'starturn-v1';

// Files to cache for offline
const APP_SHELL = [
  '/',
  '/index.html',
  // Vite will generate hashed filenames — use a pattern or
  // inject the manifest with Workbox (see below)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // For navigation requests: serve index.html from cache if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
```

## Recommended: Use Vite PWA Plugin

For a Vite project, `vite-plugin-pwa` (with Workbox) handles cache manifest generation automatically:

```bash
npm install vite-plugin-pwa
```

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [{
          urlPattern: /^\/api\//,
          handler: 'NetworkFirst',
        }]
      }
    })
  ]
});
```

## Offline UI Consideration

When the app loads offline from cache, API calls will fail. Consider showing an offline banner:

```tsx
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

{!isOnline && (
  <div className="fixed top-16 inset-x-4 z-50 bg-amber-500/20 border border-amber-400/30 rounded-xl px-4 py-2 text-sm text-amber-200 text-center">
    You're offline — changes won't be saved until you reconnect
  </div>
)}
```

## Verification Steps

1. Install the app as a PWA on mobile
2. Enable airplane mode
3. Open the app
4. **Expected (with fix):** App shell loads, offline banner shown, graceful empty state
5. **Actual (current):** Browser "no internet connection" error page
