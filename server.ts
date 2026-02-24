import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Resend } from 'resend';
import {
  getSettings, updateSettings, toggleTurn, logAction, getLogs,
  saveSubscription, getSubscriptions, getVapidKeys, saveVapidKeys,
  getAllSettings, getFirstTripOfNight, setTurnIndex, getJournal,
  deleteJournalEntry, clearJournalNight, updateJournalEntry, insertJournalEntry,
  createMagicLink, consumeMagicLink, createSession, getSession,
  deleteSession, cleanupExpired, getParentEmail,
  saveSubscriptionWithParent, getSubscriptionsForParent,
  findFamilyByEmail, generateFamilyId, createFamily,
  hasPartnerEverLoggedIn
} from "./src/db";
import webpush from 'web-push';
import { subDays } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Parent index constants (readable alternatives to raw 0/1) ─────────────
const PARENT_1 = 0;
const PARENT_2 = 1;

// ─── Rotation mode constants ───────────────────────────────────────────────
const ROTATION_ALTERNATE_NIGHTLY = 'alternate_nightly';
const ROTATION_CONTINUE_FROM_LAST = 'continue_from_last';

// ─── Resend (email) ─────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendMagicLinkEmail(email: string, token: string, parentName: string) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${baseUrl}/api/auth/verify?token=${token}`;

  if (!resend) {
    console.log(`[DEV] Magic link for ${parentName}: ${link}`);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM || 'StarTurn <noreply@starturn.app>',
    to: email,
    subject: 'Sign in to StarTurn',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #312e81;">Hi ${parentName},</h2>
        <p>Click below to sign in to StarTurn:</p>
        <a href="${link}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Sign in to StarTurn</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">This link expires in 15 minutes.</p>
      </div>
    `
  });

  if (error) {
    console.error('Failed to send magic link email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log(`Magic link email sent successfully to ${email} (ID: ${data?.id})`);
}

async function sendInviteEmail(email: string, recipientName: string, inviterName: string) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  if (!resend) {
    console.log(`[DEV] Invite email for ${recipientName} (invited by ${inviterName}): ${baseUrl}`);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM || 'StarTurn <noreply@starturn.app>',
    to: email,
    subject: `${inviterName} invited you to StarTurn`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #312e81;">Hi ${recipientName},</h2>
        <p>${inviterName} invited you to share nighttime duties on StarTurn!</p>
        <p>StarTurn helps you and ${inviterName} take turns with nighttime wake-ups, so everyone knows whose turn it is.</p>
        <a href="${baseUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Get Started</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">Just enter your email address when you get there, and you'll be linked up automatically.</p>
      </div>
    `
  });

  if (error) {
    console.error('Failed to send invite email:', error);
  } else {
    console.log(`Invite email sent successfully to ${email} (ID: ${data?.id})`);
  }
}

// ─── VAPID keys (push notifications) ────────────────────────────────────────
let vapidKeys: { publicKey: string, privateKey: string };
const storedKeys: any = getVapidKeys();

if (storedKeys) {
  vapidKeys = { publicKey: storedKeys.public_key, privateKey: storedKeys.private_key };
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  saveVapidKeys(vapidKeys.publicKey, vapidKeys.privateKey);
}

webpush.setVapidDetails(
  'mailto:test@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// ─── Helper: resolve parent name from index ───────────────────────────────

function parentNameByIndex(settings: any, index: number): string {
  return index === PARENT_1 ? settings.parent1_name : settings.parent2_name;
}

function oppositeIndex(index: number): number {
  return index === PARENT_1 ? PARENT_2 : PARENT_1;
}

// ─── Timezone-aware time helpers ─────────────────────────────────────────────
//
// The server may run in UTC while families live in any time zone. All
// scheduler comparisons and night-context calculations must use the family's
// local time, not the server clock.  We use the built-in Intl.DateTimeFormat
// API so no extra packages are required.

// Returns the current time as "HH:mm" in the given IANA timezone.
// Normalises the rare "24:00" midnight edge case to "00:00".
function currentTimeInZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(date);
  const hour   = (parts.find(p => p.type === 'hour')?.value   ?? '00').padStart(2, '0');
  const minute = (parts.find(p => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  return `${hour === '24' ? '00' : hour}:${minute}`;
}

// Returns the current date as "YYYY-MM-DD" in the given IANA timezone.
// The 'en-CA' locale reliably formats dates as YYYY-MM-DD.
function currentDateInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
  }).format(date);
}

