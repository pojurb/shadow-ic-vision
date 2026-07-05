import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import {
  assumptions,
  conversations,
  decisions,
  evidence,
  messages,
  theses,
} from '@/db/schema';
import { thesisDraftSchema, thesisExportSchema } from '@/lib/domain/contracts';
import {
  confirmDraft,
  recordDecision,
  exportThesisData,
  importThesisData,
  getResearchPanel,
  generateDecisionRecommendation,
} from '@/lib/research/service';

const draft = thesisDraftSchema.parse({
  ticker: 'PLTR',
  companyName: 'Palantir Technologies Inc.',
  market: 'US',
  coreBelief: 'I believe PLTR gross margin will remain above 80%.',
  assumptions: [{ statement: 'PLTR gross margin remains above 80%.', status: 'untested' }],
  requiresChallenge: false,
});

describe('Decision Library & Import/Export persistence', () => {
  let directory: string;
  let handle: DatabaseHandle;
  const conversationId = '77d80b7f-4d57-46ab-9341-f972b6ecf5f3';
  const messageId = '79f651e7-77ab-4745-84f9-d20b7efef6e3';

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-decisions-'));
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

  it('records decisions and displays them in getResearchPanel', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });

    const dec1 = await recordDecision(thesisId, 'Investigate Further', 'Buy', 'Needs more 10-Q checks', { db: handle.db });
    expect(dec1.outcome).toBe('Investigate Further');
    expect(dec1.optionalAction).toBe('Buy');
    expect(dec1.userReasoning).toBe('Needs more 10-Q checks');

    const panel = await getResearchPanel(conversationId, { db: handle.db });
    expect(panel.decisions).toHaveLength(1);
    expect(panel.decisions[0]).toMatchObject({
      outcome: 'Investigate Further',
      optionalAction: 'Buy',
      userReasoning: 'Needs more 10-Q checks',
    });

    await recordDecision(thesisId, 'Archive', null, 'Closing thesis loop', { db: handle.db });
    const panel2 = await getResearchPanel(conversationId, { db: handle.db });
    expect(panel2.decisions).toHaveLength(2);
    expect(panel2.decisions[1]).toMatchObject({
      outcome: 'Archive',
      optionalAction: null,
      userReasoning: 'Closing thesis loop',
    });
  });

  it('exports and imports thesis packages completely', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });

    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get();
    expect(assumption).toBeDefined();

    handle.db.insert(evidence).values({
      id: 'evidence-1',
      assumptionId: assumption!.id,
      sourceFormat: 'html',
      contentKind: 'text',
      extractionMethod: 'html_parser',
      verificationStatus: 'exact_verified',
      sourceTier: 'official',
      sourceName: 'SEC Edgar',
      publishDate: '2026-05-01',
      documentHash: 'dochash123',
      sourceUrl: 'https://sec.gov/filing',
      retrievalTimestamp: new Date().toISOString(),
      content: 'gross margin of 81.3%',
      impactSummary: 'Supports target margin',
      interpretationStatus: 'pending',
    }).run();

    await recordDecision(thesisId, 'Update Thesis', 'Hold', 'Holding due to current valuation', { db: handle.db });

    const exportPayload = await exportThesisData(thesisId, { db: handle.db });
    const parsed = thesisExportSchema.safeParse(exportPayload);
    expect(parsed.success).toBe(true);
    expect(exportPayload.thesis.ticker).toBe('PLTR');
    expect(exportPayload.assumptions[0].evidence).toHaveLength(1);
    expect(exportPayload.decisions).toHaveLength(1);

    const importResult = await importThesisData(exportPayload, { db: handle.db });
    expect(importResult.conversationId).toBeDefined();
    expect(importResult.thesisId).toBeDefined();

    const importedThesis = handle.db.select().from(theses).where(eq(theses.id, importResult.thesisId)).get();
    expect(importedThesis).toBeDefined();
    expect(importedThesis!.ticker).toBe('PLTR');
    expect(importedThesis!.status).toBe('active');

    const importedAssumptions = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, importResult.thesisId)).all();
    expect(importedAssumptions).toHaveLength(1);

    const importedEvidence = handle.db.select().from(evidence).where(eq(evidence.assumptionId, importedAssumptions[0].id)).all();
    expect(importedEvidence).toHaveLength(1);
    expect(importedEvidence[0].content).toBe('gross margin of 81.3%');

    const importedDecisions = handle.db.select().from(decisions).where(eq(decisions.thesisId, importResult.thesisId)).all();
    expect(importedDecisions).toHaveLength(1);
    expect(importedDecisions[0].decision).toBe('Update Thesis: Hold');
    expect(importedDecisions[0].rationale).toBe('Holding due to current valuation');
  });

  it('cascades deletion of decisions when a thesis is deleted', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    await recordDecision(thesisId, 'Archive', null, 'Cascade test reasoning', { db: handle.db });

    expect(handle.db.select().from(decisions).all()).toHaveLength(1);

    handle.db.delete(theses).where(eq(theses.id, thesisId)).run();

    expect(handle.db.select().from(decisions).all()).toHaveLength(0);
  });

  it('generates decision recommendations from the LLM evaluator', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const rec = await generateDecisionRecommendation(thesisId, { db: handle.db });
    expect(rec.recommendedOutcome).toBe('Investigate Further');
    expect(rec.recommendedAction).toBe('Buy');
    expect(rec.rationale).toContain('Palantir gross margin');
  });
});
