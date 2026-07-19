import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { getDatabase } from '@/db/client';
import {
  assumptions,
  conversations,
  decisions,
  evidence,
  messages,
  researchJobs,
  sourceSnapshots,
  theses,
} from '@/db/schema';
import {
  thesisDraftSchema,
  type ThesisDraft,
  type ResearchPanelDTO,
  type DecisionOutcome,
  type DecisionAction,
  type DecisionDTO,
  type ThesisExport,
  decisionRecommendationSchema,
  type DecisionRecommendation,
} from '@/lib/domain/contracts';
import { getLLMProvider } from '@/lib/ai/factory';
import type { ProjectMessage } from '@/lib/ai/provider';
import { CitationPipeline } from './pipeline';
import { createDerivedCandidate, createOcrCandidate, type EvidenceCandidate } from './extractors/candidate';
import { getSnapshotDirectory } from './config';
import { isDegradedSourceError, ResearchSourceError } from './errors';
import { persistSourceSnapshot } from './snapshot-store';

type ServiceDependencies = {
  db?: AppDatabase;
  pipeline?: CitationPipeline;
  now?: () => Date;
  snapshotDirectory?: string;
  llmModelId?: string | null;
};

function dependencies(input: ServiceDependencies = {}) {
  return {
    db: input.db ?? getDatabase().db,
    pipeline: input.pipeline ?? new CitationPipeline(),
    now: input.now ?? (() => new Date()),
    snapshotDirectory: input.snapshotDirectory ?? getSnapshotDirectory(),
  };
}

export function confirmDraft(
  conversationId: string,
  messageId: string,
  input: ServiceDependencies = {},
) {
  const { db, pipeline } = dependencies(input);

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

    const parsedJSON = JSON.parse(message.structuredPayload);
    let draft: ThesisDraft | null = null;
    if (parsedJSON && parsedJSON.type === 'thesis_draft' && parsedJSON.thesisDraft) {
      const parsedDraft = thesisDraftSchema.safeParse(parsedJSON.thesisDraft);
      if (parsedDraft.success) draft = parsedDraft.data;
    } else {
      const parsedDraft = thesisDraftSchema.safeParse(parsedJSON);
      if (parsedDraft.success) draft = parsedDraft.data;
    }

    if (!draft) throw new Error('The stored thesis draft is invalid.');
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
      tx.insert(researchJobs).values({
        id: jobId,
        assumptionId,
        status: 'queued',
        sourceMode: pipeline.sourceMode,
      }).run();
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
    return { thesis: null, items: [], decisions: [] };
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

  const decisionRows = await db
    .select()
    .from(decisions)
    .where(eq(decisions.thesisId, thesis.id))
    .orderBy(asc(decisions.createdAt))
    .all();

  let previousAction: DecisionAction | undefined;
  const mappedDecisions: DecisionDTO[] = decisionRows.map((row) => {
    const mapped: DecisionDTO = {
      id: row.id,
      outcome: row.outcome as DecisionOutcome,
      optionalAction: row.action as DecisionAction,
      userReasoning: row.rationale,
      timestamp: row.createdAt,
      previousAction,
    };
    previousAction = row.action as DecisionAction;
    return mapped;
  });

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
        errorCode: job.errorCode,
        attemptCount: job.attemptCount,
        sourceMode: job.sourceMode,
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
          sourceFormat: record.sourceFormat as 'html' | 'pdf' | 'image' | 'xbrl',
          sourceVariant: record.sourceVariant,
          contentKind: record.contentKind as 'text' | 'table' | 'chart' | 'screenshot' | 'structured_fact',
          extractionMethod: record.extractionMethod,
          pageNumber: record.pageNumber,
          boundingBox: record.boundingBox,
          interpretationStatus: record.interpretationStatus,
          metadata: record.metadata,
        })),
    })),
    decisions: mappedDecisions,
  };
}