// ─── Night context helper ───────────────────────────────────────────────────
function computeNightContext(now: Date, bedtime: string, wakeTime: string, timezone: string): { isNight: boolean; nightDate: string } {
  const [btH, btM] = bedtime.split(':').map(Number);
  const [wtH, wtM] = wakeTime.split(':').map(Number);

  // Get the current HH:mm in the family's local timezone so comparisons
  // are correct regardless of where the server is hosted.
  const localTime = currentTimeInZone(now, timezone);
  const [lH, lM]  = localTime.split(':').map(Number);
  const totalMins = lH * 60 + lM;
  const btMins    = btH * 60 + btM;
  const wtMins    = wtH * 60 + wtM;

  const isNight = totalMins >= btMins || totalMins < wtMins;

  let nightDate: string;
  if (totalMins >= btMins) {
    // After bedtime on the same calendar day
    nightDate = currentDateInZone(now, timezone);
  } else {
    // Before wake time — the night started on the previous calendar day
    nightDate = currentDateInZone(subDays(now, 1), timezone);
  }

  return { isNight, nightDate };
}

// ─── Push notification helpers ──────────────────────────────────────────────

function sendPushToFamily(familyId: string, title: string, body: string) {
  const payload = JSON.stringify({ title, body });
  const subs = getSubscriptions(familyId);
  subs.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(`Push error for ${familyId}:`, err));
  });
}

function sendPushToParent(familyId: string, parentIndex: number, title: string, body: string) {
  const payload = JSON.stringify({ title, body });
  const subs = getSubscriptionsForParent(familyId, parentIndex);
  subs.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(`Push error for ${familyId}:`, err));
  });
}

// ─── Notification message rotation ──────────────────────────────────────────

const bedtimeMessages = [
  (p: string) => ({ title: 'Bedtime!', body: `${p} is on first watch tonight.` }),
  (p: string) => ({ title: 'The stars are out!', body: `${p}, you're up first.` }),
  (p: string) => ({ title: 'Night shift starting...', body: `${p} is the Star Guardian tonight!` }),
  (p: string) => ({ title: 'The moon is calling!', body: `${p} is tonight's hero.` }),
];

const morningMessages = [
  (p: string) => ({ title: 'Good morning!', body: `You made it! ${p} is up first tonight.` }),
  (p: string) => ({ title: 'Rise and shine!', body: `Tonight's first guardian: ${p}.` }),
  (p: string) => ({ title: 'Another night survived!', body: `${p} takes the first shift tonight.` }),
  (p: string) => ({ title: 'Morning!', body: `The stars have clocked out. ${p} is on deck tonight.` }),
];

const turnCompleteMessages = [
  (p: string) => ({ title: 'Mission complete!', body: `${p} handled it. Tag, you're it!` }),
  (p: string) => ({ title: 'Turn complete!', body: `${p} went in and survived. You're on standby!` }),
  (p: string) => ({ title: 'Swap!', body: `${p} is back. Your turn next!` }),
];

