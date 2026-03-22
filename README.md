# StarTurn

StarTurn is a joyful, synchronized web app designed to help parents (or partners) track whose turn it is to handle nighttime wake-ups. It features a beautiful starry interface, real-time syncing between devices, and clear "on duty" vs "resting" modes.

## Features

- **Email-Based Auth:** Sign in with your email via magic link. No passwords to remember.
- **Turn Tracking:** Clearly shows who is "On Duty" and who gets to rest.
- **One-Tap Completion:** Tap "Done — Going Back to Bed" when you've handled the wake-up. The turn automatically passes to your partner.
- **Night Rotation Modes:** Choose between "Alternate nightly" (swap who goes first each night) or "Pick up where we left off" (carry forward from last trip).
- **Push Notifications:** Get notified when your partner completes their turn.
- **Night Journal:** Browse a history of all nighttime activity, grouped by date.
- **Partner Invite:** Set up your account and invite your partner via email.
- **PWA Support:** Installable on iPhone and Android for a native app experience.
- **Beautiful UI:** Starry background, smooth animations, and a calming night theme.

## How to Use

1. **Sign up:** Visit the app and enter your email address. If you're new, you'll set up your name, partner's name, partner's email, bedtime, and wake time.
2. **Check your email:** Click the magic link to sign in.
3. **Invite your partner:** They'll receive an invite email and can sign in with their own email.
4. **Use it:**
   - At night, the on-duty parent taps "Done — Going Back to Bed" after handling the wake-up.
   - The turn automatically passes to your partner.
   - During the day, you'll see a countdown to bedtime and who's up first tonight.

## How to Deploy

StarTurn uses a local SQLite database (`starturn.db`) to store state. You need a hosting provider with **persistent storage**.

### Option 1: Railway (Recommended)
1. Create an account at [railway.app](https://railway.app/).
2. Create a new project and select "Deploy from GitHub".
3. Once deployed, go to **Settings** > **Variables**.
4. Add variables:
   - `PORT` = `3000`
   - `APP_URL` = your Railway URL (e.g. `https://your-app.up.railway.app`)
   - `RESEND_API_KEY` = your Resend API key for sending emails
   - `RESEND_FROM` = your verified sender (e.g. `StarTurn <noreply@yourdomain.com>`)
5. Go to the service's **Volumes** tab and add a volume with mount path `/app/data`.

### Option 2: Fly.io
1. Install the `flyctl` CLI.
2. Run `fly launch`.
3. Create a persistent volume: `fly volumes create starturn_data --size 1`.
4. Update `fly.toml` to mount this volume to `/app/data`.

### Option 3: VPS (DigitalOcean, Hetzner, etc.)
1. Provision a small Ubuntu server.
2. Install Node.js 18+.
3. Clone your repo.
4. Set environment variables (`APP_URL`, `RESEND_API_KEY`, `RESEND_FROM`).
5. Run `npm install && npm run build && npm start`.

## Install on Your Phone

StarTurn is a Progressive Web App (PWA):

- **iPhone:** Open Safari > Share > Add to Home Screen
- **Android:** Open Chrome > Menu > Install App

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. In dev mode, magic links are logged to the console instead of being emailed.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3000) |
| `APP_URL` | Yes (prod) | Public URL for magic link emails |
| `RESEND_API_KEY` | Yes (prod) | Resend API key for sending emails |
| `RESEND_FROM` | No | Sender address (default: `StarTurn <noreply@starturn.app>`) |
| `DATA_DIR` | No | SQLite database directory (default: `./data`) |
| `NODE_ENV` | No | Set to `production` for production builds |
