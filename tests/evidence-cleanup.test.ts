import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptions, conversations, evidence, messages, sourceSnapshots } from '@/db/schema';
import { thesisDraftSchema } from '@/lib/domain/contracts';
import { confirmDraft } from '@/lib/research/service';
import { cleanupBoilerplateEvidence } from '@/lib/research/evidence-cleanup';
import { deriveAssumptionStatusAfterEvidenceRemoval } from '@/lib/research/assumption-status';

/**
 * M010 Slice 4. Cleanup of the low-quality secondary evidence M009 deliberately
 * left in place. The selector re-derives rather than pattern-matching: a row is
 * stale iff the M010-fixed extractor no longer produces its quote from the
 * retained snapshot. These tests pin the safety properties, not just the happy
 * path — a destructive sweep is only trustworthy if what it REFUSES to touch is
 * as well specified as what it deletes.
 */

const draft = thesisDraftSchema.parse({
  ticker: 'TLKM',
  companyName: 'Telkom Indonesia',
  market: 'ID',
  coreBelief: 'I believe TLKM data center revenue grows materially through 2026.',
  // M011. A directional contract: "grows materially" states a direction with
  // no absolute threshold, so `threshold` is null and the operator is
  // `increases` rather than a comparison.
  assumptions: [{
    statement: 'Telkom data center revenue grows materially in 2026.',
    status: 'untested',
    measurement: {
      resolution: 'resolved', metric: 'data center revenue',
      definitionVariant: 'data center segment revenue as reported',
      operator: 'increases', threshold: null, unit: 'idr',
      timeBasis: 'duration_annual', sourceTags: [],
      clarifyingQuestion: null, ambiguityReason: 'none',
    },
  }],
  requiresChallenge: false,
});

const GENUINE_FACT = 'Telkom reported data center revenue of 12.5 trillion rupiah in 2026, up 40% year-over-year.';
const BOILERPLATE = 'Solusi Overview Business Enterprise Wholesale Data Center Solutions Personal Investor Relations Berita Artikel Panduan Logo Sustainability ESG Karir';