export async function processResearchJobs(
  conversationId: string,
  input: ServiceDependencies = {},
) {
  const { db, pipeline, now, snapshotDirectory } = dependencies(input);
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
        errorCode: null,
        sourceMode: pipeline.sourceMode,
        attemptCount: row.job.attemptCount + 1,
        leaseExpiresAt,
        updatedAt: nowIso,
      })
      .where(and(eq(researchJobs.id, row.job.id), eq(researchJobs.status, 'queued')))
      .returning({ id: researchJobs.id })
      .get();

    if (!claimed || !row.thesis.ticker || !row.thesis.market) continue;

    try {
      const candidateOverrides = pipeline.sourceMode === 'mock'
        ? [candidateFor(row.thesis.market, row.assumption.statement)]
        : undefined;
      const execution = await pipeline.executeResearchJob(
        row.thesis.market,
        row.thesis.ticker,
        row.assumption.statement,
        candidateOverrides,
        row.job.attemptCount > 0
          ? new Set(db.select({ documentId: sourceSnapshots.documentId }).from(sourceSnapshots).where(and(
              eq(sourceSnapshots.market, row.thesis.market), eq(sourceSnapshots.ticker, row.thesis.ticker),
            )).all().map((item) => item.documentId))
          : undefined,
      );

      if (execution.unchanged) {
        await db.update(researchJobs).set({ status: 'succeeded', error: null, errorCode: null, leaseExpiresAt: null, updatedAt: now().toISOString() }).where(eq(researchJobs.id, row.job.id)).run();
        continue;
      }

      if (execution.evidence.length === 0) {
        persistSourceSnapshot({
          db,
          jobId: row.job.id,
          snapshot: execution.snapshot,
          documentHash: execution.documentHash,
          sourceMode: pipeline.sourceMode,
          snapshotDirectory,
          outcome: 'rejected',
          errorCode: 'citation_not_found',
        });
        await db.update(researchJobs).set({
          status: 'degraded',
          error: 'No evidence candidate passed the applicable verification gate.',
          errorCode: 'citation_not_found',
          leaseExpiresAt: null,
          updatedAt: now().toISOString(),
        }).where(eq(researchJobs.id, row.job.id)).run();
        continue;
      }

      persistSourceSnapshot({
        db,
        jobId: row.job.id,
        snapshot: execution.snapshot,
        documentHash: execution.documentHash,
        sourceMode: pipeline.sourceMode,
        snapshotDirectory,
        outcome: 'verified',
      });
      await db.transaction((tx) => {
        for (const result of execution.evidence) {
          const duplicate = tx.select({ id: evidence.id }).from(evidence).where(and(
            eq(evidence.assumptionId, row.assumption.id),
            eq(evidence.documentHash, result.documentHash),
            eq(evidence.content, result.exactQuote),
          )).get();
          if (duplicate) continue;
          tx.insert(evidence).values({
            id: randomUUID(),
            assumptionId: row.assumption.id,
            sourceFormat: result.sourceFormat,
            contentKind: result.contentKind,
            sourceVariant: result.sourceVariant,
            extractionMethod: result.extractionMethod,
            verificationStatus: result.verificationStatus,
            sourceTier: result.sourceTier,
            sourceName: result.sourceName,
            publishDate: result.publishDate,
            documentHash: result.documentHash,
            canonicalTextHash: result.canonicalTextHash,
            boundingBox: result.boundingBox ? JSON.stringify(result.boundingBox) : null,
            sourceUrl: result.sourceUrl,
            retrievalTimestamp: result.retrievalTimestamp,
            content: result.exactQuote,
            impactSummary: result.impactSummary,
            pageNumber: result.pageNumber,
            interpretationStatus: 'pending',
            metadata: JSON.stringify(result.metadata),
          }).run();
        }
        tx.update(researchJobs).set({
          status: 'succeeded',
          error: null,
          errorCode: null,
          leaseExpiresAt: null,
          updatedAt: now().toISOString(),
        }).where(eq(researchJobs.id, row.job.id)).run();
      });
    } catch (error) {
      const errorCode = error instanceof ResearchSourceError ? error.code : 'source_http_error';
      if (error instanceof ResearchSourceError && error.context) {
        persistSourceSnapshot({
          db,
          jobId: row.job.id,
          snapshot: error.context.snapshot,
          documentHash: error.context.documentHash,
          sourceMode: pipeline.sourceMode,
          snapshotDirectory,
          outcome: 'rejected',
          errorCode,
        });
      }
      await db.update(researchJobs).set({
        status: isDegradedSourceError(error) ? 'degraded' : 'failed',
        error: error instanceof Error ? error.message : 'Unexpected research failure.',
        errorCode,
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
    errorCode: null,
    leaseExpiresAt: null,
    updatedAt: now().toISOString(),
  }).where(and(
    eq(researchJobs.id, jobId),
    inArray(researchJobs.status, ['degraded', 'failed']),
  )).returning({ id: researchJobs.id }).get();

  if (!result) throw new Error('Only degraded or failed research jobs can be retried.');
  return result;
}