// These messages fire at the user-configured evening reminder time, which is
// intentionally earlier and calmer than the bedtime notification — a heads-up
// to let parents plan the night before bedtime arrives.
const eveningReminderMessages = [
  (p: string) => ({ title: "Tonight's reminder", body: `${p} is up first tonight. Get some rest!` }),
  (p: string) => ({ title: 'Heads up!',           body: `${p} takes the first shift tonight.` }),
  (p: string) => ({ title: 'Evening reminder',     body: `Tonight starts with ${p}.` }),
  (p: string) => ({ title: 'Plan for tonight',     body: `${p} goes first when bedtime hits.` }),
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Auth middleware ────────────────────────────────────────────────────────

function authenticateRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.starturn_session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Session expired' });
  (req as any).familyId = session.family_id;
  (req as any).parentIndex = session.parent_index;
  next();
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

let cleanupCounter = 0;

setInterval(() => {
  try {
    const now = new Date();

    // Cleanup expired tokens every 60 minutes
    cleanupCounter++;
    if (cleanupCounter >= 60) {
      cleanupExpired();
      cleanupCounter = 0;
    }

    const allSettings = getAllSettings();

    allSettings.forEach((setting: any) => {
      // Isolate each family in its own try/catch so a single bad record
      // (e.g. a corrupt timezone) cannot abort processing for all other families.
      try {
      const wakeTime = setting.wake_time || '07:00';

      // Each family may be in a different timezone. Compute the current
      // HH:mm in *their* local zone so all comparisons are correct.
      // If the stored timezone is missing or unrecognised, skip this family
      // rather than falling back to UTC and sending them wrong-time notifications.
      const familyTimezone = setting.timezone || '';
      if (!familyTimezone || !isValidTimezone(familyTimezone)) {
        console.warn(`Scheduler: skipping family ${setting.family_id} — invalid timezone '${familyTimezone}'`);
        return;
      }
      const currentTime    = currentTimeInZone(now, familyTimezone);

      // Bedtime: send reminder notification with fun message
      if (setting.bedtime === currentTime) {
        const currentParent = setting.current_turn_index === 0 ? setting.parent1_name : setting.parent2_name;
        const msg = pickRandom(bedtimeMessages)(currentParent);
        sendPushToFamily(setting.family_id, msg.title, msg.body);
      }

      // ─── Wake-time rotation: decide who goes first tonight ─────────────
      if (wakeTime === currentTime) {
        const rotationMode = setting.rotation_mode || ROTATION_ALTERNATE_NIGHTLY;
        const shouldAlternateNightly = rotationMode !== ROTATION_CONTINUE_FROM_LAST;

        if (shouldAlternateNightly) {
          // "Alternate nightly" mode:
          // Regardless of how many mid-night swaps happened,
          // the parent who went first LAST night goes SECOND tonight.
          const lastNightDate = computeNightContext(subDays(now, 1), setting.bedtime, wakeTime, familyTimezone).nightDate;
          const firstTripLastNight = getFirstTripOfNight(setting.family_id, lastNightDate);

          if (firstTripLastNight) {
            const parentWhoWentFirstLastNight = firstTripLastNight.parent_name;
            const indexWhoWentFirstLastNight = parentWhoWentFirstLastNight === setting.parent1_name ? PARENT_1 : PARENT_2;
            const tonightFirstIndex = oppositeIndex(indexWhoWentFirstLastNight);
            const parentWhoGoesFirstTonight = parentNameByIndex(setting, tonightFirstIndex);

            setTurnIndex(setting.family_id, tonightFirstIndex);

            const morningMsg = pickRandom(morningMessages)(parentWhoGoesFirstTonight);
            sendPushToFamily(setting.family_id, morningMsg.title, morningMsg.body);
          }
        }
        // "Continue from last" mode:
        // Do nothing. current_turn_index already reflects whoever
        // is next after last night's final trip. No reset needed.
      }

      // ─── Evening reminder ───────────────────────────────────────────────
      // Fires at setting.reminder_time (if configured) to give parents an
      // advance heads-up about who goes first tonight — intended to be set
      // earlier than bedtime (e.g. 8 PM) so there is time to plan.
      //
      // Placed after the wake-time block so that if reminder_time happens to
      // equal wake_time, the turn index has already been updated for tonight
      // before we compute the parent name.
      //
      // If reminder_time equals bedtime we skip it entirely — the bedtime
      // notification already handles that moment.
      const eveningReminderTime          = setting.reminder_time;
      const reminderCoincidesWithBedtime = eveningReminderTime === setting.bedtime;

      if (eveningReminderTime && eveningReminderTime === currentTime && !reminderCoincidesWithBedtime) {
        const reminderRotationMode   = setting.rotation_mode || ROTATION_ALTERNATE_NIGHTLY;
        const shouldAlternateNightly = reminderRotationMode !== ROTATION_CONTINUE_FROM_LAST;
        let parentWhoGoesFirstTonight: string | null = null;

        if (shouldAlternateNightly) {
          // Mirror the wake-time logic: find who went first last night,
          // then assign the opposite parent for tonight.
          // The family's timezone is required so "last night" is computed
          // relative to their local clock, not the server's.
          const lastNightDate      = computeNightContext(subDays(now, 1), setting.bedtime, wakeTime, familyTimezone).nightDate;
          const firstTripLastNight = getFirstTripOfNight(setting.family_id, lastNightDate);

          if (firstTripLastNight) {
            const indexWhoWentFirstLastNight =
              firstTripLastNight.parent_name === setting.parent1_name ? PARENT_1 : PARENT_2;
            const tonightFirstIndex   = oppositeIndex(indexWhoWentFirstLastNight);
            parentWhoGoesFirstTonight = parentNameByIndex(setting, tonightFirstIndex);
          } else {
            // No log found for last night — fall back to the current turn index.
            parentWhoGoesFirstTonight = parentNameByIndex(setting, setting.current_turn_index);
          }
        } else {
          // "Continue from last" mode: current_turn_index already carries
          // the correct value forward from the last completed trip.
          parentWhoGoesFirstTonight = parentNameByIndex(setting, setting.current_turn_index);
        }

        if (parentWhoGoesFirstTonight) {
          const reminderMsg = pickRandom(eveningReminderMessages)(parentWhoGoesFirstTonight);
          sendPushToFamily(setting.family_id, reminderMsg.title, reminderMsg.body);
        }
      }
      } catch (familyError) {
        // Log the error but continue processing the remaining families
        console.error(`Scheduler error for family ${setting.family_id}:`, familyError);
      }
    });
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}, 60000);

// ─── Input validation helpers ────────────────────────────────────────────────

const MAX_NAME_LENGTH = 30;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function isValidTime(time: string): boolean {
  return typeof time === 'string' && TIME_REGEX.test(time.trim());
}

/** Trim and cap a name to the allowed length */
function sanitizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

function isValidRotationMode(mode: string): boolean {
  return mode === ROTATION_ALTERNATE_NIGHTLY || mode === ROTATION_CONTINUE_FROM_LAST;
}

// Validates an IANA timezone string by attempting to construct a DateTimeFormat
// with it. Returns false for anything Intl doesn't recognise (e.g. 'Bad/Zone').
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ─── Server ─────────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Security headers (CSP disabled — Vite injects inline scripts in dev mode)
  app.use(helmet({ contentSecurityPolicy: false }));

  const cookieOptions: express.CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  };

  // ─── Auth Routes (unauthenticated) ─────────────────────────────────────

  app.post("/api/auth/email-lookup", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const result = findFamilyByEmail(normalizedEmail);

      if (!result) {
        return res.json({ status: 'unknown' });
      }

      const { family, parentIndex } = result;
      const name = parentIndex === 0 ? family.parent1_name : family.parent2_name;
      const token = createMagicLink(family.family_id, parentIndex, normalizedEmail);
      await sendMagicLinkEmail(normalizedEmail, token, name);

      res.json({ status: 'known' });
    } catch (error: any) {
      console.error("Error in /api/auth/email-lookup:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/setup", async (req, res) => {
    try {
      const { email, name, partnerName, partnerEmail, bedtime, wakeTime, firstTurnIndex, timezone } = req.body;
      if (!email || !name || !partnerName || !partnerEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!isValidEmail(email) || !isValidEmail(partnerEmail)) {
        return res.status(400).json({ error: 'Please enter valid email addresses' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPartnerEmail = partnerEmail.trim().toLowerCase();

      if (normalizedEmail === normalizedPartnerEmail) {
        return res.status(400).json({ error: 'Your email and your partner\'s email must be different' });
      }

      const safeName = sanitizeName(name);
      const safePartnerName = sanitizeName(partnerName);
      if (!safeName || !safePartnerName) {
        return res.status(400).json({ error: 'Names cannot be empty' });
      }

      const safeBedtime = bedtime && isValidTime(bedtime) ? bedtime : '22:00';
      const safeWakeTime = wakeTime && isValidTime(wakeTime) ? wakeTime : '07:00';
      // Capture the registering parent's browser timezone so the scheduler fires
      // at the right local time. Reject unrecognised timezone strings up front so
      // a bad value can never reach the scheduler.
      const rawTimezone = typeof timezone === 'string' ? timezone.trim() : '';
      if (rawTimezone && !isValidTimezone(rawTimezone)) {
        return res.status(400).json({ error: 'Invalid timezone' });
      }
      const safeTimezone = rawTimezone || 'UTC';

      // Check if either email is already registered
      const existing = findFamilyByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const partnerExisting = findFamilyByEmail(normalizedPartnerEmail);
      if (partnerExisting) {
        return res.status(409).json({ error: 'Partner email already registered with another family' });
      }

      // Generate family ID and create family
      const familyId = generateFamilyId();
      createFamily(
        familyId,
        safeName,
        normalizedEmail,
        safePartnerName,
        normalizedPartnerEmail,
        safeBedtime,
        safeWakeTime,
        firstTurnIndex ?? 0,
        safeTimezone
      );

      // Send magic link to the acting parent (always parent1 / index 0)
      const token = createMagicLink(familyId, 0, normalizedEmail);
      await sendMagicLinkEmail(normalizedEmail, token, safeName);

      // Send invite email to partner
      await sendInviteEmail(normalizedPartnerEmail, safePartnerName, safeName);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/auth/setup:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/request-link", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const result = findFamilyByEmail(normalizedEmail);
      if (!result) {
        return res.status(404).json({ error: 'Email not found' });
      }

      const { family, parentIndex } = result;
      const name = parentIndex === 0 ? family.parent1_name : family.parent2_name;
      const token = createMagicLink(family.family_id, parentIndex, normalizedEmail);
      await sendMagicLinkEmail(normalizedEmail, token, name);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/auth/request-link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Renders a branded error page for magic link failures so the user is never
  // left on a dead-end plain-text screen. viewport-fit=cover + safe-area-inset
  // padding ensures the gradient fills the full iPhone screen including the
  // area behind the notch / Dynamic Island.
  const magicLinkErrorPage = (title: string, message: string) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <title>${title} — StarTurn</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          /* Safe-area padding so the gradient fills behind the notch/island */
          padding:
            env(safe-area-inset-top, 1rem)
            env(safe-area-inset-right, 1rem)
            env(safe-area-inset-bottom, 1rem)
            env(safe-area-inset-left, 1rem);
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%);
          font-family: system-ui, -apple-system, sans-serif;
          color: #e0e7ff;
        }
        .card {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          max-width: 380px;
          width: 100%;
          text-align: center;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .icon { font-size: 2.5rem; margin-bottom: 1rem; }
        h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.75rem; }
        p { color: rgba(199,210,254,0.8); line-height: 1.65; margin-bottom: 1.75rem; font-size: 0.95rem; }
        a {
          display: inline-block;
          background: #6366f1;
          color: white;
          text-decoration: none;
          padding: 0.8rem 1.75rem;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 0.95rem;
          transition: background 0.2s;
        }
        a:hover { background: #4f46e5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🔒</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/">Request a New Link</a>
      </div>
    </body>
    </html>
  `;

  app.get("/api/auth/verify", (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).send(magicLinkErrorPage(
          'Link Invalid',
          'This sign-in link is missing its token. Please request a new one from the app.'
        ));
      }

      const result = consumeMagicLink(token);
      if (!result) {
        return res.status(400).send(magicLinkErrorPage(
          'Link Expired',
          'This sign-in link has expired or has already been used. Links are only valid for 15 minutes.'
        ));
      }

      const sessionToken = createSession(result.family_id, result.parent_index);
      res.cookie('starturn_session', sessionToken, cookieOptions);
      res.redirect('/');
    } catch (error: any) {
      console.error("Error in /api/auth/verify:", error);
      res.status(500).send(magicLinkErrorPage(
        'Something Went Wrong',
        'We hit an unexpected error while signing you in. Please try requesting a new link.'
      ));
    }
  });

  app.get("/api/auth/me", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const parentIndex = (req as any).parentIndex;
      const settings: any = getSettings(familyId);
      const parentName = parentIndex === 0 ? settings.parent1_name : settings.parent2_name;
      const partnerName = parentIndex === 0 ? settings.parent2_name : settings.parent1_name;
      const partnerIndex = parentIndex === PARENT_1 ? PARENT_2 : PARENT_1;
      const partnerHasJoined = hasPartnerEverLoggedIn(familyId, partnerIndex);

      res.json({ familyId, parentIndex, parentName, partnerName, partnerHasJoined });
    } catch (error: any) {
      console.error("Error in /api/auth/me:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", authenticateRequest, (req, res) => {
    try {
      const token = req.cookies?.starturn_session;
      if (token) deleteSession(token);
      res.clearCookie('starturn_session', { path: '/' });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/auth/logout:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Authenticated API Routes ──────────────────────────────────────────

  app.get("/api/vapid-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.get("/api/state", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const settings: any = getSettings(familyId);
      const logs = getLogs(familyId);

      const wakeTime = settings.wake_time || '07:00';
      const timezone = settings.timezone  || 'UTC';
      const { isNight, nightDate } = computeNightContext(new Date(), settings.bedtime, wakeTime, timezone);

      // ─── Determine who goes first tonight (shown during daytime) ───────
      let tonightFirstParent: string | null = null;

      if (!isNight) {
        const rotationMode = settings.rotation_mode || ROTATION_ALTERNATE_NIGHTLY;
        const shouldAlternateNightly = rotationMode !== ROTATION_CONTINUE_FROM_LAST;

        if (shouldAlternateNightly) {
          // Look at who went first last night and pick the opposite parent.
          const lastNightDate = currentDateInZone(subDays(new Date(), 1), timezone);
          const firstTripLastNight = getFirstTripOfNight(familyId, lastNightDate);

          if (firstTripLastNight) {
            const parentWhoWentFirstLastNight = firstTripLastNight.parent_name;
            tonightFirstParent = parentWhoWentFirstLastNight === settings.parent1_name
              ? settings.parent2_name
              : settings.parent1_name;
          } else {
            // No trips logged last night — fall back to current index.
            tonightFirstParent = parentNameByIndex(settings, settings.current_turn_index);
          }
        } else {
          // "Continue from last" mode:
          // Just read current_turn_index directly — it already carries
          // forward from wherever last night's final toggle left it.
          tonightFirstParent = parentNameByIndex(settings, settings.current_turn_index);
        }
      }

      res.json({ settings, logs, nightMode: isNight, tonightFirstParent, currentNightDate: nightDate });
    } catch (error: any) {
      console.error("Error in /api/state:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/settings", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const { parent1, parent2, bedtime, wakeTime, rotationMode, reminderTime, timezone } = req.body;

      // Validate and sanitize inputs
      const safeName1 = parent1 ? sanitizeName(parent1) : undefined;
      const safeName2 = parent2 ? sanitizeName(parent2) : undefined;
      if (safeName1 !== undefined && !safeName1) return res.status(400).json({ error: 'Parent 1 name cannot be empty' });
      if (safeName2 !== undefined && !safeName2) return res.status(400).json({ error: 'Parent 2 name cannot be empty' });

      const safeBedtime = bedtime && isValidTime(bedtime) ? bedtime : '22:00';
      const safeWakeTime = wakeTime && isValidTime(wakeTime) ? wakeTime : '07:00';
      const safeRotation = rotationMode && isValidRotationMode(rotationMode) ? rotationMode : ROTATION_ALTERNATE_NIGHTLY;

      // IANA timezone string sent by the browser (e.g. "America/Chicago").
      // Reject unrecognised values so a bad timezone can never reach the scheduler.
      const rawTimezone = typeof timezone === 'string' ? timezone.trim() : '';
      if (rawTimezone && !isValidTimezone(rawTimezone)) {
        return res.status(400).json({ error: 'Invalid timezone' });
      }
      const safeTimezone: string = rawTimezone || 'UTC';

      // Normalize reminderTime: a valid HH:mm string enables the evening reminder;
      // an empty string or missing value disables it (stores NULL in the DB).
      const safeReminderTime: string | null =
        typeof reminderTime === 'string' && isValidTime(reminderTime)
          ? reminderTime
          : null;

      updateSettings(familyId, safeName1 || '', safeName2 || '', safeBedtime, safeWakeTime, safeRotation, undefined, undefined, undefined, safeTimezone, safeReminderTime);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/complete-turn", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const parentIndex = (req as any).parentIndex;
      const settings: any = getSettings(familyId);
      const parentName = parentIndex === 0 ? settings.parent1_name : settings.parent2_name;
      const { nightDate } = computeNightContext(new Date(), settings.bedtime, settings.wake_time || '07:00', settings.timezone || 'UTC');

      logAction(familyId, parentName, 'completed_turn', nightDate);
      toggleTurn(familyId);

      // Send fun notification to the OTHER parent
      const otherIndex = parentIndex === 0 ? 1 : 0;
      const msg = pickRandom(turnCompleteMessages)(parentName);
      sendPushToParent(familyId, otherIndex, msg.title, msg.body);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/complete-turn:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/override-turn", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const parentIndex = (req as any).parentIndex;
      const { actionType } = req.body;
      if (!actionType) {
        return res.status(400).json({ error: 'Missing actionType' });
      }

      const settings: any = getSettings(familyId);
      const actingParent = parentIndex === 0 ? settings.parent1_name : settings.parent2_name;
      const { nightDate } = computeNightContext(new Date(), settings.bedtime, settings.wake_time || '07:00', settings.timezone || 'UTC');
      const action = actionType === 'takeover' ? 'took_over' : 'skipped_turn';

      logAction(familyId, actingParent, action, nightDate);
      toggleTurn(familyId);

      const otherIndex = parentIndex === 0 ? 1 : 0;
      const notifBody = actionType === 'takeover'
        ? `${actingParent} is taking over. Rest up!`
        : `${actingParent} passed their turn to you.`;

      sendPushToParent(familyId, otherIndex, 'Turn Update', notifBody);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/override-turn:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/journal", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const nights = getJournal(familyId);
      res.json({ nights });
    } catch (error: any) {
      console.error("Error in /api/journal:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a single journal entry
  app.delete("/api/journal/entry/:id", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      const id = Number(idParam);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      const changes = deleteJournalEntry(familyId, id);
      if (changes === 0) return res.status(404).json({ error: 'Entry not found' });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in DELETE /api/journal/entry/:id:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update the parent_name of a single journal entry
  app.patch("/api/journal/entry/:id", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { parent_name } = req.body;
      if (!parent_name || typeof parent_name !== 'string' || parent_name.trim() === '') {
        return res.status(400).json({ error: 'parent_name is required' });
      }
      const trimmedName = parent_name.trim();
      // Only allow names belonging to this family to prevent arbitrary injection
      const settings = getSettings(familyId);
      if (!settings) return res.status(404).json({ error: 'Family not found' });
      const validNames = [settings.parent1_name, settings.parent2_name];
      if (!validNames.includes(trimmedName)) {
        return res.status(400).json({ error: 'parent_name must be one of the family members' });
      }
      updateJournalEntry(familyId, id, trimmedName);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in PATCH /api/journal/entry/:id:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear all entries for a specific night
  app.delete("/api/journal/night/:nightDate", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const { nightDate } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nightDate)) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      const changes = clearJournalNight(familyId, nightDate);
      if (changes === 0) return res.status(404).json({ error: 'No entries found for this night' });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in DELETE /api/journal/night/:nightDate:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manually log a wakeup for a past night (or add to an existing night's entries).
  // The browser sends a full ISO timestamp it constructed from the user's chosen date + time,
  // so we store the exact moment the parent says the wakeup occurred rather than "now".
  app.post("/api/journal/entry", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const { nightDate, parentName, timestamp } = req.body;

      // Validate nightDate is YYYY-MM-DD
      if (!nightDate || !/^\d{4}-\d{2}-\d{2}$/.test(nightDate)) {
        return res.status(400).json({ error: 'Invalid nightDate format' });
      }
      // Validate timestamp is a parseable ISO string
      if (!timestamp || isNaN(Date.parse(timestamp))) {
        return res.status(400).json({ error: 'Invalid timestamp' });
      }
      // Validate parentName is one of the two family members (prevents arbitrary injection)
      if (!parentName || typeof parentName !== 'string' || parentName.trim() === '') {
        return res.status(400).json({ error: 'parentName is required' });
      }
      const trimmedName = parentName.trim();
      const settings = getSettings(familyId);
      if (!settings) return res.status(404).json({ error: 'Family not found' });
      const validParentNames = [(settings as any).parent1_name, (settings as any).parent2_name];
      if (!validParentNames.includes(trimmedName)) {
        return res.status(400).json({ error: 'parentName must be one of the family members' });
      }

      const newId = insertJournalEntry(familyId, trimmedName, nightDate, timestamp);
      res.json({ id: newId, parent_name: trimmedName, action: 'completed_turn', timestamp, night_date: nightDate });
    } catch (error: any) {
      console.error("Error in POST /api/journal/entry:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscribe", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const parentIndex = (req as any).parentIndex;
      const { subscription } = req.body;
      saveSubscriptionWithParent(familyId, subscription, parentIndex);
      res.status(201).json({});
    } catch (error: any) {
      console.error("Error in /api/subscribe:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/resend-invite", authenticateRequest, async (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const parentIndex = (req as any).parentIndex;
      const settings: any = getSettings(familyId);

      // Determine the partner's info based on who is making the request
      const partnerIndex = parentIndex === PARENT_1 ? PARENT_2 : PARENT_1;
      const partnerEmail = partnerIndex === PARENT_1 ? settings.parent1_email : settings.parent2_email;
      const partnerName = parentNameByIndex(settings, partnerIndex);
      const myName = parentNameByIndex(settings, parentIndex);

      if (!partnerEmail) {
        return res.status(400).json({ error: 'No email on file for your partner' });
      }

      await sendInviteEmail(partnerEmail, partnerName, myName);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/resend-invite:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Vite / Static ────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Data Directory: ${process.env.DATA_DIR || './data'}`);
    console.log(`Resend: ${resend ? 'configured' : 'DEV MODE (links logged to console)'}`);
  });
}

startServer();
