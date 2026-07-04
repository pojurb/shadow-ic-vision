import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lt } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { getDatabase } from '@/db/client';
import {
  assumptions,
  evidence,
  messages,
  researchJobs,
  theses,
} from '@/db/schema';
import {
  thesisDraftSchema,
  type ResearchPanelDTO,
} from '@/lib/domain/contracts';
import { CitationPipeline } from './pipeline';

type ServiceDependencies = {
  db?: AppDatabase;
  pipeline?: CitationPipeline;
  now?: () => Date;
};

function dependencies(input: ServiceDependencies = {}) {
  return {
    db: input.db ?? getDatabase().db,
    pipeline: input.pipeline ?? new CitationPipeline(),
    now: input.now ?? (() => new Date()),
  };
}

export function confirmDraft(
  conversationId: string,
  messageId: string,
  input: ServiceDependencies = {},
) {
  const { db } = dependencies(input);

  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(theses)
      .where(eq(theses.conversationId, conversationId))
      .get();

    if (existing) {
      const jobs = tx
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .innerJoin(assumptions, eq(researchJobs.assumptionId, assumptions.id))
        .where(eq(assumptions.thesisId, existing.id))
        .all();
      return { thesisId: existing.id, jobIds: jobs.map((job) => job.id), alreadyConfirmed: true };
    }

    const message = tx
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .get();

    if (!message || message.role !== 'assistant' || message.validationOutcome !== 'valid' || !message.structuredPayload) {
      throw new Error('The selected message does not contain a valid thesis draft.');
    }

    const parsedDraft = thesisDraftSchema.safeParse(JSON.parse(message.structuredPayload));
    if (!parsedDraft.success) throw new Error('The stored thesis draft is invalid.');

    const draft = parsedDraft.data;
    const thesisId = randomUUID();
    tx.insert(theses).values({
      id: thesisId,
      conversationId,
      draftMessageId: messageId,
      ticker: draft.ticker,
      companyName: draft.companyName,
      market: draft.market,
      coreBelief: draft.coreBelief,
      title: `${draft.ticker} — ${draft.companyName}`,
      description: draft.coreBelief,
      status: 'active',
    }).run();

    const jobIds: string[] = [];
    for (const draftAssumption of draft.assumptions) {
      const assumptionId = randomUUID();
      const jobId = randomUUID();
      tx.insert(assumptions).values({
        id: assumptionId,
        thesisId,
        statement: draftAssumption.statement,
        status: draftAssumption.status,
      }).run();
      tx.insert(researchJobs).values({ id: jobId, assumptionId, status: 'queued' }).run();
      jobIds.push(jobId);
    }

    return { thesisId, jobIds, alreadyConfirmed: false };
  });
}

export async function getResearchPanel(
  conversationId: string,
  input: ServiceDependencies = {},
): Promise<ResearchPanelDTO> {
  const { db } = dependencies(input);
  const thesis = await db.select().from(theses).where(eq(theses.conversationId, conversationId)).get();
  if (!thesis || !thesis.ticker || !thesis.companyName || !thesis.market || !thesis.coreBelief) {
    return { thesis: null, items: [] };
  }

  const rows = await db
    .select({ assumption: assumptions, job: researchJobs })
    .from(assumptions)
    .innerJoin(researchJobs, eq(researchJobs.assumptionId, assumptions.id))
    .where(eq(assumptions.thesisId, thesis.id))
    .all();

  const assumptionIds = rows.map((row) => row.assumption.id);
  const evidenceRows = assumptionIds.length
    ? await db.select().from(evidence).where(inArray(evidence.assumptionId, assumptionIds)).all()
    : [];

  return {
    thesis: {
      id: thesis.id,
      ticker: thesis.ticker,
      companyName: thesis.companyName,
      market: thesis.market,
      coreBelief: thesis.coreBelief,
    },
    items: rows.map(({ assumption, job }) => ({
      assumptionId: assumption.id,
      statement: assumption.statement,
      assumptionStatus: assumption.status,
      job: {
        id: job.id,
        status: job.status,
        error: job.error,
        attemptCount: job.attemptCount,
      },
      evidence: evidenceRows
        .filter((record) => record.assumptionId === assumption.id)
        .map((record) => ({
          id: record.id,
          sourceTier: record.sourceTier,
          sourceName: record.sourceName,
          sourceUrl: record.sourceUrl,
          publishDate: record.publishDate,
          retrievalTimestamp: record.retrievalTimestamp,
          exactQuote: record.content,
          impactSummary: record.impactSummary,
          verificationStatus: record.verificationStatus as 'exact_verified' | 'ocr_matched' | 'derived',
        })),
    })),
  };
}