function candidateFor(market: 'US' | 'ID', assumption: string): EvidenceCandidate {
  if (assumption.includes('simulate citation mismatch')) {
    return {
      quote: 'gross margin of 91.3%',
      impactSummary: 'This intentionally altered quote must be blocked by verification.',
      verificationStatus: 'exact_verified',
      contentKind: 'text',
      pageNumber: null,
    };
  }

  if (assumption.includes('simulate ocr evidence')) {
    return createOcrCandidate({
      quote: 'Pendapatan bersih meningkat 12,4%',
      ocrText: 'Pendapatan bersih meningkat 12,4% dibandingkan periode yang sama tahun lalu.',
      impactSummary: 'OCR matched a retained Indonesian-language source string. Treat it as OCR evidence, not source-exact text.',
      pageNumber: 1,
      boundingBox: [0.1, 0.2, 0.8, 0.3],
    });
  }

  if (assumption.includes('simulate derived evidence')) {
    return createDerivedCandidate({
      content: 'Rp 9,2 triliun',
      impactSummary: 'Derived table value retained with units and source inputs.',
      pageNumber: 3,
      contentKind: 'table',
      extractionMethod: 'table_parser',
      method: 'table_cell_lookup',
      inputs: { row: 'Pendapatan', column: '2026', rawValue: '9,2', unit: 'Rp triliun' },
      units: 'Rp triliun',
      boundingBox: [0.1, 0.2, 0.9, 0.7],
    });
  }

  if (market === 'ID') {
    return {
      quote: 'margin bunga bersih (NIM) sebesar 6,8%',
      impactSummary: 'BBRI reported NIM of 6.8%, supporting the assumption that NIM remains above 6.0%.',
      verificationStatus: 'exact_verified',
      contentKind: 'text',
      pageNumber: null,
    };
  }

  return {
    quote: 'gross margin of 81.3%',
    impactSummary: 'PLTR reported gross margin of 81.3%, supporting the assumption that gross margin remains above 80%.',
    verificationStatus: 'exact_verified',
    contentKind: 'text',
    pageNumber: null,
  };
}

export async function recordDecision(
  thesisId: string,
  outcome: DecisionOutcome,
  optionalAction: DecisionAction,
  userReasoning: string,
  input: ServiceDependencies = {},
) {
  const { db, now } = dependencies(input);
  const decisionId = randomUUID();
  const createdAt = now().toISOString();

  await db.insert(decisions).values({
    id: decisionId,
    thesisId,
    outcome,
    action: optionalAction,
    rationale: userReasoning,
    createdAt,
  }).run();

  return { id: decisionId, outcome, optionalAction, userReasoning, timestamp: createdAt };
}

