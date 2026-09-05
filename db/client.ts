import 'server-only';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

export type DatabaseHandle = {
  db: AppDatabase;
  sqlite: Database.Database;
  dbPath: string;
};

type GlobalDatabase = typeof globalThis & {
  __jpInvestDatabase?: DatabaseHandle;
};

export function resolveDatabasePath() {
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DB_PATH || '../jp-invest-data/db.sqlite',
  );
}

export function backupExistingDatabase(dbPath: string) {
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) return;

  const backupDirectory = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `db-before-migrate-${timestamp}.sqlite`);

  // `fs.copyFileSync` only ever copied the main file. In WAL mode (set below,
  // on every connection this module opens), committed-but-not-yet-checkpointed
  // data lives in `<dbPath>-wal` and such a copy silently lost it — up to and
  // including the schema itself. `VACUUM INTO`, run from a dedicated read-only
  // connection, reads the current committed snapshot (correctly excluding any
  // other connection's still-open, uncommitted transaction) and writes a
  // complete, checkpointed copy without touching the source at all.
  const source = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    source.pragma('busy_timeout = 5000');
    source.prepare('VACUUM INTO ?').run(backupPath);
  } finally {
    source.close();
  }
}

export function createDatabase(dbPath: string, runMigrations = true): DatabaseHandle {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    if (runMigrations) backupExistingDatabase(dbPath);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });

  if (runMigrations) {
    migrate(db, {
      migrationsFolder: path.join(/* turbopackIgnore: true */ process.cwd(), 'db', 'migrations'),
    });
  }

  return { db, sqlite, dbPath };
}

export function getDatabase(): DatabaseHandle {
  const globalDatabase = globalThis as GlobalDatabase;
  if (!globalDatabase.__jpInvestDatabase) {
    globalDatabase.__jpInvestDatabase = createDatabase(resolveDatabasePath());
  }
  return globalDatabase.__jpInvestDatabase;
}
