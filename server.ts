import express from "express";
import { createServer as createViteServer } from "vite";
import { getSettings, updateSettings, toggleTurn, logAction, getLogs, saveSubscription, getSubscriptions, getVapidKeys, saveVapidKeys, getAllSettings } from "./src/db";
import webpush from 'web-push';
import { format } from 'date-fns';

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

// Scheduler for Bedtime Notifications
setInterval(() => {
  try {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    const allSettings = getAllSettings();
    
    allSettings.forEach((setting: any) => {
      if (setting.bedtime === currentTime) {
        const currentParent = setting.current_turn_index === 0 ? setting.parent1_name : setting.parent2_name;
        const payload = JSON.stringify({ 
          title: 'Bedtime Reminder', 
          body: `It's ${setting.bedtime}! Remember, tonight is ${currentParent}'s turn to wake up.` 
        });
        
        const subs = getSubscriptions(setting.family_id);
        subs.forEach(sub => {
          webpush.sendNotification(sub, payload).catch(err => console.error(`Error sending notification to ${setting.family_id}:`, err));
        });
      }
    });
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}, 60000); // Check every minute

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/vapid-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.get("/api/state", (req, res) => {
    const familyId = req.query.familyId as string;
    if (!familyId) return res.status(400).json({ error: 'Missing familyId' });
    
    const settings = getSettings(familyId);
    const logs = getLogs(familyId);
    res.json({ settings, logs });
  });

  app.post("/api/settings", (req, res) => {
    const { familyId, parent1, parent2, bedtime } = req.body;
    updateSettings(familyId, parent1, parent2, bedtime);
    res.json({ success: true });
  });

  app.post("/api/complete-turn", (req, res) => {
    const { familyId, parentName } = req.body;
    logAction(familyId, parentName, 'completed_turn');
    toggleTurn(familyId);
    
    const payload = JSON.stringify({ title: 'Turn Completed!', body: `${parentName} completed their turn. Next up!` });
    const subs = getSubscriptions(familyId);
    subs.forEach(sub => {
      webpush.sendNotification(sub, payload).catch(err => console.error(err));
    });

    res.json({ success: true });
  });

  app.post("/api/subscribe", (req, res) => {
    const { familyId, subscription } = req.body;
    saveSubscription(familyId, subscription);
    res.status(201).json({});
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
