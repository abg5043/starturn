# [MEDIUM] No way to swap who goes first tonight from the daytime view

**Labels:** `feature` `medium` `ux`

## Summary

The daytime dashboard tells the user who is "up first tonight" but provides no way to manually swap the order before bedtime. If a parent knows they will be unavailable, exhausted, or unwell before the night starts, they have no recourse from the daytime view — they must wait until night mode activates to use the skip/takeover options.

## Current Daytime UI (Paraphrase)

```
🌙  Tonight: Alice is up first
    Bedtime in 3h 22m
```

No action controls.

## Fix — Add a "Swap Tonight" Button to Daytime View

### Option A: Simple swap button (recommended)

```
┌──────────────────────────────────────────┐
│  🌙  Tonight                             │
│  Alice is up first                       │
│                                          │
│  Bedtime in 3h 22m                       │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  ↕  Swap — Bob goes first        │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### Option B: Subtle secondary link

```
Alice is up first tonight · [Swap]
```

## API

This needs a new endpoint or can reuse `POST /api/override-turn` with an `action: 'swap-daytime'` type. The simplest approach:

```ts
POST /api/swap-tonight
// Flips which parent goes first for tonight without affecting the alternating schedule.
// Resets at bedtime or when a real wakeup is logged.
```

## Alternative: Surface This as "Set Tonight Manually"

Could also be a toggle in settings or a daytime-specific card:

```
┌──────────────────────────────────────────┐
│  Tomorrow night: Alice up first          │
│                                          │
│  ○ Use automatic schedule                │
│  ● Alice first tonight    [Change]       │
└──────────────────────────────────────────┘
```

## Edge Cases to Consider

- Swapping should not affect the underlying alternating schedule (tomorrow reverts to normal)
- Journal should note the swap (e.g., "manually swapped" flag on the night entry)
- If already in night mode when swap is attempted, use existing skip/takeover instead

## Verification Steps

1. Open app during daytime
2. Note who is listed as going first tonight
3. Tap "Swap" → **Expected:** The other parent's name now shows as going first
4. Wait for night mode to activate → **Expected:** The swapped parent is indeed shown as "Your turn" (or partner's turn, depending on who you're logged in as)
5. Next day in daytime → **Expected:** Schedule reverts to the normal alternating pattern
