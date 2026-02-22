# Claude Code Preferences

## Code Style

- Use explicit comments explaining *why*, not just *what*.
- Use very descriptive variable and function names (e.g., `parentWhoWentFirstLastNight`, `shouldAlternateNightly`).
- Use named constants instead of raw index numbers (e.g., `PARENT_1 = 0`, `PARENT_2 = 1` rather than bare `0`/`1`).
- Extract small helper functions for readability (e.g., `parentNameByIndex()`, `oppositeIndex()`).
- Code should read like prose — someone unfamiliar with the codebase should be able to follow the logic.

## UI/UX Preferences

- Keep the UI minimal but informative — don't add clutter, but don't leave users guessing.
- Opening/landing pages should explain what the app does and why it exists (not just a bare login form).
- Include a help button (question mark icon) on the main dashboard with popout instructions.
- Radio-style settings cards with short descriptions are preferred over bare toggles or dropdowns.
- Match the existing design language: glass cards (`bg-white/5 border border-white/10`), indigo/purple gradients, Lucide icons.

## Implementation Approach

- Always mock up and discuss changes before implementing.
- Present new features as text-based mockups first so the user can review layout, copy, and flow.
- Avoid over-engineering — only add what's needed for the current feature.
- When modifying server logic, always update both the scheduler and the `/api/state` endpoint in tandem.
- Default new settings to preserve existing behavior (e.g., `rotation_mode` defaults to `'alternate_nightly'`).
