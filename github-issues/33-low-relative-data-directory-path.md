# [LOW] Database path uses relative `./data` — can create DB in wrong location

**Labels:** `low` `backend` `deployment`

## Summary

The database file path defaults to `./data/starturn.db` (relative to the current working directory). If the server is started from a directory other than the project root — common in some deployment environments, Docker containers, or npm scripts — the data directory is created in the wrong location. Data will appear missing because a fresh DB was created elsewhere.

## Affected Code

`src/db.ts` (approximately):

```ts
const DB_PATH = process.env.DB_PATH || './data/starturn.db';
```

Or equivalent hardcoded path.

## Fix — Use `__dirname` or `import.meta.url` Relative to the Source File

For a CommonJS / compiled output:

```ts
import path from 'path';

const defaultDbPath = path.join(__dirname, '..', 'data', 'starturn.db');
const DB_PATH = process.env.DB_PATH || defaultDbPath;
```

For ES Modules (`type: "module"` in package.json):

```ts
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(__dirname, '..', 'data', 'starturn.db');
const DB_PATH = process.env.DB_PATH || defaultDbPath;
```

This ensures the data directory is always relative to the source file, regardless of where `node server.js` is invoked from.

Also ensure the directory is created before opening the DB:

```ts
import fs from 'fs';

const dataDir = path.dirname(DB_PATH);
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
```

## Verification Steps

1. Start the server from a different directory: `node /path/to/project/dist/server.js` (from `/home/user`, say)
2. Check where `data/starturn.db` was created
3. **Expected (with fix):** DB created at `/path/to/project/data/starturn.db`
4. **Actual (current):** DB created at `/home/user/data/starturn.db` — a new empty database
