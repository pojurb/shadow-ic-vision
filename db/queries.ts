import 'server-only';

import { getDatabase } from './client';
import { conversations, messages, theses, portfolioPositions, portfolioAlerts, sourceSnapshots, decisions, assumptions, evidence, researchJobs } from './schema';
import { eq, desc, count, inArray, max, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { ProviderMetadata } from '@/lib/ai/provider';
import { thesisDraftSchema, chatResponsePayloadSchema, type MessageDTO, type ThesisDraft, type ChatResponsePayload } from '@/lib/domain/contracts';
import { calculatePriorityScore, type ThesisResearchSummary } from '@/lib/portfolio/priorityQueue';
import { deriveCoverageLedger } from '@/lib/research/coverage';
import { deriveThesisVerdict } from '@/lib/research/verdict';
import { loadMeasurementContract } from '@/lib/research/measurement';

export async function createConversation(title: string) {
  const { db } = getDatabase();
  const id = randomUUID();
  await db.insert(conversations).values({ id, title });
  return id;
}

export async function getConversations() {
  const { db } = getDatabase();
  return await db.select().from(conversations).orderBy(desc(conversations.createdAt));
}

export async function getConversation(id: string) {
  const { db } = getDatabase();
  const result = await db.select().from(conversations).where(eq(conversations.id, id));
  return result[0] || null;
}

export async function updateConversationTitle(id: string, title: string) {
  const { db } = getDatabase();
  await db.update(conversations).set({ title, updatedAt: new Date().toISOString() }).where(eq(conversations.id, id));
}

export async function getMessages(conversationId: string) {
  const { db } = getDatabase();
  return await db.select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function addMessage(
  conversationId: string, 
  role: 'user' | 'assistant' | 'system', 
  content: string, 
  options: {
    providerMetadata?: ProviderMetadata;
    structuredPayload?: ChatResponsePayload | ThesisDraft;
    validationOutcome?: 'valid' | 'invalid' | 'not_applicable';
  } = {},
) {
  const { db } = getDatabase();
  const id = randomUUID();
  await db.insert(messages).values({
    id,
    conversationId,
    role,
    content,
    providerMetadata: options.providerMetadata ? JSON.stringify(options.providerMetadata) : null,
    structuredPayload: options.structuredPayload ? JSON.stringify(options.structuredPayload) : null,
    validationOutcome: options.validationOutcome ?? 'not_applicable',
  });
  return id;
}

export async function getMessage(id: string) {
  const { db } = getDatabase();
  const result = await db.select().from(messages).where(eq(messages.id, id));
  return result[0] ?? null;
}

export async function getThesisForConversation(conversationId: string) {
  const { db } = getDatabase();
  const result = await db.select().from(theses).where(eq(theses.conversationId, conversationId));
  return result[0] ?? null;
}

export async function getTheses() {
  const { db } = getDatabase();
  return await db.select().from(theses).orderBy(desc(theses.createdAt));
}


export function toMessageDTO(message: typeof messages.$inferSelect): MessageDTO {
  let structuredPayload: ChatResponsePayload | ThesisDraft | null = null;
  if (message.structuredPayload) {
    try {
      const parsedJSON = JSON.parse(message.structuredPayload);
      if (parsedJSON && (parsedJSON.type === 'exploration_draft' || parsedJSON.type === 'thesis_draft' || parsedJSON.type === 'none')) {
        const parsed = chatResponsePayloadSchema.safeParse(parsedJSON);
        structuredPayload = parsed.success ? parsed.data : null;
      } else {
        const parsed = thesisDraftSchema.safeParse(parsedJSON);
        structuredPayload = parsed.success ? parsed.data : null;
      }
    } catch {
      structuredPayload = null;
    }
  }

  return {
    id: message.id,
    role: message.role as MessageDTO['role'],
    content: message.content,
    structuredPayload,
    validationOutcome: message.validationOutcome,
    createdAt: message.createdAt,
  };
}

export async function getPortfolioPositions() {
  const { db } = getDatabase();
  return await db
    .select({
      id: portfolioPositions.id,
      ticker: portfolioPositions.ticker,
      market: portfolioPositions.market,
      status: portfolioPositions.status,
      thesisId: portfolioPositions.thesisId,
      thesisTitle: theses.title,
      createdAt: portfolioPositions.createdAt,
      updatedAt: portfolioPositions.updatedAt,
    })
    .from(portfolioPositions)
    .leftJoin(theses, eq(portfolioPositions.thesisId, theses.id))
    .orderBy(desc(portfolioPositions.createdAt));
}

export async function createPortfolioPosition(data: {
  ticker: string;
  market: 'US' | 'ID';
  status: 'owned' | 'watchlist';
  thesisId: string | null;
}) {
  const { db } = getDatabase();
  const id = randomUUID();
  await db.insert(portfolioPositions).values({
    id,
    ticker: data.ticker,
    market: data.market,
    status: data.status,
    thesisId: data.thesisId,
  });
  return id;
}

export async function updatePortfolioPosition(
  id: string,
  data: {
    status: 'owned' | 'watchlist';
    thesisId: string | null;
  },
) {
  const { db } = getDatabase();
  await db
    .update(portfolioPositions)
    .set({
      status: data.status,
      thesisId: data.thesisId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(portfolioPositions.id, id));
}

export async function deletePortfolioPosition(id: string) {
  const { db } = getDatabase();
  await db.delete(portfolioPositions).where(eq(portfolioPositions.id, id));
}

export async function getUnreadAlerts() {
  const { db } = getDatabase();
  return await db
    .select({
      id: portfolioAlerts.id,
      positionId: portfolioAlerts.positionId,
      documentHash: portfolioAlerts.documentHash,
      isRead: portfolioAlerts.isRead,
      createdAt: portfolioAlerts.createdAt,
      ticker: portfolioPositions.ticker,
      market: portfolioPositions.market,
      documentId: sourceSnapshots.documentId,
      sourceUrl: sourceSnapshots.sourceUrl,
      sourceName: sourceSnapshots.sourceName,
      sourceFormat: sourceSnapshots.sourceFormat,
      sourceTier: sourceSnapshots.sourceTier,
      publishDate: sourceSnapshots.publishDate,
    })
    .from(portfolioAlerts)
    .innerJoin(portfolioPositions, eq(portfolioAlerts.positionId, portfolioPositions.id))
    .innerJoin(sourceSnapshots, eq(portfolioAlerts.documentHash, sourceSnapshots.documentHash))
    .where(eq(portfolioAlerts.isRead, false))
    .orderBy(desc(portfolioAlerts.createdAt));
}

export async function markAlertAsRead(id: string) {
  const { db } = getDatabase();
  await db
    .update(portfolioAlerts)
    .set({ isRead: true })
    .where(eq(portfolioAlerts.id, id));
}

export async function markAllAlertsAsReadForPosition(positionId: string) {
  const { db } = getDatabase();
  await db
    .update(portfolioAlerts)
    .set({ isRead: true })
    .where(eq(portfolioAlerts.positionId, positionId));
}

/**
 * The research state the briefing needs, per thesis.
 *
 * The briefing carried only positions, alerts, review age and a `challenged`
 * flag until 2026-08-06, so a tracked thesis appeared in the Top-10 queue and
 * the status index as a bare ticker — no verdict, no coverage, nothing about
 * whether its assumptions actually stand. That made the weekly review
 * (`VISION.md` §4, the product's core experience) a list of symbols rather
 * than a prompt to re-evaluate anything.
 *
 * Reuses the same pure derivations the Research Panel renders
 * (`deriveCoverageLedger`, `deriveThesisVerdict`), assembled the way
 * `getResearchPanel` assembles them, so the two surfaces cannot disagree.
 * Evidence *content* is deliberately not loaded — only polarity and tier, which
 * is all the derivations read.
 */
async function getThesisResearchSummaries(
  db: ReturnType<typeof getDatabase>['db'],
  thesisIds: string[],
): Promise<Map<string, ThesisResearchSummary>> {
  const summaries = new Map<string, ThesisResearchSummary>();
  if (thesisIds.length === 0) return summaries;

  const rows = db
    .select({
      thesisId: assumptions.thesisId,
      assumptionId: assumptions.id,
      statement: assumptions.statement,
      market: theses.market,
      jobStatus: researchJobs.status,
    })
    .from(assumptions)
    .innerJoin(theses, eq(theses.id, assumptions.thesisId))
    .leftJoin(researchJobs, eq(researchJobs.assumptionId, assumptions.id))
    .where(inArray(assumptions.thesisId, thesisIds))
    .all();

  const evidenceRows = db
    .select({
      id: evidence.id,
      assumptionId: evidence.assumptionId,
      polarity: evidence.polarity,
      sourceTier: evidence.sourceTier,
      deltaVsThreshold: evidence.deltaVsThreshold,
      sourceName: evidence.sourceName,
      sourceUrl: evidence.sourceUrl,
    })
    .from(evidence)
    .innerJoin(assumptions, eq(assumptions.id, evidence.assumptionId))
    .where(inArray(assumptions.thesisId, thesisIds))
    .all();

  for (const thesisId of new Set(rows.map((row) => row.thesisId))) {
    const thesisRows = rows.filter((row) => row.thesisId === thesisId);
    const evidenceFor = (assumptionId: string) => evidenceRows.filter((row) => row.assumptionId === assumptionId);

    const coverage = deriveCoverageLedger(thesisRows.map((row) => ({
      assumptionId: row.assumptionId,
      statement: row.statement,
      market: row.market as 'US' | 'ID',
      contract: loadMeasurementContract(db, row.assumptionId),
      jobStatus: row.jobStatus ?? 'queued',
      polarities: evidenceFor(row.assumptionId).map((item) => item.polarity),
    })));

    const verdict = deriveThesisVerdict({
      coverage,
      assumptions: thesisRows.map((row) => ({
        assumptionId: row.assumptionId,
        statement: row.statement,
        contract: loadMeasurementContract(db, row.assumptionId),
        evidence: evidenceFor(row.assumptionId).map((item) => ({
          id: item.id,
          polarity: item.polarity,
          deltaVsThreshold: item.deltaVsThreshold,
          // Only structured-fact evidence carries an observed value, and none
          // of it is needed to pick a level — the panel quantifies breaches.
          observedValue: null,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
        })),
      })),
    });

    summaries.set(thesisId, {
      verdictLevel: verdict.level,
      supported: coverage.supported,
      totalAssumptions: coverage.totalAssumptions,
      unevidenced: coverage.unevidenced,
      /*
       * Named for what these rows are, not what they were called. They are
       * passages retrieved by lexical overlap whose relevance to the claim was
       * never assessed (R-025) — reporting them as corroboration is the
       * overstatement this whole change exists to stop.
       */
      relevanceUnassessedCount: evidenceRows.filter(
        (row) => thesisRows.some((r) => r.assumptionId === row.assumptionId) && row.sourceTier === 'secondary',
      ).length,
    });
  }

  return summaries;
}

export async function getPortfolioBriefing() {
  const { db } = getDatabase();

  const positions = await db
    .select({
      id: portfolioPositions.id,
      ticker: portfolioPositions.ticker,
      market: portfolioPositions.market,
      status: portfolioPositions.status,
      thesisId: portfolioPositions.thesisId,
      thesisTitle: theses.title,
      conversationId: theses.conversationId,
      createdAt: portfolioPositions.createdAt,
    })
    .from(portfolioPositions)
    .leftJoin(theses, eq(portfolioPositions.thesisId, theses.id));

  const unreadAlertCountsByPosition = await db
    .select({ positionId: portfolioAlerts.positionId, unreadCount: count() })
    .from(portfolioAlerts)
    .where(eq(portfolioAlerts.isRead, false))
    .groupBy(portfolioAlerts.positionId);
  const unreadAlertCountByPositionId = new Map(unreadAlertCountsByPosition.map((row) => [row.positionId, row.unreadCount]));

  const latestDecisionByThesis = await db
    .select({ thesisId: decisions.thesisId, lastDecisionAt: max(decisions.createdAt) })
    .from(decisions)
    .groupBy(decisions.thesisId);
  const latestDecisionAtByThesisId = new Map(latestDecisionByThesis.map((row) => [row.thesisId, row.lastDecisionAt]));

  const latestDecisionOutcomes = await db.all<{
    thesisId: string;
    outcome: string;
    action: string | null;
  }>(sql`
    SELECT thesis_id as thesisId, outcome, action
    FROM decisions d
    WHERE created_at = (SELECT MAX(created_at) FROM decisions WHERE thesis_id = d.thesis_id)
  `);
  const latestOutcomeByThesisId = new Map(latestDecisionOutcomes.map((row) => [row.thesisId, row]));

  const challengedAssumptionTheses = await db
    .selectDistinct({ thesisId: assumptions.thesisId })
    .from(assumptions)
    .where(eq(assumptions.status, 'challenged'));
  const thesisIdsWithChallengedAssumptions = new Set(challengedAssumptionTheses.map((row) => row.thesisId));

  const researchSummaries = await getThesisResearchSummaries(
    db,
    [...new Set(positions.map((pos) => pos.thesisId).filter((id): id is string => Boolean(id)))],
  );

  const now = new Date();

  return positions.map((pos) => {
    const unreadAlertCount = unreadAlertCountByPositionId.get(pos.id) ?? 0;

    const lastReviewedAt = (pos.thesisId ? latestDecisionAtByThesisId.get(pos.thesisId) : null) ?? pos.createdAt;
    const daysSinceLastReview = Math.floor((now.getTime() - new Date(lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24));

    const hasChallengedAssumptions = pos.thesisId ? thesisIdsWithChallengedAssumptions.has(pos.thesisId) : false;

    const priorityScore = calculatePriorityScore(unreadAlertCount, daysSinceLastReview, hasChallengedAssumptions);

    const latestOutcome = pos.thesisId ? latestOutcomeByThesisId.get(pos.thesisId) : undefined;

    return {
      ...pos,
      priorityScore,
      unreadAlertCount,
      daysSinceLastReview,
      hasChallengedAssumptions,
      lastOutcome: latestOutcome?.outcome ?? null,
      lastAction: latestOutcome?.action ?? null,
      research: (pos.thesisId ? researchSummaries.get(pos.thesisId) : undefined) ?? null,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
