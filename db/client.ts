import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || '../jp-invest-data/db.sqlite';

// Ensure the directory exists or better-sqlite3 will throw, but typically the user or a startup script creates the folder.
// Since better-sqlite3 creates the file if it doesn't exist, we just need the parent directory to exist.
const sqlite = new Database(dbPath);

// Enforce foreign keys for every connection as required by ADR-0006
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
