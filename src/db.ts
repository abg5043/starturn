import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Ensure data directory exists
const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'starturn.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    family_id TEXT PRIMARY KEY,
    parent1_name TEXT DEFAULT 'Parent 1',
    parent2_name TEXT DEFAULT 'Parent 2',
    bedtime TEXT DEFAULT '22:00',
    current_turn_index INTEGER DEFAULT 0,
    last_switch_timestamp DATETIME
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id TEXT,
    parent_name TEXT,
    action TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint TEXT PRIMARY KEY,
    family_id TEXT,
    keys TEXT
  );

  CREATE TABLE IF NOT EXISTS vapid_keys (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    public_key TEXT,
    private_key TEXT
  );

  CREATE TABLE IF NOT EXISTS magic_links (
    token TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    parent_index INTEGER NOT NULL,
    email TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    parent_index INTEGER NOT NULL,
    expires_at DATETIME NOT NULL
  );
`);

// Migrations: add new columns if they don't exist yet
try { db.exec(`ALTER TABLE settings ADD COLUMN wake_time TEXT DEFAULT '07:00'`); } catch (_) {}
try { db.exec(`ALTER TABLE settings ADD COLUMN is_setup_complete INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE logs ADD COLUMN night_date TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE settings ADD COLUMN parent1_email TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE settings ADD COLUMN parent2_email TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE subscriptions ADD COLUMN parent_index INTEGER DEFAULT -1`); } catch (_) {}
try { db.exec(`ALTER TABLE settings ADD COLUMN rotation_mode TEXT DEFAULT 'alternate_nightly'`); } catch (_) {}

// Email indexes for lookup
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_settings_parent1_email ON settings(parent1_email)`); } catch (_) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_settings_parent2_email ON settings(parent2_email)`); } catch (_) {}

// Mark existing families that already have custom names as setup complete
db.exec(`UPDATE settings SET is_setup_complete = 1 WHERE (parent1_name != 'Parent 1' OR parent2_name != 'Parent 2') AND is_setup_complete = 0`);

export const getVapidKeys = () => {
  return db.prepare('SELECT * FROM vapid_keys WHERE id = 1').get();
};

export const saveVapidKeys = (publicKey: string, privateKey: string) => {
  db.prepare('INSERT OR REPLACE INTO vapid_keys (id, public_key, private_key) VALUES (1, ?, ?)').run(publicKey, privateKey);
};

export const getAllSettings = () => {
  return db.prepare('SELECT * FROM settings').all();
};

export const getSettings = (familyId: string) => {
  return db.prepare('SELECT * FROM settings WHERE family_id = ?').get(familyId) || null;
};

export const updateSettings = (
  familyId: string,
  parent1: string,
  parent2: string,
  bedtime: string,
  wakeTime: string,
  rotationMode?: string,
  firstTurnIndex?: number,
  parent1Email?: string,
  parent2Email?: string
) => {
  const safeRotationMode = rotationMode || 'alternate_nightly';

  if (firstTurnIndex !== undefined && parent1Email !== undefined && parent2Email !== undefined) {
    db.prepare(
      'UPDATE settings SET parent1_name = ?, parent2_name = ?, bedtime = ?, wake_time = ?, rotation_mode = ?, is_setup_complete = 1, current_turn_index = ?, parent1_email = ?, parent2_email = ? WHERE family_id = ?'
    ).run(parent1, parent2, bedtime, wakeTime, safeRotationMode, firstTurnIndex, parent1Email, parent2Email, familyId);
  } else if (firstTurnIndex !== undefined) {
    db.prepare(
      'UPDATE settings SET parent1_name = ?, parent2_name = ?, bedtime = ?, wake_time = ?, rotation_mode = ?, is_setup_complete = 1, current_turn_index = ? WHERE family_id = ?'
    ).run(parent1, parent2, bedtime, wakeTime, safeRotationMode, firstTurnIndex, familyId);
  } else {
    db.prepare(
      'UPDATE settings SET parent1_name = ?, parent2_name = ?, bedtime = ?, wake_time = ?, rotation_mode = ?, is_setup_complete = 1 WHERE family_id = ?'
    ).run(parent1, parent2, bedtime, wakeTime, safeRotationMode, familyId);
  }
};

export const toggleTurn = (familyId: string) => {
  const settings: any = getSettings(familyId);
  const newIndex = settings.current_turn_index === 0 ? 1 : 0;
  db.prepare('UPDATE settings SET current_turn_index = ?, last_switch_timestamp = CURRENT_TIMESTAMP WHERE family_id = ?').run(newIndex, familyId);
  return newIndex;
};

export const setTurnIndex = (familyId: string, index: number) => {
  db.prepare('UPDATE settings SET current_turn_index = ?, last_switch_timestamp = CURRENT_TIMESTAMP WHERE family_id = ?').run(index, familyId);
};

export const logAction = (familyId: string, parentName: string, action: string, nightDate?: string) => {
  db.prepare('INSERT INTO logs (family_id, parent_name, action, night_date) VALUES (?, ?, ?, ?)').run(familyId, parentName, action, nightDate ?? null);
};

export const getLogs = (familyId: string) => {
  return db.prepare('SELECT * FROM logs WHERE family_id = ? ORDER BY timestamp DESC LIMIT 10').all(familyId);
};

// Returns the first completed_turn or took_over entry for a given night (keyed by night_date)
export const getFirstTripOfNight = (familyId: string, nightDate: string) => {
  return db.prepare(
    `SELECT * FROM logs
     WHERE family_id = ? AND night_date = ? AND action IN ('completed_turn', 'took_over')
     ORDER BY timestamp ASC LIMIT 1`
  ).get(familyId, nightDate) as any;
};

// Returns all nights grouped, most recent first
export const getJournal = (familyId: string) => {
  const logs = db.prepare(
    `SELECT * FROM logs
     WHERE family_id = ? AND night_date IS NOT NULL
     ORDER BY night_date DESC, timestamp ASC`
  ).all(familyId) as any[];

  const nights = new Map<string, any[]>();
  for (const log of logs) {
    if (!nights.has(log.night_date)) nights.set(log.night_date, []);
    nights.get(log.night_date)!.push(log);
  }

  return Array.from(nights.entries()).map(([date, trips]) => {
    // First person = first completed_turn or took_over
    const firstTrip = trips.find(t => t.action === 'completed_turn' || t.action === 'took_over');
    return {
      night_date: date,
      first_parent: firstTrip ? firstTrip.parent_name : null,
      trips
    };
  });
};

export const saveSubscription = (familyId: string, sub: any) => {
  db.prepare('INSERT OR REPLACE INTO subscriptions (endpoint, family_id, keys) VALUES (?, ?, ?)').run(sub.endpoint, familyId, JSON.stringify(sub.keys));
};

export const getSubscriptions = (familyId: string) => {
  return db.prepare('SELECT * FROM subscriptions WHERE family_id = ?').all(familyId).map((row: any) => ({
    endpoint: row.endpoint,
    keys: JSON.parse(row.keys)
  }));
};

// ─── Auth: Magic Links ─────────────────────────────────────────────────────

export const createMagicLink = (familyId: string, parentIndex: number, email: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min
  db.prepare(
    'INSERT INTO magic_links (token, family_id, parent_index, email, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(token, familyId, parentIndex, email, expiresAt);
  return token;
};

export const consumeMagicLink = (token: string): { family_id: string; parent_index: number } | null => {
  const row = db.prepare(
    'SELECT * FROM magic_links WHERE token = ? AND used = 0 AND expires_at > datetime(\'now\')'
  ).get(token) as any;
  if (!row) return null;
  db.prepare('UPDATE magic_links SET used = 1 WHERE token = ?').run(token);
  return { family_id: row.family_id, parent_index: row.parent_index };
};

// ─── Auth: Sessions ─────────────────────────────────────────────────────────

export const createSession = (familyId: string, parentIndex: number): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  db.prepare(
    'INSERT INTO sessions (token, family_id, parent_index, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, familyId, parentIndex, expiresAt);
  return token;
};

export const getSession = (token: string): { family_id: string; parent_index: number } | null => {
  const row = db.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')'
  ).get(token) as any;
  if (!row) return null;
  // Silent refresh: if < 3 days left, extend to 30 more days
  const remaining = new Date(row.expires_at).getTime() - Date.now();
  if (remaining < 3 * 24 * 60 * 60 * 1000) {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(newExpiry, token);
  }
  return { family_id: row.family_id, parent_index: row.parent_index };
};

export const deleteSession = (token: string) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
};

export const cleanupExpired = () => {
  db.prepare('DELETE FROM magic_links WHERE expires_at <= datetime(\'now\')').run();
  db.prepare('DELETE FROM sessions WHERE expires_at <= datetime(\'now\')').run();
};

// ─── Auth: Email helpers ────────────────────────────────────────────────────

export const findFamilyByEmail = (email: string): { family: any; parentIndex: number } | null => {
  const normalized = email.trim().toLowerCase();
  const row = db.prepare(
    'SELECT * FROM settings WHERE LOWER(parent1_email) = ? OR LOWER(parent2_email) = ?'
  ).get(normalized, normalized) as any;
  if (!row) return null;
  const parentIndex = (row.parent1_email || '').toLowerCase() === normalized ? 0 : 1;
  return { family: row, parentIndex };
};

export const generateFamilyId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

export const createFamily = (
  familyId: string,
  parent1Name: string,
  parent1Email: string,
  parent2Name: string,
  parent2Email: string,
  bedtime: string,
  wakeTime: string,
  firstTurnIndex: number
) => {
  db.prepare(
    `INSERT INTO settings (family_id, parent1_name, parent1_email, parent2_name, parent2_email, bedtime, wake_time, current_turn_index, is_setup_complete)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(familyId, parent1Name, parent1Email, parent2Name, parent2Email, bedtime, wakeTime, firstTurnIndex);
};

