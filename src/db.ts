import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
`);

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
  let settings = db.prepare('SELECT * FROM settings WHERE family_id = ?').get(familyId);
  if (!settings) {
    db.prepare('INSERT INTO settings (family_id) VALUES (?)').run(familyId);
    settings = db.prepare('SELECT * FROM settings WHERE family_id = ?').get(familyId);
  }
  return settings;
};

export const updateSettings = (familyId: string, parent1: string, parent2: string, bedtime: string) => {
  db.prepare('UPDATE settings SET parent1_name = ?, parent2_name = ?, bedtime = ? WHERE family_id = ?')
    .run(parent1, parent2, bedtime, familyId);
};

export const toggleTurn = (familyId: string) => {
  const settings: any = getSettings(familyId);
  const newIndex = settings.current_turn_index === 0 ? 1 : 0;
  db.prepare('UPDATE settings SET current_turn_index = ?, last_switch_timestamp = CURRENT_TIMESTAMP WHERE family_id = ?').run(newIndex, familyId);
  return newIndex;
};

export const logAction = (familyId: string, parentName: string, action: string) => {
  db.prepare('INSERT INTO logs (family_id, parent_name, action) VALUES (?, ?, ?)').run(familyId, parentName, action);
};

export const getLogs = (familyId: string) => {
  return db.prepare('SELECT * FROM logs WHERE family_id = ? ORDER BY timestamp DESC LIMIT 10').all(familyId);
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
