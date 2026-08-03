import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptionMeasurements, assumptions, decisions, discoveryCandidates, theses } from '@/db/schema';

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

  // M007 Slice 1. Confirms both the widened assumptions.status enum (no
  // migration needed, since Drizzle's {enum:} narrowing is TS-only) and the
  // new discovery_candidates table round-trip on a freshly-migrated database.
  it('applies migration 0007 and round-trips discovery_candidates and the widened assumption status', () => {
    handle = createDatabase(path.join(directory, 'test-0007.sqlite'));

    const columns = handle.sqlite.prepare("PRAGMA table_info('assumptions')").all() as ColumnInfo[];
    const statusColumn = columns.find((column) => column.name === 'status');
    expect(statusColumn?.notnull).toBe(1);
    // Confirms the finding that drove Slice 1's design: Drizzle's {enum:}
    // narrowing on SQLite emits a plain text column, never a CHECK
    // constraint — so widening the TS-level enum required no migration.
    const createTableSql = (
      handle.sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='assumptions'").get() as { sql: string }
    ).sql;
    expect(createTableSql.toUpperCase()).not.toContain('CHECK');

    handle.db.insert(theses).values({ id: 'thesis-m007', title: 'M007 schema smoke test', description: 'd' }).run();
    handle.db.insert(assumptions).values({
      id: 'assumption-m007',
      thesisId: 'thesis-m007',
      statement: 'Net revenue grows next quarter.',
      status: 'pending_confirmation',
    }).run();
    const [insertedAssumption] = handle.db.select().from(assumptions).where(eq(assumptions.id, 'assumption-m007')).all();
    expect(insertedAssumption.status).toBe('pending_confirmation');

    handle.db.update(assumptions).set({ status: 'user_confirmed_secondary' }).where(eq(assumptions.id, 'assumption-m007')).run();
    const [updatedAssumption] = handle.db.select().from(assumptions).where(eq(assumptions.id, 'assumption-m007')).all();
    expect(updatedAssumption.status).toBe('user_confirmed_secondary');

    const discoveryIndexes = handle.sqlite.prepare("PRAGMA index_list('discovery_candidates')").all() as IndexInfo[];
    expect(discoveryIndexes.some((index) => index.name === 'discovery_candidates_market_ticker_url_unique')).toBe(true);

    handle.db.insert(discoveryCandidates).values({
      id: 'candidate-1',
      market: 'US',
      ticker: 'PLTR',
      candidateUrl: 'https://example.invalid/pltr-news',
      searchQuery: 'PLTR Palantir Technologies',
    }).run();
    const [candidate] = handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'candidate-1')).all();
    expect(candidate).toMatchObject({
      status: 'pending',
      discoveredVia: 'web_search',
      resultingDocumentHash: null,
      rejectionReason: null,
    });

    // Uniqueness on (market, ticker, candidateUrl) is enforced.
    expect(() => handle!.db.insert(discoveryCandidates).values({
      id: 'candidate-2',
      market: 'US',
      ticker: 'PLTR',
      candidateUrl: 'https://example.invalid/pltr-news',
      searchQuery: 'duplicate url, different id',
    }).run()).toThrow();
  });

  // M011 Slice 1. `assumption_measurements` is 1:1 with `assumptions` by way of
  // `assumption_id` being the primary key — the cardinality is a schema fact,
  // not a convention, and this pins it.
  it('applies migration 0008 and round-trips assumption_measurements', () => {
    handle = createDatabase(path.join(directory, 'test-0008.sqlite'));

    const columns = handle.sqlite.prepare("PRAGMA table_info('assumption_measurements')").all() as ColumnInfo[];
    const byName = new Map(columns.map((column) => [column.name, column]));
    expect(byName.get('assumption_id')?.pk).toBe(1);
    expect(byName.get('resolution')?.notnull).toBe(1);
    // `threshold` is the first nullable numeric column in this schema: a
    // directional or qualitative contract genuinely has no threshold, and
    // 0 is a legal threshold, so null is the only honest absent value.
    expect(byName.get('threshold')?.notnull).toBe(0);
    expect(byName.get('clarifying_question')?.notnull).toBe(0);

    handle.db.insert(theses).values({ id: 'thesis-m011', title: 'M011 schema smoke test', description: 'd' }).run();
    handle.db.insert(assumptions).values({
      id: 'assumption-m011',
      thesisId: 'thesis-m011',
      statement: 'Automotive gross margin remains above 20%.',
    }).run();

    // Defaults alone must produce the legacy sentinel, because that is exactly
    // what the 0008 backfill inserts for every pre-M011 row.
    handle.db.insert(assumptionMeasurements).values({ assumptionId: 'assumption-m011' }).run();
    const [defaulted] = handle.db.select().from(assumptionMeasurements).all();
    expect(defaulted).toMatchObject({
      resolution: 'legacy_unspecified',
      operator: 'none',
      threshold: null,
      unit: 'unspecified',
      timeBasis: 'unspecified',
      sourceTags: '[]',
      ambiguityReason: 'none',
    });

    handle.db.update(assumptionMeasurements).set({
      resolution: 'resolved',
      metric: 'automotive gross margin',
      operator: 'gte',
      threshold: 20,
      unit: 'percent',
      timeBasis: 'duration_quarter',
      sourceTags: JSON.stringify(['GrossProfit']),
    }).where(eq(assumptionMeasurements.assumptionId, 'assumption-m011')).run();
    const [resolved] = handle.db.select().from(assumptionMeasurements).all();
    expect(resolved).toMatchObject({ resolution: 'resolved', threshold: 20, timeBasis: 'duration_quarter' });

    // A second row for the same assumption is impossible — the 1:1 constraint.
    expect(() => handle!.db.insert(assumptionMeasurements).values({ assumptionId: 'assumption-m011' }).run()).toThrow();

    // Cascade: deleting the assumption takes its contract with it, so a
    // contract can never outlive the claim it measures.
    handle.sqlite.pragma('foreign_keys = ON');
    handle.db.delete(assumptions).where(eq(assumptions.id, 'assumption-m011')).run();
    expect(handle.db.select().from(assumptionMeasurements).all()).toHaveLength(0);
  });

  // M011 Slice 1. The backfill is the reason a pre-M011 thesis reports
  // "cannot be checked" rather than reading as an extraction failure.
  it('backfills every pre-existing assumption with a legacy_unspecified contract', () => {
    const dbPath = path.join(directory, 'legacy-measurements.sqlite');
    const sqlite = new Database(dbPath);
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(`
      CREATE TABLE assumptions (id TEXT PRIMARY KEY);
      INSERT INTO assumptions (id) VALUES ('a1'), ('a2'), ('a3');
    `);

    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), 'db', 'migrations', '0008_add_assumption_measurements.sql'),
      'utf-8',
    );
    const statements = migrationSql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) sqlite.exec(statement);

    const rows = sqlite
      .prepare('SELECT assumption_id, resolution FROM assumption_measurements ORDER BY assumption_id')
      .all() as Array<{ assumption_id: string; resolution: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.resolution === 'legacy_unspecified')).toBe(true);

    // Idempotent: re-running the backfill statement is a no-op, so a partially
    // applied migration can be safely retried.
    sqlite.exec(statements[statements.length - 1]);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM assumption_measurements').get()).toMatchObject({ n: 3 });

    sqlite.close();
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
