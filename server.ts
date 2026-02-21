import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import { getSettings, updateSettings, toggleTurn, logAction, getLogs, saveSubscription, getSubscriptions, getVapidKeys, saveVapidKeys, getAllSettings, getFirstTripOfNight, setTurnIndex, getJournal } from "./src/db";
import webpush from 'web-push';
import { format, subDays } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize VAPID keys
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

// Determines whether "now" is night or day, and what night_date applies.
// Night = from bedtime until wakeTime the next morning.
// nightDate = the calendar date of the bedtime that started the night
//   (i.e. today if now >= bedtime, or yesterday if now < wakeTime)
function computeNightContext(now: Date, bedtime: string, wakeTime: string): { isNight: boolean; nightDate: string } {
  const [btH, btM] = bedtime.split(':').map(Number);
  const [wtH, wtM] = wakeTime.split(':').map(Number);
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const btMins = btH * 60 + btM;
  const wtMins = wtH * 60 + wtM;

  const isNight = totalMins >= btMins || totalMins < wtMins;

  let nightDate: string;
  if (totalMins >= btMins) {
    // After bedtime — night belongs to today
    nightDate = format(now, 'yyyy-MM-dd');
  } else {
    // Before wakeup — still last night (belongs to yesterday)
    nightDate = format(subDays(now, 1), 'yyyy-MM-dd');
  }

  return { isNight, nightDate };
}

// Send push notifications to all subscribers for a family
function sendPushToFamily(familyId: string, title: string, body: string) {
  const payload = JSON.stringify({ title, body });
  const subs = getSubscriptions(familyId);
  subs.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(`Push error for ${familyId}:`, err));
  });
}

// Scheduler — runs every minute, handles both bedtime reminders and wakeup rotation
setInterval(() => {
  try {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');

    const allSettings = getAllSettings();

    allSettings.forEach((setting: any) => {
      const wakeTime = setting.wake_time || '07:00';

      // Bedtime: send reminder notification
      if (setting.bedtime === currentTime) {
        const currentParent = setting.current_turn_index === 0 ? setting.parent1_name : setting.parent2_name;
        sendPushToFamily(
          setting.family_id,
          'Bedtime Reminder',
          `It's ${setting.bedtime}! Remember, tonight is ${currentParent}'s turn to wake up.`
        );
      }

      // Wakeup: rotate turn for upcoming night based on last night
      if (wakeTime === currentTime) {
        const { nightDate: lastNightDate } = computeNightContext(subDays(now, 1), setting.bedtime, wakeTime);
        const firstTrip = getFirstTripOfNight(setting.family_id, lastNightDate);

        if (firstTrip) {
          // Someone got up — next night, the OTHER parent goes first
          const firstPersonIndex = firstTrip.parent_name === setting.parent1_name ? 0 : 1;
          const newIndex = firstPersonIndex === 0 ? 1 : 0;
          setTurnIndex(setting.family_id, newIndex);
          const nextParent = newIndex === 0 ? setting.parent1_name : setting.parent2_name;
          sendPushToFamily(
            setting.family_id,
            'Good Morning!',
            `Tonight it's ${nextParent}'s first turn.`
          );
        }
        // Zero-trip night: no rotation, no notification needed
      }
    });
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}, 60000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/vapid-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.get("/api/state", (req, res) => {
    try {
      const familyId = req.query.familyId as string;
      if (!familyId) return res.status(400).json({ error: 'Missing familyId' });

      const settings: any = getSettings(familyId);
      const logs = getLogs(familyId);

      const wakeTime = settings.wake_time || '07:00';
      const { isNight, nightDate } = computeNightContext(new Date(), settings.bedtime, wakeTime);

      // Compute who goes first tonight (shown during daytime)
      let tonightFirstParent: string | null = null;
      if (!isNight) {
        // Daytime: look at last night to determine rotation
        const lastNightDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        const firstTrip = getFirstTripOfNight(familyId, lastNightDate);
        if (firstTrip) {
          // Rotate: other parent goes first tonight
          tonightFirstParent = firstTrip.parent_name === settings.parent1_name
            ? settings.parent2_name
            : settings.parent1_name;
        } else {
          // No trips last night or no history — keep current index
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

  app.post("/api/settings", (req, res) => {
    try {
      const { familyId, parent1, parent2, bedtime, wakeTime, firstTurnIndex } = req.body;
      updateSettings(familyId, parent1, parent2, bedtime, wakeTime ?? '07:00', firstTurnIndex);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/complete-turn", (req, res) => {
    try {
      const { familyId, parentName } = req.body;
      const settings: any = getSettings(familyId);
      const { nightDate } = computeNightContext(new Date(), settings.bedtime, settings.wake_time || '07:00');

      logAction(familyId, parentName, 'completed_turn', nightDate);
      toggleTurn(familyId);

      sendPushToFamily(familyId, 'Turn Completed!', `${parentName} completed their turn. Next up!`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/complete-turn:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Override turn: skip (pass to partner) or takeover (jump in for partner)
  app.post("/api/override-turn", (req, res) => {
    try {
      const { familyId, actingParent, actionType } = req.body;
      if (!familyId || !actingParent || !actionType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const settings: any = getSettings(familyId);
      const { nightDate } = computeNightContext(new Date(), settings.bedtime, settings.wake_time || '07:00');
      const action = actionType === 'takeover' ? 'took_over' : 'skipped_turn';

      logAction(familyId, actingParent, action, nightDate);
      toggleTurn(familyId);

      const partnerName = actingParent === settings.parent1_name ? settings.parent2_name : settings.parent1_name;
      const notifBody = actionType === 'takeover'
        ? `${actingParent} is taking over. Rest up!`
        : `${actingParent} passed their turn to you.`;

      sendPushToFamily(familyId, 'Turn Update', notifBody);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/override-turn:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/journal", (req, res) => {
    try {
      const familyId = req.query.familyId as string;
      if (!familyId) return res.status(400).json({ error: 'Missing familyId' });
      const nights = getJournal(familyId);
      res.json({ nights });
    } catch (error: any) {
      console.error("Error in /api/journal:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscribe", (req, res) => {
    try {
      const { familyId, subscription } = req.body;
      saveSubscription(familyId, subscription);
      res.status(201).json({});
    } catch (error: any) {
      console.error("Error in /api/subscribe:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));

    // SPA fallback
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
  });
}

startServer();
