import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupExistingDatabase, createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptionMeasurements, assumptions, evidence, sourceSnapshots, theses } from '@/db/schema';

// M015 step 6a (AC-M015-07, first half). `backupExistingDatabase` previously
// used `fs.copyFileSync`, which copies only the main database file. In WAL
// mode, committed-but-not-yet-checkpointed data lives in `<db>-wal` and is
// silently absent from such a copy. These tests force a non-empty WAL by
// disabling auto-checkpoint, then prove the backup is consistent against it.

function latestBackupFile(databaseDirectory: string): string {
  const backupsDirectory = path.join(databaseDirectory, 'backups');
  const files = fs.readdirSync(backupsDirectory).filter((name) => name.startsWith('db-before-migrate-'));
  expect(files.length).toBeGreaterThan(0);
  files.sort();
  return path.join(backupsDirectory, files[files.length - 1]);
}

describe('backupExistingDatabase is WAL-consistent (M015 step 6a)', () => {
  let directory: string;
  let handle: DatabaseHandle | undefined;
  let restoredHandle: DatabaseHandle | undefined;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-backup-'));
  });

  afterEach(() => {
    restoredHandle?.sqlite.close();
    restoredHandle = undefined;
    handle?.sqlite.close();
    handle = undefined;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('restores committed rows that exist only in a non-empty WAL file, with row counts matching the source and integrity intact', () => {
    const dbPath = path.join(directory, 'db.sqlite');
    handle = createDatabase(dbPath);

    // Disable auto-checkpoint so every subsequent commit stays in the WAL
    // rather than being folded back into the main file automatically.
    handle.sqlite.pragma('wal_autocheckpoint = 0');

    handle.db.insert(theses).values({ id: 'thesis-1', title: 'WAL backup smoke test', description: 'd' }).run();
    handle.db.insert(assumptions).values({
      id: 'assumption-1',
      thesisId: 'thesis-1',
      statement: 'Net revenue grows next quarter.',
    }).run();
    handle.db.insert(assumptionMeasurements).values({ assumptionId: 'assumption-1', metric: 'net revenue' }).run();
    handle.db.insert(sourceSnapshots).values({
      documentHash: 'hash-1',
      documentId: 'doc-1',
      market: 'US',
      ticker: 'TEST',
      sourceUrl: 'https://example.invalid/doc-1',
      sourceName: 'Test source',
      sourceTier: 'official',
      sourceFormat: 'html',
      contentType: 'text/html',
      httpStatus: 200,
      retrievalTimestamp: new Date().toISOString(),
      storagePath: path.join(directory, 'doc-1.html'),
      sourceMode: 'mock',
    }).run();
    handle.db.insert(evidence).values({
      id: 'evidence-1',
      assumptionId: 'assumption-1',
      sourceFormat: 'html',
      contentKind: 'text',
      extractionMethod: 'html_parser',
      verificationStatus: 'exact_verified',
      documentHash: 'hash-1',
      sourceUrl: 'https://example.invalid/doc-1',
      retrievalTimestamp: new Date().toISOString(),
      content: 'Net revenue grew 12% year over year.',
    }).run();

    // Confirm the test scenario is real: the WAL must actually hold data,
    // otherwise this proves nothing about WAL consistency.
    const walSize = fs.statSync(`${dbPath}-wal`).size;
    expect(walSize).toBeGreaterThan(0);

    backupExistingDatabase(dbPath);
    const backupPath = latestBackupFile(directory);

    restoredHandle = createDatabase(backupPath, /* runMigrations */ false);
    const integrity = restoredHandle.sqlite.pragma('integrity_check', { simple: true });
    expect(integrity).toBe('ok');

    expect(restoredHandle.db.select().from(theses).all()).toHaveLength(1);
    expect(restoredHandle.db.select().from(assumptions).all()).toHaveLength(1);
    expect(restoredHandle.db.select().from(assumptionMeasurements).all()).toHaveLength(1);
    expect(restoredHandle.db.select().from(sourceSnapshots).all()).toHaveLength(1);
    const restoredEvidence = restoredHandle.db.select().from(evidence).all();
    expect(restoredEvidence).toHaveLength(1);
    expect(restoredEvidence[0]).toMatchObject({ id: 'evidence-1', content: 'Net revenue grew 12% year over year.' });
  });

  it('excludes a still-open, uncommitted write transaction on the live connection', () => {
    const dbPath = path.join(directory, 'db.sqlite');
    handle = createDatabase(dbPath);
    handle.sqlite.pragma('wal_autocheckpoint = 0');

    handle.db.insert(theses).values({ id: 'committed-thesis', title: 'committed before txn', description: 'd' }).run();

    handle.sqlite.exec('BEGIN IMMEDIATE');
    handle.db.insert(theses).values({ id: 'uncommitted-thesis', title: 'UNCOMMITTED', description: 'd' }).run();

    backupExistingDatabase(dbPath);

    handle.sqlite.exec('ROLLBACK');

    const backupPath = latestBackupFile(directory);
    restoredHandle = createDatabase(backupPath, /* runMigrations */ false);
    const restoredIds = restoredHandle.db.select().from(theses).all().map((row) => row.id);
    expect(restoredIds).toEqual(['committed-thesis']);
  });
});
