import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptionMeasurements, assumptions, conversations, discoveryCandidates, evidence, ingestionLeases, ingestionRuns, messages, researchJobSources, researchJobs, sourceCursors, sourceSnapshots, theses } from '@/db/schema';
import { thesisDraftSchema, type MeasurementContract } from '@/lib/domain/contracts';
import { acceptSecondaryEvidence, confirmDraft, getResearchPanel, processResearchJobs, retryResearchJob } from '@/lib/research/service';
import { IngestionAlreadyRunningError, refreshOfficialSources } from '@/lib/research/ingestion';
import { OfficialHttpClient } from '@/lib/research/http';

// M011. A resolved contract, deliberately: without one `confirmDraft` refuses
// the draft (that refusal has its own test below), so every existing case in
// this file would otherwise fail on a blocked confirmation rather than on
// whatever it actually asserts.
const RESOLVED_MEASUREMENT = {
  resolution: 'resolved' as const,
  metric: 'gross margin',
  definitionVariant: 'total company GAAP gross margin',
  operator: 'gte' as const,
  threshold: 80,
  unit: 'percent' as const,
  timeBasis: 'duration_quarter' as const,
  // Empty by default so `runXbrlFactCall` returns immediately: every case in
  // this file except the XBRL section below is about something else (evidence
  // class, dedup, the confirmation gate), and a second evidence row appearing
  // in all of them would make each test assert two things at once. The XBRL
  // cases opt in with `XBRL_MEASUREMENT`.
  sourceTags: [] as string[],
  clarifyingQuestion: null,
  ambiguityReason: 'none' as const,
};

// M011 Slice 4. `GrossMarginRatio` is the tag the deterministic fixture in
// `adapters/mock-sec-xbrl.ts` reports as a `pure` decimal (0.813), which the
// contract-unit conversion turns into 81.3 percent.
const XBRL_MEASUREMENT = { ...RESOLVED_MEASUREMENT, sourceTags: ['GrossMarginRatio'] };

const draft = thesisDraftSchema.parse({
  ticker: 'PLTR',
  companyName: 'Palantir Technologies Inc.',
  market: 'US',
  coreBelief: 'I believe PLTR gross margin will remain above 80%.',
  assumptions: [{ statement: 'PLTR gross margin remains above 80%.', status: 'untested', measurement: RESOLVED_MEASUREMENT }],
  requiresChallenge: false,
});

/**
 * M011. Attaches a resolved contract to statements written for a test that is
 * about something else entirely (evidence class, dedup, the confirmation gate).
 * Explicit rather than a default, so it stays obvious that confirmation is
 * gated on a contract — the blocked path has its own dedicated tests.
 */
