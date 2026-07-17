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

function backupExistingDatabase(dbPath: string) {
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) return;

  const backupDirectory = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(dbPath, path.join(backupDirectory, `db-before-migrate-${timestamp}.sqlite`));
}

export function createDatabase(dbPath: string, runMigrations = true): DatabaseHandle {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    if (runMigrations) backupExistingDatabase(dbPath);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
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
