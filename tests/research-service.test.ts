import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptions, conversations, evidence, ingestionLeases, ingestionRuns, messages, researchJobSources, researchJobs, sourceCursors, sourceSnapshots, theses } from '@/db/schema';
import { thesisDraftSchema } from '@/lib/domain/contracts';
import { acceptSecondaryEvidence, confirmDraft, getResearchPanel, processResearchJobs, retryResearchJob } from '@/lib/research/service';
import { IngestionAlreadyRunningError, refreshOfficialSources } from '@/lib/research/ingestion';

const draft = thesisDraftSchema.parse({
  ticker: 'PLTR',
  companyName: 'Palantir Technologies Inc.',
  market: 'US',
  coreBelief: 'I believe PLTR gross margin will remain above 80%.',
  assumptions: [{ statement: 'PLTR gross margin remains above 80%.', status: 'untested' }],
  requiresChallenge: false,
});

describe('local vertical slice persistence', () => {
  let directory: string;
  let handle: DatabaseHandle;
  const conversationId = '77d80b7f-4d57-46ab-9341-f972b6ecf5f3';
  const messageId = '79f651e7-77ab-4745-84f9-d20b7efef6e3';

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-'));
    handle = createDatabase(path.join(directory, 'test.sqlite'));
    handle.db.insert(conversations).values({ id: conversationId, title: 'PLTR thesis' }).run();
    handle.db.insert(messages).values({
      id: messageId,
      conversationId,
      role: 'assistant',
      content: 'Review the draft.',
      structuredPayload: JSON.stringify(draft),
      validationOutcome: 'valid',
    }).run();
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('applies all migrations and enforces foreign keys', () => {
    const tables = handle.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toContain('research_jobs');
    expect(tables.map((table) => table.name)).toContain('source_snapshots');
    expect(tables.map((table) => table.name)).toContain('ingestion_runs');
    expect(tables.map((table) => table.name)).toContain('source_cursors');
    expect(handle.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('backs up an existing database before a migration run', () => {
    handle.sqlite.close();
    handle = createDatabase(path.join(directory, 'test.sqlite'));
    const backups = fs.readdirSync(path.join(directory, 'backups'));
    expect(backups.some((name) => name.startsWith('db-before-migrate-'))).toBe(true);
  });

  it('confirms transactionally and is idempotent', () => {
    const first = confirmDraft(conversationId, messageId, { db: handle.db });
    const second = confirmDraft(conversationId, messageId, { db: handle.db });
    expect(first.alreadyConfirmed).toBe(false);
    expect(second).toMatchObject({ thesisId: first.thesisId, alreadyConfirmed: true });
    expect(handle.db.select({ count: sql<number>`count(*)` }).from(theses).get()?.count).toBe(1);
    expect(handle.db.select({ count: sql<number>`count(*)` }).from(researchJobs).get()?.count).toBe(1);
  });

  it('rolls back an invalid confirmation', () => {
    handle.db.update(messages).set({ structuredPayload: '{bad json' }).where(eq(messages.id, messageId)).run();
    expect(() => confirmDraft(conversationId, messageId, { db: handle.db })).toThrow();
    expect(handle.db.select().from(theses).all()).toHaveLength(0);
    expect(handle.db.select().from(assumptions).all()).toHaveLength(0);
  });

  it('moves a job to succeeded and stores only exact evidence', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(panel.items[0].job.status).toBe('succeeded');
    expect(panel.items[0].evidence[0]).toMatchObject({
      exactQuote: 'gross margin of 81.3%',
      verificationStatus: 'exact_verified',
      interpretationStatus: 'pending',
    });
    expect(handle.db.select().from(assumptions).get()?.status).toBe('untested');
    expect(handle.db.select().from(sourceSnapshots).all()).toHaveLength(1);
    expect(handle.db.select().from(researchJobSources).all()).toHaveLength(1);
  });

  it('persists OCR-matched evidence without promoting it to exact evidence', async () => {
    const ocrDraft = { ...draft, assumptions: [{ statement: 'BBRI simulate ocr evidence.', status: 'untested' as const }] };
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(ocrDraft) }).where(eq(messages.id, messageId)).run();
    confirmDraft(conversationId, messageId, { db: handle.db });
    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(panel.items[0].job.status).toBe('succeeded');
    expect(panel.items[0].evidence[0]).toMatchObject({
      exactQuote: 'Pendapatan bersih meningkat 12,4%',
      verificationStatus: 'ocr_matched',
      contentKind: 'text',
      sourceVariant: 'scanned',
      extractionMethod: 'ocr',
      pageNumber: 1,
      boundingBox: '[0.1,0.2,0.8,0.3]',
    });
    expect(handle.db.select().from(evidence).get()?.verificationStatus).toBe('ocr_matched');
  });

  it('persists derived evidence with method metadata and bounding box', async () => {
    const derivedDraft = { ...draft, assumptions: [{ statement: 'BBRI simulate derived evidence.', status: 'untested' as const }] };
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(derivedDraft) }).where(eq(messages.id, messageId)).run();
    confirmDraft(conversationId, messageId, { db: handle.db });
    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(panel.items[0].job.status).toBe('succeeded');
    expect(panel.items[0].evidence[0]).toMatchObject({
      exactQuote: 'Rp 9,2 triliun',
      verificationStatus: 'derived',
      contentKind: 'table',
      extractionMethod: 'table_parser',
      pageNumber: 3,
      boundingBox: '[0.1,0.2,0.9,0.7]',
    });
    const stored = handle.db.select().from(evidence).get();
    expect(stored?.verificationStatus).toBe('derived');
    expect(stored?.metadata).toContain('table_cell_lookup');
  });

  it('degrades a citation mismatch, stores no evidence, and permits retry', async () => {
    const mismatch = { ...draft, assumptions: [{ statement: 'PLTR gross margin remains above 90% (simulate citation mismatch).', status: 'untested' as const }] };
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(mismatch) }).where(eq(messages.id, messageId)).run();
    const confirmed = confirmDraft(conversationId, messageId, { db: handle.db });
    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(panel.items[0].job.status).toBe('degraded');
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
    expect(handle.db.select().from(researchJobSources).get()).toMatchObject({ outcome: 'rejected', errorCode: 'citation_not_found' });
    await retryResearchJob(confirmed.jobIds[0], { db: handle.db });
    expect((await getResearchPanel(conversationId, { db: handle.db })).items[0].job.status).toBe('queued');
  });

  it('cascade deletes assumptions, jobs, and evidence with the thesis', async () => {
    const confirmed = confirmDraft(conversationId, messageId, { db: handle.db });
    await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    handle.db.delete(theses).where(eq(theses.id, confirmed.thesisId)).run();
    expect(handle.db.select().from(assumptions).all()).toHaveLength(0);
    expect(handle.db.select().from(researchJobs).all()).toHaveLength(0);
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
  });

  it('deduplicates immutable snapshots across jobs', async () => {
    const twoAssumptions = {
      ...draft,
      assumptions: [
        { statement: 'PLTR gross margin remains above 80%.', status: 'untested' as const },
        { statement: 'PLTR commercial scale supports gross margin.', status: 'untested' as const },
      ],
    };
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(twoAssumptions) }).where(eq(messages.id, messageId)).run();
    confirmDraft(conversationId, messageId, { db: handle.db });
    await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(handle.db.select().from(sourceSnapshots).all()).toHaveLength(1);
    expect(handle.db.select().from(researchJobSources).all()).toHaveLength(2);
  });

  it('refreshes tracked companies idempotently and records a source cursor', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const process = (id: string) => processResearchJobs(id, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    const first = await refreshOfficialSources('manual', { db: handle.db, process });
    const second = await refreshOfficialSources('cron', { db: handle.db, process });
    expect(first.lastRun).toMatchObject({ status: 'succeeded', newDocumentCount: 1 });
    expect(second.lastRun).toMatchObject({ status: 'succeeded', newDocumentCount: 0 });
    expect(handle.db.select().from(sourceSnapshots).all()).toHaveLength(1);
    expect(handle.db.select().from(evidence).all()).toHaveLength(1);
    expect(handle.db.select().from(sourceCursors).get()).toMatchObject({ market: 'US', ticker: 'PLTR' });
    expect(handle.db.select().from(assumptions).get()?.status).toBe('untested');
  });

  it('rejects an overlapping refresh with the stable already_running code', async () => {
    handle.db.insert(ingestionLeases).values({ id: 'official-source-refresh', ownerId: 'other', expiresAt: '2099-01-01T00:00:00.000Z', updatedAt: '2026-07-05T00:00:00.000Z' }).run();
    await expect(refreshOfficialSources('cron', { db: handle.db })).rejects.toBeInstanceOf(IngestionAlreadyRunningError);
    expect(handle.db.select().from(ingestionRuns).all()).toHaveLength(0);
  });

  // M007 Slice 4. The default mock secondary adapters (createSecondarySourceAdapters
  // in mock mode) use generic fixture text that shares too little vocabulary
  // with these tests' assumptions to pass rankSentenceCandidates's threshold —
  // that's why the tests above see unchanged snapshot/evidence counts; it's
  // not evidence the integration is inert. This test supplies a secondary
  // adapter whose content genuinely matches the assumption, to prove
  // secondary evidence really persists end-to-end through processResearchJobs.
  it('persists secondary_issuer evidence end-to-end alongside the official result', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const issuerPrSnapshot = {
      documentId: 'press-1', market: 'US' as const, ticker: 'PLTR',
      sourceUrl: 'https://example.invalid/press/pltr', sourceName: 'Issuer press release (PLTR)',
      sourceTier: 'secondary' as const, publishDate: '2026-07-20', sourceFormat: 'html' as const,
      rawBytes: new TextEncoder().encode('<html><body><p>Palantir reported gross margin of 81.3% in the quarter, remaining above 80%.</p></body></html>'),
      retrievalTimestamp: '2026-07-20T00:00:00.000Z', contentType: 'text/html', httpStatus: 200,
    };
    const issuerPrAdapter = {
      mode: 'mock' as const,
      async discover() { return { kind: 'found' as const, value: [issuerPrSnapshot] }; },
      async fetchSnapshot() { return { kind: 'found' as const, value: issuerPrSnapshot }; },
    };

    const panel = await processResearchJobs(conversationId, {
      db: handle.db,
      snapshotDirectory: path.join(directory, 'snapshots'),
      secondaryAdapters: {
        US: { issuerPr: issuerPrAdapter, newsWire: undefined },
        ID: { issuerPr: issuerPrAdapter, newsWire: undefined },
      },
    });

    // Official evidence is unaffected.
    expect(panel.items[0].job.status).toBe('succeeded');
    expect(panel.items[0].evidence.some((e) => e.verificationStatus === 'exact_verified')).toBe(true);
    // Secondary evidence was persisted too, correctly tagged, alongside it.
    const secondaryRows = handle.db.select().from(evidence).where(eq(evidence.verificationStatus, 'secondary_issuer')).all();
    expect(secondaryRows.length).toBeGreaterThan(0);
    expect(secondaryRows[0]).toMatchObject({ sourceTier: 'secondary', content: expect.stringContaining('gross margin of 81.3%') });
  });

  // The soft-failure guarantee: a secondary adapter that throws must never
  // change research_jobs.status away from the official outcome.
  it('never fails or degrades the job when a secondary adapter errors', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const throwingAdapter = {
      mode: 'mock' as const,
      async discover(): Promise<never> { throw new Error('secondary source boom'); },
      async fetchSnapshot(): Promise<never> { throw new Error('unreachable'); },
    };

    const panel = await processResearchJobs(conversationId, {
      db: handle.db,
      snapshotDirectory: path.join(directory, 'snapshots'),
      secondaryAdapters: {
        US: { issuerPr: throwingAdapter, newsWire: throwingAdapter },
        ID: { issuerPr: throwingAdapter, newsWire: throwingAdapter },
      },
    });

    expect(panel.items[0].job.status).toBe('succeeded');
    expect(panel.items[0].job.error).toBeNull();
    expect(handle.db.select().from(evidence).where(eq(evidence.verificationStatus, 'secondary_issuer')).all()).toHaveLength(0);
  });

  // M007 Slice 5. "simulate citation mismatch" (built into candidateFor)
  // guarantees the official candidate is rejected by verifyExactMatch, so
  // this assumption ends up with zero official evidence — exactly the
  // "secondary-only" scenario the confirmation gate exists for.
  it('moves an assumption to pending_confirmation when only secondary evidence is found', async () => {
    const mismatchDraft = { ...draft, assumptions: [{ statement: 'simulate citation mismatch for gross margin.', status: 'untested' as const }] };
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(mismatchDraft) }).where(eq(messages.id, messageId)).run();
    confirmDraft(conversationId, messageId, { db: handle.db });

    const issuerPrSnapshot = {
      documentId: 'press-mismatch-1', market: 'US' as const, ticker: 'PLTR',
      sourceUrl: 'https://example.invalid/press/pltr-mismatch', sourceName: 'Issuer press release (PLTR)',
      sourceTier: 'secondary' as const, publishDate: '2026-07-20', sourceFormat: 'html' as const,
      rawBytes: new TextEncoder().encode('<html><body><p>Palantir simulate citation mismatch for gross margin update, remaining confident.</p></body></html>'),
      retrievalTimestamp: '2026-07-20T00:00:00.000Z', contentType: 'text/html', httpStatus: 200,
    };
    const issuerPrAdapter = {
      mode: 'mock' as const,
      async discover() { return { kind: 'found' as const, value: [issuerPrSnapshot] }; },
      async fetchSnapshot() { return { kind: 'found' as const, value: issuerPrSnapshot }; },
    };

    await processResearchJobs(conversationId, {
      db: handle.db,
      snapshotDirectory: path.join(directory, 'snapshots'),
      secondaryAdapters: {
        US: { issuerPr: issuerPrAdapter, newsWire: undefined },
        ID: { issuerPr: issuerPrAdapter, newsWire: undefined },
      },
    });

    expect(handle.db.select().from(evidence).where(eq(evidence.verificationStatus, 'exact_verified')).all()).toHaveLength(0);
    expect(handle.db.select().from(evidence).where(eq(evidence.verificationStatus, 'secondary_issuer')).all().length).toBeGreaterThan(0);
    expect(handle.db.select().from(assumptions).get()?.status).toBe('pending_confirmation');
  });

  // Clearing path 1: official evidence arriving reverts pending_confirmation
  // back to untested — never to 'verified'.
  it('reverts pending_confirmation to untested when official evidence later confirms the assumption', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    handle.db.update(assumptions).set({ status: 'pending_confirmation' }).run();

    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });

    expect(panel.items[0].evidence.some((e) => e.verificationStatus === 'exact_verified')).toBe(true);
    expect(handle.db.select().from(assumptions).get()?.status).toBe('untested');
  });

  describe('acceptSecondaryEvidence (M007 clearing path 2)', () => {
    it('transitions a pending_confirmation assumption to user_confirmed_secondary', async () => {
      const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
      const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
      handle.db.update(assumptions).set({ status: 'pending_confirmation' }).where(eq(assumptions.id, assumption.id)).run();

      const result = await acceptSecondaryEvidence(assumption.id, { db: handle.db });
      expect(result.status).toBe('user_confirmed_secondary');
      expect(handle.db.select().from(assumptions).where(eq(assumptions.id, assumption.id)).get()?.status).toBe('user_confirmed_secondary');
    });

    it('refuses to accept an assumption that is not pending confirmation', async () => {
      const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
      const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
      expect(assumption.status).toBe('untested');

      await expect(acceptSecondaryEvidence(assumption.id, { db: handle.db })).rejects.toThrow();
      expect(handle.db.select().from(assumptions).where(eq(assumptions.id, assumption.id)).get()?.status).toBe('untested');
    });
  });
});
