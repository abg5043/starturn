# StarTurn — GitHub Issues Index

40 issues organized by priority. Each file contains title, description, code references, implementation suggestions, mockups, and verification steps.

---

## 🔴 Critical (5 issues)

| File | Title | Labels |
|---|---|---|
| `01-critical-handle-done-silent-failure.md` | "Done — Going Back to Bed" fires confetti on API failure | `bug` `critical` `data-integrity` |
| `02-critical-action-buttons-no-loading-state.md` | Action buttons have no loading/disabled state — double-tap can corrupt turn order | `bug` `critical` `data-integrity` |
| `03-critical-help-modal-describes-wrong-ui.md` | Help modal describes a two-tap flow that doesn't exist in the UI | `bug` `critical` `ux` `content` |
| `04-critical-scheduler-missing-timezone-arg.md` | Evening reminder scheduler uses server timezone instead of family timezone | `bug` `critical` `notifications` `backend` |
| `05-critical-scheduler-crash-on-bad-timezone.md` | One family with invalid timezone crashes the scheduler for all families | `bug` `critical` `backend` `notifications` |

---

## 🟠 High (7 issues)

| File | Title | Labels |
|---|---|---|
| `06-high-override-turn-no-error-handling.md` | Skip/Takeover overrides have no error handling — failures are invisible | `bug` `high` `ux` `error-handling` |
| `07-high-email-submit-silent-failure-no-loading.md` | Email submit fails silently — no error message, no loading state | `bug` `high` `ux` `onboarding` |
| `08-high-no-confirmation-on-override-actions.md` | No confirmation dialog on "Skip my turn" / "Let me take over" | `bug` `high` `ux` |
| `09-high-magic-link-error-unstyled-dead-end.md` | Magic link error page is unstyled, dead-end plain text | `bug` `high` `ux` `onboarding` |
| `10-high-session-expiry-no-feedback.md` | Session expiry silently dumps user to login screen with no explanation | `bug` `high` `ux` `auth` |
| `11-high-night-context-logic-broken-post-midnight.md` | Night-context logic is incorrect for post-midnight bedtimes | `bug` `high` `logic` `backend` |
| `12-high-journal-operations-fail-silently.md` | Journal operations fail without any user feedback | `bug` `high` `ux` `error-handling` |

---

## 🟡 Medium (13 issues)

| File | Title | Labels |
|---|---|---|
| `13-medium-no-rate-limit-on-magic-link.md` | No rate limiting on magic link endpoint — inbox flooding possible | `security` `medium` `backend` |
| `14-medium-internal-errors-leaked-to-clients.md` | Internal error messages leaked to API clients | `security` `medium` `backend` |
| `15-medium-no-back-button-on-setup-screen.md` | No "Back" button on Setup screen — users can get stuck | `ux` `medium` `onboarding` |
| `16-medium-no-daytime-turn-swap.md` | No way to swap who goes first tonight from the daytime view | `feature` `medium` `ux` |
| `17-medium-settings-button-no-aria-label.md` | Settings gear icon has no aria-label — inaccessible to screen readers | `accessibility` `medium` |
| `18-medium-toast-and-notification-prompt-overlap.md` | Toast notification and push permission prompt overlap at `bottom-6` | `bug` `medium` `ui` |
| `19-medium-modals-no-escape-no-focus-trap.md` | Modals do not close on Escape key — no focus trap | `ux` `accessibility` `medium` |
| `20-medium-no-notification-status-indicator.md` | No notification status indicator — can't tell if push is enabled | `ux` `medium` `notifications` |
| `21-medium-partner-email-not-changeable.md` | Partner email cannot be changed after setup | `ux` `medium` `feature` |
| `22-medium-evening-reminder-hard-to-clear-mobile.md` | Evening reminder "time" input is hard to clear on mobile | `ux` `medium` `settings` `mobile` |
| `23-medium-missing-database-indexes.md` | Missing database indexes on frequently queried columns | `performance` `medium` `backend` |
| `24-medium-settings-can-blank-parent-names.md` | Settings API accepts missing parent name fields — can blank out names silently | `bug` `medium` `backend` `data-integrity` |
| `25-medium-vapid-mailto-fake-email.md` | VAPID mailto is hardcoded to `test@example.com` | `bug` `medium` `backend` `notifications` |

