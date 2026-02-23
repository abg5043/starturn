# [MEDIUM] No notification status indicator — can't tell if push is enabled

**Labels:** `ux` `medium` `notifications`

## Summary

The "Enable Notifications" button in the settings modal always looks identical regardless of whether push notifications are already enabled for this browser. After enabling, the only feedback is a transient toast. The next time the user opens settings, they cannot tell whether notifications are active.

## Current Settings UI

```
┌──────────────────────────────────────────┐
│  [🔔]  Enable Notifications              │  ← always looks the same
└──────────────────────────────────────────┘
```

No indicator for: active / inactive / denied by browser.

## Fix — Status-Aware Button States

The app can check `Notification.permission` and compare against stored subscriptions:

```tsx
type NotifStatus = 'unknown' | 'enabled' | 'disabled' | 'denied';

function useNotificationStatus(): NotifStatus {
  if (typeof Notification === 'undefined') return 'unknown';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'enabled';
  return 'disabled';
}
```

```tsx
const notifStatus = useNotificationStatus();

// Render different states:
{notifStatus === 'enabled' && (
  <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
    <div>
      <p className="font-medium">Notifications Active</p>
      <p className="text-sm text-indigo-200/60">You'll be notified when it's your turn</p>
    </div>
  </div>
)}

{notifStatus === 'disabled' && (
  <button onClick={handleEnableNotifications} className="...">
    <Bell className="w-5 h-5" />
    Enable Notifications
  </button>
)}

{notifStatus === 'denied' && (
  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-400/20">
    <BellOff className="w-5 h-5 text-amber-400 shrink-0" />
    <div>
      <p className="font-medium text-amber-200">Notifications Blocked</p>
      <p className="text-sm text-amber-200/70">
        Enable notifications in your browser settings to receive turn alerts.
      </p>
    </div>
  </div>
)}
```

## Mockup — Three States

```
State 1: Not yet enabled
┌─────────────────────────────────────────┐
│  🔔  Enable Notifications               │
│      Get alerted when it's your turn    │
└─────────────────────────────────────────┘

State 2: Enabled
┌─────────────────────────────────────────┐
│  ✅  Notifications Active               │
│      You'll be notified when it's       │
│      your turn                          │
└─────────────────────────────────────────┘

State 3: Blocked by browser
┌─────────────────────────────────────────┐
│  ⚠  Notifications Blocked              │
│     Enable notifications in your        │
│     browser settings to receive alerts  │
└─────────────────────────────────────────┘
```

## Verification Steps

1. Open Settings before enabling notifications
2. **Expected:** "Enable Notifications" button shown
3. Tap Enable, grant permission
4. Re-open Settings
5. **Expected:** "Notifications Active" indicator with checkmark
6. Manually block notifications in browser settings
7. Re-open Settings
8. **Expected:** "Notifications Blocked" amber warning with instructions
