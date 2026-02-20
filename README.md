# StarTurn 🌟

StarTurn is a joyful, synchronized web app designed to help parents (or partners) track whose turn it is to wake up. It features a beautiful starry interface, real-time syncing between devices, and a "Rest Now" mode for the off-duty parent.

## Features

- **Real-time Sync:** Updates instantly across all devices using the same Family ID.
- **Turn Tracking:** Clearly shows who is "On Duty" and who gets to rest.
- **PWA Support:** Installable on iPhone and Android for a native app experience.
- **Push Notifications:** Get notified when your partner completes their turn.
- **Beautiful UI:** Starry background, smooth animations, and a calming night theme.

## 🚀 How to Deploy

Since StarTurn uses a local SQLite database (`starturn.db`) to store your family's state, you need a hosting provider that supports **persistent storage** (disk space that doesn't get wiped every time the app restarts).

### Option 1: Railway (Recommended)
1.  Create an account at [railway.app](https://railway.app/).
2.  Create a new project and select "Deploy from GitHub" (you'll need to push this code to a GitHub repo first).
3.  Once deployed, go to the project **Settings** -> **Variables**.
4.  Add a variable `PORT` with value `3000`.
5.  **Crucial Step:** Go to the service's **Volumes** tab and add a volume.
    *   **Mount Path:** `/app/data`
    *   This ensures your database is saved in a separate folder that doesn't get overwritten when the app restarts.


### Option 2: Fly.io
1.  Install the `flyctl` CLI.
2.  Run `fly launch`.
3.  When asked about a database, say no (we use SQLite).
4.  Create a persistent volume: `fly volumes create starturn_data --size 1`.
5.  Update `fly.toml` to mount this volume to where your DB lives.

### Option 3: VPS (DigitalOcean, Hetzner, etc.)
1.  Provision a small Ubuntu server.
2.  Install Node.js 18+.
3.  Clone your repo.
4.  Run `npm install` and `npm run build`.
5.  Start with `npm start` (use PM2 to keep it running: `pm2 start server.ts --interpreter ./node_modules/.bin/tsx`).

## 📱 How to Install on iPhone

StarTurn is a Progressive Web App (PWA). You don't need the App Store!

1.  **Deploy** the app (see above) and get your URL (e.g., `https://starturn.railway.app`).
2.  Open **Safari** on your iPhone and visit your URL.
3.  Tap the **Share** icon (the square with an arrow pointing up) at the bottom of the screen.
4.  Scroll down and tap **"Add to Home Screen"**.
5.  Name it "StarTurn" and tap **Add**.

Now StarTurn will appear on your home screen like a real app, without the browser address bar!

## 👨‍👩‍👧‍👦 How to Use

1.  **Login:** Open the app. Enter a unique **Family Name** (e.g., "TheSmiths").
2.  **Identify:** Select who you are (e.g., "Parent 1").
3.  **Sync:** Have your partner do the same on their phone, entering the *exact same* Family Name, but selecting "Parent 2".
4.  **Use:**
    *   If it's your turn, you'll see "It's your turn to rise". When you're done, tap **"I'm Going In / Done"**.
    *   Your partner's phone will instantly update to tell them it's their turn!

## 🛠️ Development

To run locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