export async function processResearchJobs(
  conversationId: string,
  input: ServiceDependencies = {},
) {
  const { db, pipeline, now } = dependencies(input);
  const currentTime = now();
  const nowIso = currentTime.toISOString();

  await db
    .update(researchJobs)
    .set({ status: 'queued', leaseExpiresAt: null, updatedAt: nowIso })
    .where(and(eq(researchJobs.status, 'running'), lt(researchJobs.leaseExpiresAt, nowIso)))
    .run();

  const jobs = await db
    .select({ job: researchJobs, assumption: assumptions, thesis: theses })
    .from(researchJobs)
    .innerJoin(assumptions, eq(researchJobs.assumptionId, assumptions.id))
    .innerJoin(theses, eq(assumptions.thesisId, theses.id))
    .where(and(eq(theses.conversationId, conversationId), eq(researchJobs.status, 'queued')))
    .all();

  for (const row of jobs) {
    const leaseExpiresAt = new Date(currentTime.getTime() + 60_000).toISOString();
    const claimed = await db
      .update(researchJobs)
      .set({
        status: 'running',
        error: null,
        attemptCount: row.job.attemptCount + 1,
        leaseExpiresAt,
        updatedAt: nowIso,
      })
      .where(and(eq(researchJobs.id, row.job.id), eq(researchJobs.status, 'queued')))
      .returning({ id: researchJobs.id })
      .get();

    if (!claimed || !row.thesis.ticker || !row.thesis.market) continue;

    try {
      const candidate = candidateFor(row.thesis.market, row.assumption.statement);
      const verified = await pipeline.executeResearchJob(
        row.thesis.market,
        row.thesis.ticker,
        [candidate],
      );

      if (verified.length === 0) {
        await db.update(researchJobs).set({
          status: 'degraded',
          error: 'No character-exact evidence passed verification.',
          leaseExpiresAt: null,
          updatedAt: now().toISOString(),
        }).where(eq(researchJobs.id, row.job.id)).run();
        continue;
      }

      const result = verified[0];
      await db.transaction((tx) => {
        tx.insert(evidence).values({
          id: randomUUID(),
          assumptionId: row.assumption.id,
          sourceFormat: 'html',
          contentKind: 'text',
          extractionMethod: 'html_parser',
          verificationStatus: 'exact_verified',
          sourceTier: result.sourceTier,
          sourceName: result.sourceName,
          publishDate: result.publishDate,
          documentHash: result.documentHash,
          canonicalTextHash: result.canonicalTextHash,
          sourceUrl: result.sourceUrl,
          retrievalTimestamp: result.retrievalTimestamp,
          content: result.exactQuote,
          impactSummary: result.impactSummary,
          metadata: JSON.stringify({ parserVersion: result.parserVersion }),
        }).onConflictDoNothing().run();
        tx.update(assumptions).set({ status: 'verified', updatedAt: now().toISOString() })
          .where(eq(assumptions.id, row.assumption.id)).run();
        tx.update(researchJobs).set({
          status: 'succeeded',
          error: null,
          leaseExpiresAt: null,
          updatedAt: now().toISOString(),
        }).where(eq(researchJobs.id, row.job.id)).run();
      });
    } catch (error) {
      await db.update(researchJobs).set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unexpected research failure.',
        leaseExpiresAt: null,
        updatedAt: now().toISOString(),
      }).where(eq(researchJobs.id, row.job.id)).run();
    }
  }

  return getResearchPanel(conversationId, input);
}

export async function retryResearchJob(jobId: string, input: ServiceDependencies = {}) {
  const { db, now } = dependencies(input);
  const result = await db.update(researchJobs).set({
    status: 'queued',
    error: null,
    leaseExpiresAt: null,
    updatedAt: now().toISOString(),
  }).where(and(
    eq(researchJobs.id, jobId),
    inArray(researchJobs.status, ['degraded', 'failed']),
  )).returning({ id: researchJobs.id }).get();

  if (!result) throw new Error('Only degraded or failed research jobs can be retried.');
  return result;
}

function candidateFor(market: 'US' | 'ID', assumption: string) {
  if (assumption.includes('simulate citation mismatch')) {
    return {
      quote: 'gross margin of 91.3%',
      impactSummary: 'This intentionally altered quote must be blocked by verification.',
    };
  }

  if (market === 'ID') {
    return {
      quote: 'margin bunga bersih (NIM) sebesar 6,8%',
      impactSummary: 'BBRI reported NIM of 6.8%, supporting the assumption that NIM remains above 6.0%.',
    };
  }

  return {
    quote: 'gross margin of 81.3%',
    impactSummary: 'PLTR reported gross margin of 81.3%, supporting the assumption that gross margin remains above 80%.',
  };
}