export async function exportThesisData(
  thesisId: string,
  input: ServiceDependencies = {},
): Promise<ThesisExport> {
  const { db } = dependencies(input);
  const thesis = await db.select().from(theses).where(eq(theses.id, thesisId)).get();
  if (!thesis) throw new Error('Thesis not found.');

  const assumptionRows = await db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).all();
  const assumptionIds = assumptionRows.map((a) => a.id);

  const evidenceRows = assumptionIds.length
    ? await db.select().from(evidence).where(inArray(evidence.assumptionId, assumptionIds)).all()
    : [];

  const decisionRows = await db
    .select()
    .from(decisions)
    .where(eq(decisions.thesisId, thesisId))
    .orderBy(asc(decisions.createdAt))
    .all();

  const exportedAssumptions = assumptionRows.map((a) => {
    const aEvidence = evidenceRows
      .filter((e) => e.assumptionId === a.id)
      .map((e) => ({
        sourceTier: e.sourceTier,
        sourceName: e.sourceName,
        sourceUrl: e.sourceUrl,
        publishDate: e.publishDate,
        retrievalTimestamp: e.retrievalTimestamp,
        exactQuote: e.content,
        impactSummary: e.impactSummary,
        verificationStatus: e.verificationStatus as 'exact_verified' | 'ocr_matched' | 'derived',
        sourceFormat: e.sourceFormat as 'html' | 'pdf' | 'image' | 'xbrl',
        sourceVariant: e.sourceVariant,
        contentKind: e.contentKind as 'text' | 'table' | 'chart' | 'screenshot' | 'structured_fact',
        extractionMethod: e.extractionMethod,
        pageNumber: e.pageNumber,
        boundingBox: e.boundingBox,
        interpretationStatus: e.interpretationStatus as 'pending' | 'deterministic' | 'model',
        metadata: e.metadata,
        documentHash: e.documentHash,
        canonicalTextHash: e.canonicalTextHash,
      }));

    return {
      statement: a.statement,
      status: a.status,
      createdAt: a.createdAt,
      evidence: aEvidence,
    };
  });

  const exportedDecisions = decisionRows.map((row) => ({
    outcome: row.outcome as DecisionOutcome,
    optionalAction: row.action as DecisionAction,
    userReasoning: row.rationale,
    timestamp: row.createdAt,
  }));

  return {
    version: 1,
    thesis: {
      ticker: thesis.ticker ?? '',
      companyName: thesis.companyName ?? '',
      market: thesis.market as 'US' | 'ID',
      coreBelief: thesis.coreBelief ?? '',
      title: thesis.title,
      description: thesis.description,
      status: thesis.status as 'active' | 'archived',
      createdAt: thesis.createdAt,
    },
    assumptions: exportedAssumptions,
    decisions: exportedDecisions,
  };
}

export async function importThesisData(
  exportData: ThesisExport,
  input: ServiceDependencies = {},
) {
  const { db, now } = dependencies(input);
  const { thesis: importedThesis, assumptions: importedAssumptions, decisions: importedDecisions } = exportData;

  const conversationId = randomUUID();
  const draftMessageId = randomUUID();
  const thesisId = randomUUID();

  return db.transaction((tx) => {
    tx.insert(conversations).values({
      id: conversationId,
      title: `Imported: ${importedThesis.ticker} — ${importedThesis.companyName}`,
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
    }).run();

    const draftPayload = {
      ticker: importedThesis.ticker,
      companyName: importedThesis.companyName,
      market: importedThesis.market,
      coreBelief: importedThesis.coreBelief,
      assumptions: importedAssumptions.map(a => ({ statement: a.statement, status: a.status })),
      requiresChallenge: false
    };

    tx.insert(messages).values({
      id: draftMessageId,
      conversationId,
      role: 'assistant',
      content: 'Imported thesis package.',
      structuredPayload: JSON.stringify(draftPayload),
      validationOutcome: 'valid',
      createdAt: importedThesis.createdAt,
    }).run();

    tx.insert(theses).values({
      id: thesisId,
      conversationId,
      draftMessageId,
      ticker: importedThesis.ticker,
      companyName: importedThesis.companyName,
      market: importedThesis.market,
      coreBelief: importedThesis.coreBelief,
      title: importedThesis.title,
      description: importedThesis.description,
      status: importedThesis.status,
      createdAt: importedThesis.createdAt,
      updatedAt: now().toISOString(),
    }).run();

    for (const a of importedAssumptions) {
      const assumptionId = randomUUID();
      tx.insert(assumptions).values({
        id: assumptionId,
        thesisId,
        statement: a.statement,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: now().toISOString(),
      }).run();

      tx.insert(researchJobs).values({
        id: randomUUID(),
        assumptionId,
        status: 'succeeded',
        sourceMode: 'mock',
        updatedAt: now().toISOString(),
      }).run();

      for (const e of a.evidence) {
        tx.insert(evidence).values({
          id: randomUUID(),
          assumptionId,
          sourceFormat: e.sourceFormat,
          contentKind: e.contentKind ?? 'text',
          sourceVariant: e.sourceVariant ?? null,
          extractionMethod: e.extractionMethod,
          verificationStatus: e.verificationStatus,
          sourceTier: e.sourceTier,
          sourceName: e.sourceName,
          publishDate: e.publishDate,
          documentHash: e.documentHash ?? 'imported-hash-' + randomUUID().substring(0, 8),
          canonicalTextHash: e.canonicalTextHash ?? null,
          boundingBox: e.boundingBox ?? null,
          sourceUrl: e.sourceUrl,
          retrievalTimestamp: e.retrievalTimestamp,
          content: e.exactQuote,
          impactSummary: e.impactSummary,
          pageNumber: e.pageNumber,
          interpretationStatus: e.interpretationStatus,
          metadata: e.metadata,
        }).run();
      }
    }

    for (const d of importedDecisions) {
      tx.insert(decisions).values({
        id: randomUUID(),
        thesisId,
        outcome: d.outcome,
        action: d.optionalAction,
        rationale: d.userReasoning,
        createdAt: d.timestamp,
      }).run();
    }

    return { conversationId, thesisId };
  });
}

