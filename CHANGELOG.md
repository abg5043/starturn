# Changelog

All notable changes to StarTurn are documented here.

---

## 2026-02-21 — UI/UX Polish & Production Hardening

### Features
- **Notification onboarding prompt**: After first login, users see a one-time floating prompt encouraging them to enable push notifications. Can be dismissed or enabled with a single tap.
- **"Partner hasn't joined" banner**: When the invited partner hasn't signed in yet, the dashboard shows an amber banner with a "Resend Invite" button.
- **Resend invite endpoint**: New `/api/resend-invite` API lets authenticated users re-send the partner invitation email.
- **Settings save toast**: A green checkmark toast confirms when settings are saved successfully.
- **Two-tap night buttons**: Split the single "I'm Going In / Done" button into two distinct steps: "I'm Going In" (when heading to the child) and "Done — Back in Bed" (when returning). Confetti fires on the second tap.
- **Welcome card for invited partners**: When the invited partner (parent 2) signs in for the first time, a brief welcome message appears acknowledging who invited them.

### UI Improvements
- **Partner name in header**: The dashboard header now shows "{You} & {Partner}" instead of just "Hi, {You}".
- **Larger countdown**: The daytime countdown number is now `text-6xl font-extrabold` with tighter tracking for visual emphasis.
- **Journal modal**: Increased max-height from 85vh to 92vh for more vertical space on mobile.
- **Toast notifications**: All former `alert()` calls (notification enable/block/error) replaced with animated inline toasts that auto-dismiss after 3 seconds. Three styles: success (green), error (red), and info (indigo).

### UX Improvements
- **SetupScreen helper text**: "Who goes first tonight?" now has a subtitle: "Pick who takes the first shift tonight. You'll alternate from here."
- **SetupScreen partner email hint**: Below the partner email field: "We'll send them an invite to join your StarTurn."
- **Better error messages**: Server errors in the setup flow are mapped to friendly, human-readable messages (e.g., "Email already registered" becomes "This email is already linked to a StarTurn family. Try signing in instead.").
- **Client-side validation**: Names capped at 30 characters (with maxLength on inputs). Same-email check prevents using the same address for both parents.

### Production Readiness
- **Security headers**: Added `helmet` middleware with CSP disabled (required for Vite's inline scripts). Adds X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, and other standard headers.
- **Input validation**: Server-side validation for email format, time format (HH:MM), name length (30 char max), rotation mode values, and duplicate email prevention.
- **Input sanitization**: All parent names are trimmed and capped server-side via `sanitizeName()`. Invalid times/rotation modes fall back to safe defaults.

### Documentation
- Updated README.md to reflect email-based auth (replacing old "Family Name" flow), added environment variable table.
- Created CHANGELOG.md (this file).
- Created FUTURE.md for deferred features.

---

## 2026-02-20 — Landing Page & Help Modal

- **Redesigned landing page**: New visitors see a tagline ("Take turns on night duty — so both parents can rest"), a feature list (On duty / Rests easy / Swap with one tap / Syncs across phones), and a sign-in divider. Returning users see a simpler "Welcome back" message.
- **Help modal**: Added a question-mark icon in the dashboard header that opens a popout modal explaining how StarTurn works (On Duty, Rest Mode, Skip/Take Over, Night Journal, Settings, Install as App).
- Changed "baby" to "child" in help text.

---

## 2026-02-19 — Night Rotation Modes

- **Alternate nightly mode** (default): Regardless of mid-night switches, the parent who went first last night goes second tonight. Enforced by the wake-time scheduler.
- **Continue from last mode**: Whoever is next after last night's final trip stays next tonight. No wake-time reset.
- Radio-card style UI in Settings for choosing rotation mode.
- Descriptive variable names and named constants (`PARENT_1`, `PARENT_2`, `ROTATION_ALTERNATE_NIGHTLY`, `ROTATION_CONTINUE_FROM_LAST`) for clear, prose-like code.
- Helper functions: `parentNameByIndex()`, `oppositeIndex()`.

---

## 2026-02-18 — Magic Link Auth & Sessions

- Replaced family-name login with email-first authentication flow.
- Magic link emails via Resend API (15-minute expiry, single-use tokens).
- Cookie-based sessions (30-day, httpOnly, auto-refresh when <3 days remaining).
- Partner invite emails sent during setup.
- Two-parent-per-family model with `parent1_email` and `parent2_email` in settings.

---

## Earlier — Initial Release

- Core turn-tracking functionality (on duty / resting).
- Real-time state polling (3-second interval).
- Push notifications via Web Push (VAPID).
- Night journal with trip history grouped by date.
- Bedtime/wake-time countdown with animated progress ring.
- PWA support (manifest, service worker, standalone display).
- Starry background canvas animation.
- Confetti on turn completion.
