import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { Resend } from 'resend';
import {
  getSettings, updateSettings, toggleTurn, logAction, getLogs,
  saveSubscription, getSubscriptions, getVapidKeys, saveVapidKeys,
  getAllSettings, getFirstTripOfNight, setTurnIndex, getJournal,
  createMagicLink, consumeMagicLink, createSession, getSession,
  deleteSession, cleanupExpired, getParentEmail,
  saveSubscriptionWithParent, getSubscriptionsForParent
} from "./src/db";
import webpush from 'web-push';
import { format, subDays } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ─── Night context helper ───────────────────────────────────────────────────
function computeNightContext(now: Date, bedtime: string, wakeTime: string): { isNight: boolean; nightDate: string } {
  const [btH, btM] = bedtime.split(':').map(Number);
  const [wtH, wtM] = wakeTime.split(':').map(Number);
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const btMins = btH * 60 + btM;
  const wtMins = wtH * 60 + wtM;

  const isNight = totalMins >= btMins || totalMins < wtMins;

  let nightDate: string;
  if (totalMins >= btMins) {
    nightDate = format(now, 'yyyy-MM-dd');
  } else {
    nightDate = format(subDays(now, 1), 'yyyy-MM-dd');
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
    const currentTime = format(now, 'HH:mm');

    // Cleanup expired tokens every 60 minutes
    cleanupCounter++;
    if (cleanupCounter >= 60) {
      cleanupExpired();
      cleanupCounter = 0;
    }

    const allSettings = getAllSettings();

    allSettings.forEach((setting: any) => {
      const wakeTime = setting.wake_time || '07:00';

      // Bedtime: send reminder notification with fun message
      if (setting.bedtime === currentTime) {
        const currentParent = setting.current_turn_index === 0 ? setting.parent1_name : setting.parent2_name;
        const msg = pickRandom(bedtimeMessages)(currentParent);
        sendPushToFamily(setting.family_id, msg.title, msg.body);
      }

      // Wakeup: rotate turn for upcoming night based on last night
      if (wakeTime === currentTime) {
        const { nightDate: lastNightDate } = computeNightContext(subDays(now, 1), setting.bedtime, wakeTime);
        const firstTrip = getFirstTripOfNight(setting.family_id, lastNightDate);

        if (firstTrip) {
          const firstPersonIndex = firstTrip.parent_name === setting.parent1_name ? 0 : 1;
          const newIndex = firstPersonIndex === 0 ? 1 : 0;
          setTurnIndex(setting.family_id, newIndex);
          const nextParent = newIndex === 0 ? setting.parent1_name : setting.parent2_name;
          const msg = pickRandom(morningMessages)(nextParent);
          sendPushToFamily(setting.family_id, msg.title, msg.body);
        }
      }
    });
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}, 60000);

// ─── Server ─────────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());
  app.use(cookieParser());

  const cookieOptions: express.CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  };

  // ─── Auth Routes (unauthenticated) ─────────────────────────────────────

  app.get("/api/auth/family-info", (req, res) => {
    try {
      const familyId = req.query.familyId as string;
      if (!familyId) return res.status(400).json({ error: 'Missing familyId' });

      const settings: any = getSettings(familyId);
      res.json({
        exists: true,
        isSetupComplete: settings.is_setup_complete === 1,
        parent1Name: settings.parent1_name,
        parent2Name: settings.parent2_name,
      });
    } catch (error: any) {
      console.error("Error in /api/auth/family-info:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/setup", async (req, res) => {
    try {
      const { familyId, parent1, parent1Email, parent2, parent2Email, bedtime, wakeTime, firstTurnIndex, actingParentIndex } = req.body;
      if (!familyId || !parent1 || !parent1Email || !parent2 || !parent2Email) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Ensure the family row exists (getSettings auto-creates)
      getSettings(familyId);
      updateSettings(familyId, parent1, parent2, bedtime || '22:00', wakeTime || '07:00', firstTurnIndex ?? 0, parent1Email, parent2Email);

      // Send magic link to the acting parent
      const pIndex = actingParentIndex ?? 0;
      const email = pIndex === 0 ? parent1Email : parent2Email;
      const name = pIndex === 0 ? parent1 : parent2;
      const token = createMagicLink(familyId, pIndex, email);
      await sendMagicLinkEmail(email, token, name);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/auth/setup:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/request-link", async (req, res) => {
    try {
      const { familyId, parentIndex } = req.body;
      if (!familyId || parentIndex === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const email = getParentEmail(familyId, parentIndex);
      if (!email) {
        return res.status(400).json({ error: 'No email found for this parent' });
      }

      const settings: any = getSettings(familyId);
      const name = parentIndex === 0 ? settings.parent1_name : settings.parent2_name;
      const token = createMagicLink(familyId, parentIndex, email);
      await sendMagicLinkEmail(email, token, name);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/auth/request-link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/verify", (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).send('Missing token');

      const result = consumeMagicLink(token);
      if (!result) return res.status(400).send('Invalid or expired link. Please request a new one.');

      const sessionToken = createSession(result.family_id, result.parent_index);
      res.cookie('starturn_session', sessionToken, cookieOptions);
      res.redirect('/');
    } catch (error: any) {
      console.error("Error in /api/auth/verify:", error);
      res.status(500).send('Server error');
    }
  });

  app.get("/api/auth/me", authenticateRequest, (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const parentIndex = (req as any).parentIndex;
      const settings: any = getSettings(familyId);
      const parentName = parentIndex === 0 ? settings.parent1_name : settings.parent2_name;
      const partnerName = parentIndex === 0 ? settings.parent2_name : settings.parent1_name;

      res.json({ familyId, parentIndex, parentName, partnerName });
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
      const { isNight, nightDate } = computeNightContext(new Date(), settings.bedtime, wakeTime);

      let tonightFirstParent: string | null = null;
      if (!isNight) {
        const lastNightDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        const firstTrip = getFirstTripOfNight(familyId, lastNightDate);
        if (firstTrip) {
          tonightFirstParent = firstTrip.parent_name === settings.parent1_name
            ? settings.parent2_name
            : settings.parent1_name;
        } else {
          tonightFirstParent = settings.current_turn_index === 0
            ? settings.parent1_name
            : settings.parent2_name;
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
      const { parent1, parent2, bedtime, wakeTime } = req.body;
      updateSettings(familyId, parent1, parent2, bedtime, wakeTime ?? '07:00');
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
      const { nightDate } = computeNightContext(new Date(), settings.bedtime, settings.wake_time || '07:00');

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
      const { nightDate } = computeNightContext(new Date(), settings.bedtime, settings.wake_time || '07:00');
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
