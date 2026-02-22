# Future Features

Deferred improvements and ideas for StarTurn. These were identified during a comprehensive app review but deprioritized for the current release.

---

## Account Recovery / Email Change
- Allow users to update their email address from Settings.
- "Forgot which email I used" recovery flow.
- Complexity: Requires re-verification of the new email, handling edge cases where both parents change emails, and potentially migrating magic link history.

## Rate Limiting
- Add rate limiting to unauthenticated endpoints (`/api/auth/email-lookup`, `/api/auth/setup`, `/api/auth/request-link`) to prevent abuse.
- Options: `express-rate-limit` middleware, or a simple in-memory counter per IP.
- Suggested limits: 5 requests per minute for email-lookup, 3 per hour for setup, 5 per 15 minutes for request-link.

## Enhanced Night Journal
- Add duration tracking (time between "going in" and "done").
- Weekly/monthly summary stats (total trips, average duration, trips per parent).
- Export journal data as CSV.

## Improved Notification Management
- Show current notification subscription status in Settings.
- "Test notification" button to verify push is working.
- Ability to unsubscribe from notifications without clearing browser data.

## Multi-Child Support
- Track turns separately for multiple children.
- Each child gets their own rotation, journal, and notification settings.

## Dark/Light Theme Toggle
- Currently night-themed only. Some users may prefer a lighter theme during daytime mode.

## Offline Support
- Service worker caching for offline access to the dashboard.
- Queue actions (complete turn, skip) while offline and sync when back online.

## Accessibility Improvements
- Audit and improve ARIA labels across all interactive elements.
- Keyboard navigation for all modals and buttons.
- Screen reader testing.

## Analytics / Insights Dashboard
- Visualize sleep patterns over time.
- Show which parent is handling more wake-ups (fairness tracking).
- Trend lines for number of trips per night.
