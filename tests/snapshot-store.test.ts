import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { persistSourceSnapshot } from '@/lib/research/snapshot-store';
import type { SourceSnapshot } from '@/lib/research/adapters/types';

describe('source snapshot store', () => {
  let handle: DatabaseHandle;
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-store-'));
    handle = createDatabase(path.join(directory, 'test.sqlite'));
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function makeSnapshot(rawBytes: Uint8Array): SourceSnapshot {
    return {
      documentId: 'doc-1',
      market: 'ID',
      ticker: 'TLKM',
      sourceUrl: 'https://www.telkom.co.id/report.pdf',
      sourceName: 'Issuer official (TLKM)',
      sourceTier: 'official',
      sourceFormat: 'pdf',
      contentType: 'application/pdf',
      httpStatus: 200,
      publishDate: '2026-06-15',
      retrievalTimestamp: new Date().toISOString(),
      rawBytes,
    };
  }

  it('writes the raw bytes for a document it has not stored before', () => {
    const storagePath = persistSourceSnapshot({
      db: handle.db,
      snapshot: makeSnapshot(Buffer.from('real document bytes')),
      documentHash: 'hash-new',
      sourceMode: 'live',
      snapshotDirectory: directory,
      outcome: 'verified',
    });

    expect(fs.readFileSync(storagePath, 'utf8')).toBe('real document bytes');
  });

  /*
   * M013. An empty file on disk is not a stored document.
   *
   * The write was guarded by `fs.existsSync` alone, so once a zero-byte file
   * appeared it could never be replaced — the guard read "already stored" from
   * the file's mere existence. That mattered because a real defect produced
   * exactly those files: `pdfjs.getDocument` detaches the buffer it is handed,
   * and persistence runs afterwards, so seven of fifteen snapshots were empty.
   * Fixing the detachment stops new ones appearing; without this, the ones
   * already on disk would stay empty for the life of the store, because every
   * later fetch of the same document would decline to write.
   *
   * Content-addressed storage makes the repair unambiguous: the filename *is*
   * the hash of the intended content, so a zero-byte file at that path cannot
   * be a legitimate version of it.
   */
  it('replaces a zero-byte file left by an earlier failed write', () => {
    const storagePath = path.join(directory, 'hash-empty.bin');
    fs.writeFileSync(storagePath, new Uint8Array(0));
    expect(fs.statSync(storagePath).size).toBe(0);

    persistSourceSnapshot({
      db: handle.db,
      snapshot: makeSnapshot(Buffer.from('recovered document bytes')),
      documentHash: 'hash-empty',
      sourceMode: 'live',
      snapshotDirectory: directory,
      outcome: 'verified',
    });

    expect(fs.readFileSync(storagePath, 'utf8')).toBe('recovered document bytes');
  });

  it('does not rewrite a document already stored with content', () => {
    const storagePath = path.join(directory, 'hash-kept.bin');
    fs.writeFileSync(storagePath, 'original retained bytes');

    persistSourceSnapshot({
      db: handle.db,
      snapshot: makeSnapshot(Buffer.from('different bytes')),
      documentHash: 'hash-kept',
      sourceMode: 'live',
      snapshotDirectory: directory,
      outcome: 'verified',
    });

    // Immutability of a retained snapshot is the point of the store; only the
    // empty-file case above is treated as a failed write rather than a version.
    expect(fs.readFileSync(storagePath, 'utf8')).toBe('original retained bytes');
  });
});