const withMeasurement = (...statements: string[]) => ({
  ...draft,
  assumptions: statements.map((statement) => ({
    statement,
    status: 'untested' as const,
    measurement: RESOLVED_MEASUREMENT,
  })),
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

  // Found during live testing (2026-07-30): conversations.title never
  // synced with the thesis it belongs to, so the sidebar stayed on
  // whatever it showed before confirmation forever.
  it('syncs conversations.title to the same canonical title theses.title gets', () => {
    const result = confirmDraft(conversationId, messageId, { db: handle.db });
    const expectedTitle = 'PLTR — Palantir Technologies Inc.';
    expect(result.title).toBe(expectedTitle);
    const thesisTitle = handle.db.select({ title: theses.title }).from(theses).get()?.title;
    const conversationTitle = handle.db.select({ title: conversations.title }).from(conversations).where(eq(conversations.id, conversationId)).get()?.title;
    // Assert they're equal to each other, not just independently correct —
    // guards against the two literals drifting apart in the future.
    expect(conversationTitle).toBe(thesisTitle);
    expect(conversationTitle).toBe(expectedTitle);
  });

  it('does not further mutate the title on an already-confirmed re-confirmation', () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const titleAfterFirst = handle.db.select({ title: conversations.title }).from(conversations).where(eq(conversations.id, conversationId)).get()?.title;
    const second = confirmDraft(conversationId, messageId, { db: handle.db });
    expect(second.alreadyConfirmed).toBe(true);
    expect('title' in second).toBe(false);
    const titleAfterSecond = handle.db.select({ title: conversations.title }).from(conversations).where(eq(conversations.id, conversationId)).get()?.title;
    expect(titleAfterSecond).toBe(titleAfterFirst);
  });

  it('rolls back an invalid confirmation', () => {
    handle.db.update(messages).set({ structuredPayload: '{bad json' }).where(eq(messages.id, messageId)).run();
    expect(() => confirmDraft(conversationId, messageId, { db: handle.db })).toThrow();
    expect(handle.db.select().from(theses).all()).toHaveLength(0);
    expect(handle.db.select().from(assumptions).all()).toHaveLength(0);
  });

  // M011 Slice 2. The server half of the hard block. The UI disables the
  // button, but a client that POSTs anyway must still be refused — and nothing
  // may be written, since a half-created thesis with no contract is exactly the
  // state the ledger cannot describe honestly.
  it('refuses a draft whose measurement contract is unresolved, and writes nothing', () => {
    const blockedDraft = thesisDraftSchema.parse({
      ...draft,
      assumptions: [{
        statement: 'PLTR gross margin remains strong.',
        status: 'untested',
        measurement: {
          resolution: 'ambiguous',
          metric: 'gross margin',
          definitionVariant: '',
          operator: 'none',
          threshold: null,
          unit: 'unspecified',
          timeBasis: 'unspecified',
          sourceTags: [],
          clarifyingQuestion: 'Total-company gross margin, or segment gross margin excluding one-time items?',
          ambiguityReason: 'definition_variant_ambiguous',
        },
      }],
    });
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(blockedDraft) }).where(eq(messages.id, messageId)).run();

    // The thrown message carries the question, so a client that bypassed the
    // disabled button still learns what to answer.
    expect(() => confirmDraft(conversationId, messageId, { db: handle.db }))
      .toThrow(/Total-company gross margin, or segment gross margin/);

    expect(handle.db.select().from(theses).all()).toHaveLength(0);
    expect(handle.db.select().from(assumptions).all()).toHaveLength(0);
    expect(handle.db.select().from(researchJobs).all()).toHaveLength(0);
    expect(handle.db.select().from(assumptionMeasurements).all()).toHaveLength(0);
  });

  // A draft persisted before M011 has no measurement block at all. It must
  // block too — omission cannot read as "measured".
  it('refuses a legacy draft that carries no measurement block', () => {
    handle.db.update(messages).set({
      structuredPayload: JSON.stringify({
        ticker: 'PLTR',
        companyName: 'Palantir Technologies Inc.',
        market: 'US',
        coreBelief: 'I believe PLTR gross margin will remain above 80%.',
        assumptions: [{ statement: 'PLTR gross margin remains above 80%.', status: 'untested' }],
      }),
    }).where(eq(messages.id, messageId)).run();

    expect(() => confirmDraft(conversationId, messageId, { db: handle.db })).toThrow(/needs one clarification/);
    expect(handle.db.select().from(theses).all()).toHaveLength(0);
  });

  // M011 Slice 3. The mock PLTR fixture's evidence quote is "gross margin of
  // 81.3%", but it arrives through the *text* path and therefore carries no
  // structured `observedValue`. It must persist as inconclusive rather than
  // being scraped for a number — this is the anti-regex-scrape guard proven
  // end to end, not just as a unit test of the pure function.
  it('persists text-derived evidence as inconclusive, never scraping the quote for a number', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(panel.items[0].evidence[0]).toMatchObject({
      exactQuote: 'gross margin of 81.3%',
      polarity: 'inconclusive',
      deltaVsThreshold: null,
      polarityMethod: 'no_observed_value',
    });
  });

  // M011 Slice 1. An assumption must never exist without a contract, because
  // the coverage ledger counts contracts and a missing one is indistinguishable
  // from an unmeasurable claim.
  it('writes one measurement contract per assumption in the same transaction', () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const assumptionRows = handle.db.select().from(assumptions).all();
    const measurementRows = handle.db.select().from(assumptionMeasurements).all();
    expect(measurementRows).toHaveLength(assumptionRows.length);
    expect(measurementRows[0]).toMatchObject({
      assumptionId: assumptionRows[0].id,
      resolution: 'resolved',
      metric: 'gross margin',
      operator: 'gte',
      threshold: 80,
      unit: 'percent',
      timeBasis: 'duration_quarter',
      sourceTags: '[]',
    });
  });

  // M011 Slice 4. Structured XBRL retrieval is the only path that produces
  // evidence carrying a machine-comparable value, and therefore the only path
  // whose evidence can be anything other than inconclusive.
  describe('SEC XBRL fact retrieval', () => {
    const xbrlDraft = (measurement: MeasurementContract, statement = 'PLTR gross margin remains above 80%.') => ({
      ...draft,
      assumptions: [{ statement, status: 'untested' as const, measurement }],
    });

    const runWith = async (measurement: MeasurementContract) => {
      handle.db.update(messages).set({ structuredPayload: JSON.stringify(xbrlDraft(measurement)) }).where(eq(messages.id, messageId)).run();
      confirmDraft(conversationId, messageId, { db: handle.db });
      return processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    };

    it('retrieves a structured fact and persists a real polarity with a signed delta', async () => {
      const panel = await runWith(XBRL_MEASUREMENT);
      const fact = panel.items[0].evidence.find((row) => row.extractionMethod === 'xbrl_parser');
      expect(fact).toBeDefined();
      // 0.813 pure -> 81.3 percent, against a `gte 80` claim.
      expect(fact).toMatchObject({
        verificationStatus: 'derived',
        contentKind: 'structured_fact',
        sourceFormat: 'xbrl',
        polarity: 'supports',
        polarityMethod: 'numeric_threshold',
      });
      expect(fact!.deltaVsThreshold).toBeCloseTo(1.3, 6);
    });

    it('reports a breach when the same fact falls below the claimed threshold', async () => {
      const panel = await runWith({ ...XBRL_MEASUREMENT, threshold: 90 });
      const fact = panel.items[0].evidence.find((row) => row.extractionMethod === 'xbrl_parser');
      expect(fact).toMatchObject({ polarity: 'contradicts', polarityMethod: 'numeric_threshold' });
      expect(fact!.deltaVsThreshold).toBeCloseTo(-8.7, 6);
    });

    /**
     * The deferred-revenue defect, end to end. `DeferredRevenueCurrent` in the
     * fixture carries only instants — balances. A duration claim pointed at it
     * must produce no evidence at all, rather than a plausible number that
     * measures a different kind of thing.
     */
    it('refuses a balance-sheet instant offered against a duration claim', async () => {
      const panel = await runWith({ ...XBRL_MEASUREMENT, sourceTags: ['DeferredRevenueCurrent'], unit: 'usd', threshold: 1_000_000 });
      expect(panel.items[0].evidence.filter((row) => row.extractionMethod === 'xbrl_parser')).toHaveLength(0);
      // And the refusal is silent to the job: this is a coverage gap, not a failure.
      expect(panel.items[0].job.status).toBe('succeeded');
      expect(panel.items[0].job.error).toBeNull();
    });

    it('accepts that same instant fact when the claim is genuinely a balance', async () => {
      const panel = await runWith({
        ...XBRL_MEASUREMENT,
        sourceTags: ['DeferredRevenueCurrent'],
        unit: 'usd',
        timeBasis: 'instant',
        operator: 'gte',
        threshold: 1_000_000_000,
      });
      const fact = panel.items[0].evidence.find((row) => row.extractionMethod === 'xbrl_parser');
      expect(fact).toMatchObject({ polarity: 'supports', polarityMethod: 'numeric_threshold' });
    });

    it('stays inconclusive when the reported unit cannot be converted to the claim unit', async () => {
      // GrossProfit is reported in USD; the claim is in percent. Retrieval
      // still happens and the fact is retained with full provenance, but it
      // asserts no comparable magnitude.
      const panel = await runWith({ ...XBRL_MEASUREMENT, sourceTags: ['GrossProfit'] });
      const fact = panel.items[0].evidence.find((row) => row.extractionMethod === 'xbrl_parser');
      expect(fact).toMatchObject({ polarity: 'inconclusive', polarityMethod: 'no_observed_value' });
      expect(fact!.impactSummary).toContain('not commensurable');
    });

    it('makes no XBRL call at all for a market with no structured fact source', async () => {
      // The ID market has no company-concept equivalent. The correct outcome is
      // a named coverage gap, not an error — `research_jobs.status` is untouched.
      const idDraft = {
        ...draft,
        ticker: 'BBRI',
        companyName: 'PT Bank Rakyat Indonesia (Persero) Tbk',
        market: 'ID' as const,
        assumptions: [{ statement: 'BBRI net interest margin (NIM) remains above 6.0%.', status: 'untested' as const, measurement: XBRL_MEASUREMENT }],
      };
      handle.db.update(messages).set({ structuredPayload: JSON.stringify(idDraft) }).where(eq(messages.id, messageId)).run();
      confirmDraft(conversationId, messageId, { db: handle.db });
      const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
      expect(panel.items[0].evidence.filter((row) => row.extractionMethod === 'xbrl_parser')).toHaveLength(0);
      expect(panel.items[0].job.status).toBe('succeeded');
    });

    it('makes no XBRL call when the contract names no source tags', async () => {
      const panel = await runWith({ ...XBRL_MEASUREMENT, sourceTags: [] });
      expect(panel.items[0].evidence.filter((row) => row.extractionMethod === 'xbrl_parser')).toHaveLength(0);
    });

    /**
     * M011 Slice 5, end to end. This is the whole milestone in one assertion:
     * a real filing fact is retrieved, compared against the claim it was
     * retrieved for, found to breach it, and reported as a breach on the panel
     * — rather than retrieved, presented neutrally, and left for the reader to
     * notice.
     */
    it('surfaces a breach on the panel verdict, not merely on the evidence row', async () => {
      const panel = await runWith({ ...XBRL_MEASUREMENT, threshold: 90 });
      expect(panel.verdict?.level).toBe('breached');
      expect(panel.verdict?.headline).toContain('THESIS BREACHED');
      expect(panel.verdict?.headline).toContain('81.3%');
      expect(panel.verdict?.headline).toContain('at least 90%');
      expect(panel.verdict?.contradictions[0]).toMatchObject({ observedValue: 81.3, threshold: 90 });
      expect(panel.coverage).toMatchObject({ totalAssumptions: 1, evidenced: 1, contradicted: 1, confidenceGate: 'open' });
    });

    it('reports the thesis as holding when the same fact clears the claim', async () => {
      const panel = await runWith(XBRL_MEASUREMENT);
      expect(panel.verdict?.level).toBe('holding');
      expect(panel.coverage).toMatchObject({ contradicted: 0, confidenceGate: 'open' });
    });
  });

  // M011 Slice 5. The 0008 backfill gives every pre-M011 assumption a
  // `legacy_unspecified` contract, so an existing thesis reports honestly that
  // it cannot be checked rather than implying it has been.
  it('reports a thesis with no measurement contract as insufficient evidence', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    // Simulate the pre-M011 state the backfill produces.
    handle.db.update(assumptionMeasurements).set({ resolution: 'legacy_unspecified' }).run();

    const panel = await getResearchPanel(conversationId, { db: handle.db });
    expect(panel.coverage).toMatchObject({ unresolvedContracts: 1, confidenceGate: 'suppressed' });
    expect(panel.coverage?.suppressionReasons).toContain('unresolved_contracts');
    expect(panel.verdict?.level).toBe('insufficient_evidence');
    expect(panel.verdict?.headline).toContain('cannot be measured as stated');
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
    const ocrDraft = withMeasurement('BBRI simulate ocr evidence.');
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
    const derivedDraft = withMeasurement('BBRI simulate derived evidence.');
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
    const mismatch = withMeasurement('PLTR gross margin remains above 90% (simulate citation mismatch).');
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
    const twoAssumptions = withMeasurement('PLTR gross margin remains above 80%.', 'PLTR commercial scale supports gross margin.');
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
    const mismatchDraft = withMeasurement('simulate citation mismatch for gross margin.');
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

  // M008 Slices 1 & 3: web-search discovery persistence and automatic
  // fetch-and-classify promotion, wired into the same per-job loop as
  // M007's Class A/B calls, with the same soft-failure discipline.
  describe('M008 web-search discovery + automatic promotion', () => {
    it('persists discovered candidates as pending, without touching evidence, when the domain is not allowlisted', async () => {
      confirmDraft(conversationId, messageId, { db: handle.db });
      const discoveryProvider = {
        providerId: 'stub',
        async search() { return { kind: 'found' as const, value: [{ url: 'https://aggregator.example.com/quote/PLTR' }] }; },
      };

      const panel = await processResearchJobs(conversationId, {
        db: handle.db,
        snapshotDirectory: path.join(directory, 'snapshots'),
        discoveryProvider,
        promotionClients: {},
      });

      expect(panel.items[0].job.status).toBe('succeeded');
      const candidates = handle.db.select().from(discoveryCandidates).all();
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({
        market: 'US', ticker: 'PLTR', candidateUrl: 'https://aggregator.example.com/quote/PLTR',
        status: 'rejected', rejectionReason: 'domain_not_allowlisted', discoveredVia: 'web_search',
      });
    });

    it('never fails or degrades the job when the discovery provider throws', async () => {
      confirmDraft(conversationId, messageId, { db: handle.db });
      const throwingProvider = {
        providerId: 'stub',
        async search(): Promise<never> { throw new Error('discovery boom'); },
      };

      const panel = await processResearchJobs(conversationId, {
        db: handle.db,
        snapshotDirectory: path.join(directory, 'snapshots'),
        discoveryProvider: throwingProvider,
      });

      expect(panel.items[0].job.status).toBe('succeeded');
      expect(panel.items[0].job.error).toBeNull();
      expect(handle.db.select().from(discoveryCandidates).all()).toHaveLength(0);
    });

    it('automatically promotes a discovered candidate into secondary_news evidence when its domain is already allowlisted', async () => {
      confirmDraft(conversationId, messageId, { db: handle.db });
      const discoveryProvider = {
        providerId: 'stub',
        async search() { return { kind: 'found' as const, value: [{ url: 'https://wire.example.com/pltr/margin-update' }] }; },
      };
      const html = '<html><body><p>Palantir reported gross margin of 81.3% in the quarter, remaining above 80%.</p></body></html>';
      const promotionClients = {
        'https://wire.example.com': {
          client: new OfficialHttpClient({
            allowedHosts: ['wire.example.com'],
            userAgent: 'test',
            logPath: path.join(directory, 'outbound.log'),
            fetchImpl: (async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch,
          }),
          sourceClass: 'news' as const,
        },
      };

      const panel = await processResearchJobs(conversationId, {
        db: handle.db,
        snapshotDirectory: path.join(directory, 'snapshots'),
        discoveryProvider,
        promotionClients,
      });

      expect(panel.items[0].job.status).toBe('succeeded');
      expect(handle.db.select().from(discoveryCandidates).get()).toMatchObject({ status: 'fetched' });
      const secondaryNews = handle.db.select().from(evidence).where(eq(evidence.verificationStatus, 'secondary_news')).all();
      expect(secondaryNews.length).toBeGreaterThan(0);
      expect(secondaryNews[0]).toMatchObject({ sourceTier: 'secondary', content: expect.stringContaining('gross margin of 81.3%') });
    });
  });
});
