import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { decisions, theses } from '@/db/schema';

type ColumnInfo = { name: string; notnull: number; pk: number };
type IndexInfo = { name: string };

describe('migration round trip (ADR-0006)', () => {
  let directory: string;
  let handle: DatabaseHandle | undefined;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-migrations-'));
  });

  afterEach(() => {
    handle?.sqlite.close();
    handle = undefined;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('applies all migrations on an empty database and matches the ORM schema for decisions', () => {
    handle = createDatabase(path.join(directory, 'test.sqlite'));

    const columns = handle.sqlite.prepare("PRAGMA table_info('decisions')").all() as ColumnInfo[];
    const byName = new Map(columns.map((column) => [column.name, column]));

    expect(byName.has('decision')).toBe(false);
    expect(byName.get('outcome')?.notnull).toBe(1);
    expect(byName.get('action')?.notnull).toBe(0);
    expect(byName.get('rationale')?.notnull).toBe(1);
    expect(byName.get('thesis_id')?.notnull).toBe(1);
    expect(byName.get('id')?.pk).toBe(1);

    const indexes = handle.sqlite.prepare("PRAGMA index_list('decisions')").all() as IndexInfo[];
    expect(indexes.some((index) => index.name === 'decisions_thesis_created_idx')).toBe(true);

    handle.db.insert(theses).values({ id: 'thesis-1', title: 'Schema smoke test', description: 'd' }).run();
    handle.db.insert(decisions).values({
      id: 'decision-1',
      thesisId: 'thesis-1',
      outcome: 'No Change',
      action: null,
      rationale: 'schema smoke test',
    }).run();

    const inserted = handle.db.select().from(decisions).all();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ outcome: 'No Change', action: null });
  });

  it('backfills legacy packed decision rows and normalizes timestamps', () => {
    const dbPath = path.join(directory, 'legacy.sqlite');
    const sqlite = new Database(dbPath);
    sqlite.pragma('foreign_keys = OFF');

    sqlite.exec(`
      CREATE TABLE theses (id TEXT PRIMARY KEY);
      CREATE TABLE decisions (
        id TEXT PRIMARY KEY,
        thesis_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO theses (id) VALUES ('thesis-1');
      INSERT INTO decisions (id, thesis_id, decision, rationale, created_at) VALUES
        ('d1', 'thesis-1', 'Update Thesis: Hold', 'legacy packed row', '2026-01-01 10:00:00'),
        ('d2', 'thesis-1', 'Archive', 'outcome-only legacy row', '2026-01-02T10:00:00.000Z');
    `);

    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), 'db', 'migrations', '0006_normalize_decision_outcomes.sql'),
      'utf-8',
    );
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }

    const rows = sqlite
      .prepare('SELECT id, thesis_id, outcome, action, rationale, created_at FROM decisions ORDER BY id')
      .all() as Array<{ id: string; thesis_id: string; outcome: string; action: string | null; rationale: string; created_at: string }>;

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ outcome: 'Update Thesis', action: 'Hold', rationale: 'legacy packed row' });
    expect(rows[0].created_at).toBe('2026-01-01T10:00:00.000Z');
    expect(rows[1]).toMatchObject({ outcome: 'Archive', action: null, rationale: 'outcome-only legacy row' });
    expect(rows[1].created_at).toBe('2026-01-02T10:00:00.000Z');

    sqlite.close();
  });
});