---

## 🟢 Low (8 issues)

| File | Title | Labels |
|---|---|---|
| `26-low-no-offline-support.md` | No offline support in PWA — network error shown instead of graceful message | `ux` `low` `pwa` |
| `27-low-logout-no-confirmation.md` | Logout has no confirmation or feedback | `ux` `low` |
| `28-low-remove-unused-dependencies.md` | Remove unused `@google/genai` dependency and `cn()` utility | `chore` `low` `cleanup` |
| `29-low-missing-meta-description.md` | No `<meta name="description">` tag — poor social sharing and SEO | `low` `seo` `pwa` |
| `30-low-stars-jump-on-resize.md` | Stars jump to random positions on any window resize | `low` `ui` `animation` |
| `31-low-journal-no-pagination.md` | Journal loads all log records at once — no pagination | `performance` `low` `backend` |
| `32-low-bedtime-equals-waketime-validation.md` | Setting bedtime equal to wake time causes app to get stuck in permanent night mode | `bug` `low` `validation` |
| `33-low-relative-data-directory-path.md` | Database path uses relative `./data` — can create DB in wrong location | `low` `backend` `deployment` |

---

## 🔵 Features — Sleep Insights & Journal Expansion (7 issues)

All computable from the existing `logs` table (per-wakeup timestamps + parent names). No data migration needed for the first three; only the context tags feature requires a new DB table.

| File | Title | New data needed? |
|---|---|---|
| `34-feature-sleep-trends-chart.md` | Sleep Trends — chart showing wakeup improvement over time | No |
| `35-feature-sleep-stretch-tracker.md` | Sleep Stretch Tracker — visualize how long baby's initial stretch is growing | No |
| `36-feature-calendar-heatmap.md` | Calendar Heatmap — color-coded month view of sleep quality | No |
| `37-feature-night-context-tags.md` | Night Context Tags — annotate nights with "teething", "sick", "travel", etc. | Yes — new `nights` table |
| `38-feature-milestone-celebrations.md` | Milestone Celebrations — acknowledge sleep progress with confetti moments | Yes — new `milestones` table |
| `39-feature-partnership-equity-stats.md` | Partnership Equity Stats — see how fairly the nights are split | No |
| `40-feature-weekly-sleep-summary-notification.md` | Weekly Sleep Summary — push notification recapping last week's progress | No |

### Recommended build order

If implementing these together, build in this order to share infrastructure:

1. **#34 Trends chart** — establishes the Insights tab UI, the `/api/insights` endpoint, and the chart library
2. **#35 Sleep stretch** — adds one more chart series to the same endpoint and tab
3. **#36 Calendar heatmap** — third section in the same Insights tab; no new endpoints
4. **#39 Partnership stats** — fourth section in Insights tab; all computed server-side
5. **#38 Milestones** — hooks into `POST /api/complete-turn` response; adds milestone timeline to Insights tab
6. **#37 Context tags** — separate UI surface (night cards in journal); new DB table
7. **#40 Weekly summary** — extends the existing push notification scheduler; last because it depends on the insights math being solid

---

## Quick Wins (fix in under 30 minutes each)

If you want to knock out the easiest items first:

1. **#25** — Change `test@example.com` VAPID email (1 line)
2. **#17** — Add `aria-label="Settings"` to the gear button (1 line)
3. **#29** — Add `<meta name="description">` to `index.html` (5 lines)
4. **#04** — Add missing `setting.timezone` arg to scheduler call (1 line)
5. **#32** — Add bedtime === wakeTime validation (3 lines)
6. **#28** — Uninstall unused packages (`npm uninstall @google/genai clsx tailwind-merge`)