export const getParentEmail = (familyId: string, parentIndex: number): string | null => {
  const settings: any = getSettings(familyId);
  if (parentIndex === 0) return settings.parent1_email || null;
  if (parentIndex === 1) return settings.parent2_email || null;
  return null;
};

// ─── Push: parent-targeted subscriptions ────────────────────────────────────

export const saveSubscriptionWithParent = (familyId: string, sub: any, parentIndex: number) => {
  db.prepare(
    'INSERT OR REPLACE INTO subscriptions (endpoint, family_id, keys, parent_index) VALUES (?, ?, ?, ?)'
  ).run(sub.endpoint, familyId, JSON.stringify(sub.keys), parentIndex);
};

export const getSubscriptionsForParent = (familyId: string, parentIndex: number) => {
  return db.prepare('SELECT * FROM subscriptions WHERE family_id = ? AND parent_index = ?').all(familyId, parentIndex).map((row: any) => ({
    endpoint: row.endpoint,
    keys: JSON.parse(row.keys)
  }));
};

// ─── Partner join detection ──────────────────────────────────────────────────
// Check if the partner has ever logged in by looking for any session
// (including expired ones) or consumed magic link for their parent_index.

export const hasPartnerEverLoggedIn = (familyId: string, partnerIndex: number): boolean => {
  const row = db.prepare(
    'SELECT 1 FROM magic_links WHERE family_id = ? AND parent_index = ? AND used = 1 LIMIT 1'
  ).get(familyId, partnerIndex);
  return !!row;
};
