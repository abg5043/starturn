# [CRITICAL] Help modal describes a two-tap flow that doesn't exist in the UI

**Labels:** `bug` `critical` `ux` `content`

## Summary

The help modal describes a two-step nightly process ("tap 'I'm Going In' when the child wakes, tap again when you're back in bed") that does not match the actual single-tap UI. Users who read the help before their first night shift will be confused and may think the app is broken.

## Current Help Text

`src/components/HelpModal.tsx:39`

```
When it's your turn, tap "I'm Going In" when the child wakes.
Tap again when you're back in bed. The turn passes to your partner.
```

## Actual UI

There is no "I'm Going In" button anywhere in the app. The night-mode UI has exactly one button:

```
Done — Going Back to Bed
```

## Why This Matters

The help modal is the primary place a new user will go to understand how the app works. If it describes buttons that don't exist, users will:
1. Not trust the app
2. Think they're supposed to tap "Done" twice (which causes double-logging — see issue #02)
3. Think they're using an outdated version

## Fix

Rewrite the help section to match the actual single-tap flow:

**Proposed help copy:**

```
🌙 It's Your Turn
When the child wakes and it's your turn, handle the situation as normal.
When you're back in bed, tap "Done — Going Back to Bed" to log the wakeup
and pass the turn to your partner.

You can also:
• Skip my turn — pass this wakeup to your partner
• Let me take over — claim the turn if your partner can't respond

The journal (book icon) keeps a record of every wakeup so you can see
patterns over time.
```

## Additional Help Improvements

While updating the help text, consider also adding:

- A brief explanation of the **daytime view** (countdown to bedtime, who's up first)
- A note about what happens if **both parents are awake** simultaneously
- Clarification that "first up" means who handles the **first wakeup** of the night, not who puts the child to bed

## Verification Steps

1. Open the app during night mode
2. Tap the `?` help button
3. Read each bullet point aloud against the actual UI
4. Every button name mentioned should exist verbatim in the current UI
