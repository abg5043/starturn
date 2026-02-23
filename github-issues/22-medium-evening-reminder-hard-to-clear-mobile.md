# [MEDIUM] Evening reminder "time" input is hard to clear on mobile — no disable toggle

**Labels:** `ux` `medium` `settings` `mobile`

## Summary

The evening reminder time input in Settings is a `type="time"` HTML input. The hint text says "Leave blank to disable," but on iOS and many Android browsers, the native time picker does not offer a way to clear the field once a value has been set. Users can only modify the time, not remove it — making it impossible to disable the reminder from mobile.

## Affected Code

`src/App.tsx:983` (approximately)

```tsx
<input
  type="time"
  value={settingsReminderTime}
  onChange={e => setSettingsReminderTime(e.target.value)}
  className="..."
/>
<p className="text-xs text-indigo-300/60 mt-1">Leave blank to disable</p>
```

## Problem

- On iOS: tapping the time field opens the scroll-wheel date picker; there is no "clear" option
- On Android Chrome: same behavior, no clear/erase option in the native picker
- Once a time is set, the user is stuck with a reminder

## Fix — Add an Explicit Enable/Disable Toggle

Replace the "leave blank" pattern with an explicit toggle that controls whether the field is active:

```tsx
const [reminderEnabled, setReminderEnabled] = useState(!!settingsReminderTime);

// When toggle is off, the saved value is null/empty
// When toggle is on, show the time picker
```

```tsx
{/* Toggle row */}
<div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
  <div>
    <p className="font-medium">Evening Reminder</p>
    <p className="text-sm text-indigo-200/60">
      {reminderEnabled
        ? `Sends a reminder at ${settingsReminderTime}`
        : 'No reminder scheduled'}
    </p>
  </div>
  <button
    role="switch"
    aria-checked={reminderEnabled}
    onClick={() => {
      setReminderEnabled(prev => !prev);
      if (reminderEnabled) setSettingsReminderTime('');
    }}
    className={`relative w-12 h-6 rounded-full transition-colors ${
      reminderEnabled ? 'bg-indigo-500' : 'bg-white/20'
    }`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
      reminderEnabled ? 'translate-x-6' : 'translate-x-0'
    }`} />
  </button>
</div>

{/* Time picker — only shown when enabled */}
{reminderEnabled && (
  <div className="mt-2">
    <input
      type="time"
      value={settingsReminderTime || '20:00'}
      onChange={e => setSettingsReminderTime(e.target.value)}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
    />
  </div>
)}
```

## Mockup

```
Reminder Off:
┌──────────────────────────────────────────┐
│  Evening Reminder        [  ○──]         │
│  No reminder scheduled                   │
└──────────────────────────────────────────┘

Reminder On:
┌──────────────────────────────────────────┐
│  Evening Reminder        [──● ]          │
│  Sends a reminder at 8:00 PM             │
│  ┌──────────────────────────────────┐   │
│  │  8:00 PM                         │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

## Verification Steps

1. On an iOS device, open Settings
2. Enable the reminder, set a time
3. Try to disable the reminder using the old "clear the field" approach
4. **Actual (current):** Impossible — the native time picker has no clear option
5. With the fix: toggle off → **Expected:** Reminder is disabled, field hidden, confirmed on save