describe('M010 boilerplate evidence cleanup', () => {
  let directory: string;
  let handle: DatabaseHandle;
  let assumptionId: string;
  const conversationId = '7a1d9a2a-6b3f-4e2a-9f10-8a2f5b1c9d01';
  const messageId = '7a1d9a2a-6b3f-4e2a-9f10-8a2f5b1c9d02';
  const documentHash = 'hash-tlkm-newsroom';

  function seedSnapshot(hash: string, html: string): string {
    const storagePath = path.join(directory, `${hash}.bin`);
    fs.writeFileSync(storagePath, html);
    handle.db.insert(sourceSnapshots).values({
      documentHash: hash,
      documentId: `doc-${hash}`,
      market: 'ID',
      ticker: 'TLKM',
      sourceUrl: 'https://telkom.test/berita',
      sourceName: 'Issuer press release (TLKM)',
      sourceTier: 'secondary',
      sourceFormat: 'html',
      contentType: 'text/html',
      httpStatus: 200,
      publishDate: null,
      retrievalTimestamp: '2026-07-26T13:40:05.000Z',
      storagePath,
      sourceMode: 'live',
    }).run();
    return storagePath;
  }

  function seedEvidence(overrides: Partial<typeof evidence.$inferInsert> & { id: string; content: string }) {
    handle.db.insert(evidence).values({
      assumptionId,
      sourceFormat: 'html',
      contentKind: 'text',
      sourceVariant: null,
      extractionMethod: 'html_parser',
      verificationStatus: 'secondary_issuer',
      sourceTier: 'secondary',
      sourceName: 'Issuer press release (TLKM)',
      publishDate: null,
      documentHash,
      canonicalTextHash: null,
      boundingBox: null,
      sourceUrl: 'https://telkom.test/berita',
      retrievalTimestamp: '2026-07-26T13:40:05.000Z',
      impactSummary: 'Secondary source; official confirmation remains pending.',
      pageNumber: null,
      interpretationStatus: 'pending',
      metadata: '{}',
      ...overrides,
    }).run();
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-cleanup-'));
    handle = createDatabase(path.join(directory, 'test.sqlite'));
    handle.db.insert(conversations).values({ id: conversationId, title: 'TLKM thesis' }).run();
    handle.db.insert(messages).values({
      id: messageId,
      conversationId,
      role: 'assistant',
      content: 'Review the draft.',
      structuredPayload: JSON.stringify(draft),
      validationOutcome: 'valid',
    }).run();
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    assumptionId = assumption.id;
    seedSnapshot(documentHash, `<html><body><main><p>${GENUINE_FACT}</p><div>${BOILERPLATE}</div></main></body></html>`);
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('deletes a boilerplate row and reverts the assumption, while keeping a genuine one', async () => {
    seedEvidence({ id: 'ev-boilerplate', content: BOILERPLATE });
    seedEvidence({ id: 'ev-genuine', content: GENUINE_FACT });
    handle.db.update(assumptions).set({ status: 'pending_confirmation' }).where(eq(assumptions.id, assumptionId)).run();

    const report = await cleanupBoilerplateEvidence({ db: handle.db, apply: true });

    expect(report.stale).toBe(1);
    expect(report.kept).toBe(1);
    expect(report.rows.find((row) => row.evidenceId === 'ev-boilerplate')?.outcome).toBe('stale');
    expect(report.rows.find((row) => row.evidenceId === 'ev-genuine')?.outcome).toBe('kept');

    const remaining = handle.db.select({ id: evidence.id }).from(evidence).all().map((row) => row.id);
    expect(remaining).toEqual(['ev-genuine']);
    // A genuine row survives, so the confirmation gate still has something to
    // stand on and the assumption must NOT be reverted.
    expect(handle.db.select({ status: assumptions.status }).from(assumptions).where(eq(assumptions.id, assumptionId)).get()?.status)
      .toBe('pending_confirmation');
  });

  it('reverts the assumption to untested when its last secondary evidence is removed', async () => {
    seedEvidence({ id: 'ev-boilerplate', content: BOILERPLATE });
    handle.db.update(assumptions).set({ status: 'pending_confirmation' }).where(eq(assumptions.id, assumptionId)).run();

    const report = await cleanupBoilerplateEvidence({ db: handle.db, apply: true });

    expect(report.stale).toBe(1);
    expect(handle.db.select({ status: assumptions.status }).from(assumptions).where(eq(assumptions.id, assumptionId)).get()?.status)
      .toBe('untested');
    expect(report.assumptions[0]).toMatchObject({ previousStatus: 'pending_confirmation', nextStatus: 'untested' });
  });

  it('never touches official-tier evidence, even when it would not re-extract', async () => {
    // The hard filter, not a re-extraction outcome: this row's content is pure
    // boilerplate and would never survive re-extraction, yet it is out of scope
    // because the official trust tier is not this sweep's business.
    seedEvidence({
      id: 'ev-official',
      content: BOILERPLATE,
      verificationStatus: 'exact_verified',
      sourceTier: 'official',
      canonicalTextHash: 'hash-canonical',
    });

    const report = await cleanupBoilerplateEvidence({ db: handle.db, apply: true });

    expect(report.scanned).toBe(0);
    expect(handle.db.select({ id: evidence.id }).from(evidence).all()).toHaveLength(1);
  });

  it('leaves a row alone once its interpretation is no longer pending', async () => {
    // A non-pending interpretation ('deterministic' or 'model') means a
    // judgement has already been recorded against this row; deleting it would
    // destroy that judgement silently.
    seedEvidence({ id: 'ev-reviewed', content: BOILERPLATE, interpretationStatus: 'deterministic' });

    const report = await cleanupBoilerplateEvidence({ db: handle.db, apply: true });

    expect(report.scanned).toBe(0);
    expect(handle.db.select({ id: evidence.id }).from(evidence).all()).toHaveLength(1);
  });

  it('reports a row whose snapshot is missing as unresolvable and never deletes it', async () => {
    seedEvidence({ id: 'ev-orphan', content: BOILERPLATE, documentHash: 'hash-absent' });

    const report = await cleanupBoilerplateEvidence({ db: handle.db, apply: true });

    expect(report.unresolvable).toBe(1);
    expect(report.stale).toBe(0);
    expect(report.rows[0]).toMatchObject({ evidenceId: 'ev-orphan', outcome: 'unresolvable' });
    expect(handle.db.select({ id: evidence.id }).from(evidence).all()).toHaveLength(1);
  });

  it('mutates nothing on a dry run but reports the identical outcome', async () => {
    seedEvidence({ id: 'ev-boilerplate', content: BOILERPLATE });
    handle.db.update(assumptions).set({ status: 'pending_confirmation' }).where(eq(assumptions.id, assumptionId)).run();

    const dry = await cleanupBoilerplateEvidence({ db: handle.db, apply: false });

    expect(dry.applied).toBe(false);
    expect(dry.stale).toBe(1);
    expect(dry.assumptions[0]).toMatchObject({ previousStatus: 'pending_confirmation', nextStatus: 'untested' });
    expect(handle.db.select({ id: evidence.id }).from(evidence).all()).toHaveLength(1);
    expect(handle.db.select({ status: assumptions.status }).from(assumptions).where(eq(assumptions.id, assumptionId)).get()?.status)
      .toBe('pending_confirmation');
  });

  it('is idempotent: a second apply run finds nothing left to do', async () => {
    seedEvidence({ id: 'ev-boilerplate', content: BOILERPLATE });

    await cleanupBoilerplateEvidence({ db: handle.db, apply: true });
    const second = await cleanupBoilerplateEvidence({ db: handle.db, apply: true });

    expect(second.stale).toBe(0);
    expect(second.scanned).toBe(0);
  });

  it('flags a user-confirmed assumption for manual review instead of silently reverting it', async () => {
    seedEvidence({ id: 'ev-boilerplate', content: BOILERPLATE });
    handle.db.update(assumptions).set({ status: 'user_confirmed_secondary' }).where(eq(assumptions.id, assumptionId)).run();

    const report = await cleanupBoilerplateEvidence({ db: handle.db, apply: true });

    expect(report.assumptions[0]).toMatchObject({ needsManualReview: true, nextStatus: null });
    // The explicit human decision survives the sweep untouched.
    expect(handle.db.select({ status: assumptions.status }).from(assumptions).where(eq(assumptions.id, assumptionId)).get()?.status)
      .toBe('user_confirmed_secondary');
  });
});

describe('deriveAssumptionStatusAfterEvidenceRemoval', () => {
  it('reverts a pending assumption that has lost all support', () => {
    expect(deriveAssumptionStatusAfterEvidenceRemoval({
      currentStatus: 'pending_confirmation',
      hasRemainingSecondaryEvidence: false,
      hasOfficialEvidence: false,
    })).toBe('untested');
  });

  it('leaves a pending assumption alone while any support remains', () => {
    expect(deriveAssumptionStatusAfterEvidenceRemoval({
      currentStatus: 'pending_confirmation',
      hasRemainingSecondaryEvidence: true,
      hasOfficialEvidence: false,
    })).toBeNull();
    expect(deriveAssumptionStatusAfterEvidenceRemoval({
      currentStatus: 'pending_confirmation',
      hasRemainingSecondaryEvidence: false,
      hasOfficialEvidence: true,
    })).toBeNull();
  });

  it('never auto-changes an explicit user confirmation', () => {
    expect(deriveAssumptionStatusAfterEvidenceRemoval({
      currentStatus: 'user_confirmed_secondary',
      hasRemainingSecondaryEvidence: false,
      hasOfficialEvidence: false,
    })).toBe('needs_manual_review');
  });

  it('does not touch statuses outside the confirmation gate', () => {
    for (const status of ['untested', 'verified', 'challenged', 'held-belief'] as const) {
      expect(deriveAssumptionStatusAfterEvidenceRemoval({
        currentStatus: status,
        hasRemainingSecondaryEvidence: false,
        hasOfficialEvidence: false,
      })).toBeNull();
    }
  });
});