export async function generateDecisionRecommendation(
  thesisId: string,
  input: ServiceDependencies = {}
): Promise<DecisionRecommendation> {
  const { db } = dependencies(input);

  const thesis = await db.select().from(theses).where(eq(theses.id, thesisId)).get();
  if (!thesis) throw new Error('Thesis not found.');

  const assumptionRows = await db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).all();
  const assumptionIds = assumptionRows.map((a) => a.id);

  const evidenceRows = assumptionIds.length
    ? await db.select().from(evidence).where(inArray(evidence.assumptionId, assumptionIds)).all()
    : [];

  let contextPrompt = `You are evaluating an investment thesis for ${thesis.companyName} (${thesis.ticker}).\n`;
  contextPrompt += `Core Belief: "${thesis.coreBelief}"\n\n`;
  contextPrompt += `Please review the following underlying assumptions and the verified evidence retrieved for them:\n\n`;

  for (const a of assumptionRows) {
    contextPrompt += `Assumption: "${a.statement}" (Current Status: ${a.status})\n`;
    const aEvidence = evidenceRows.filter((e) => e.assumptionId === a.id);
    if (aEvidence.length === 0) {
      contextPrompt += `- No verified evidence found.\n`;
    } else {
      for (const e of aEvidence) {
        contextPrompt += `- ${e.verificationStatus} evidence from ${e.sourceName} (${e.publishDate ?? 'N/A'}): "${e.content}"\n`;
        contextPrompt += `  Impact: ${e.impactSummary}\n`;
      }
    }
    contextPrompt += `\n`;
  }

  contextPrompt += `Based on the provided verified evidence, recommend the most appropriate next action.\n`;
  contextPrompt += `Choose one of the following recommended outcomes:\n`;
  contextPrompt += `- 'No Change': The evidence supports all assumptions, or there is no new conflicting information.\n`;
  contextPrompt += `- 'Investigate Further': There are gaps in evidence, or some evidence is degraded/unclear.\n`;
  contextPrompt += `- 'Update Thesis': Some evidence directly challenges or contradicts the assumptions, requiring a thesis modification.\n`;
  contextPrompt += `- 'Archive': The core belief is invalidated or no longer relevant.\n\n`;
  contextPrompt += `Choose one optional action: 'Buy', 'Hold', 'Reduce', 'Exit', or null.\n`;
  contextPrompt += `Provide a concise rationale (1-3 sentences) explaining the reasoning.\n`;
  contextPrompt += `Do not give direct trade advice, but align your recommendation strictly with the evidence ledger.\n`;

  const provider = getLLMProvider({ modelId: input.llmModelId });

  const messages: ProjectMessage[] = [
    {
      role: 'system',
      content: 'You are an objective financial analyst assistant. You output structured recommendation JSON conforming exactly to the requested schema.',
    },
    {
      role: 'user',
      content: contextPrompt,
    },
  ];

  const result = await provider.structuredExtract(
    messages,
    decisionRecommendationSchema,
    'decision-recommendation-v1',
    {
      route: 'lib.research.generateDecisionRecommendation',
      dataClass: 'poc_workflow_confidential',
      runtime: { deployment: 'local' },
    },
  );

  if (!result.success || !result.data) {
    throw new Error(result.error ?? 'Failed to generate recommendation from LLM.');
  }

  return result.data;
}
