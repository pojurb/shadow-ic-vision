import 'server-only';

import { getDatabase } from './client';
import { conversations, messages, theses, portfolioPositions, portfolioAlerts, sourceSnapshots } from './schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { ProviderMetadata } from '@/lib/ai/provider';
import { thesisDraftSchema, chatResponsePayloadSchema, type MessageDTO, type ThesisDraft, type ChatResponsePayload } from '@/lib/domain/contracts';

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
      shares: portfolioPositions.shares,
      averageBuyPrice: portfolioPositions.averageBuyPrice,
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
  shares: number;
  averageBuyPrice: number;
  thesisId: string | null;
}) {
  const { db } = getDatabase();
  const id = randomUUID();
  await db.insert(portfolioPositions).values({
    id,
    ticker: data.ticker,
    market: data.market,
    shares: data.shares,
    averageBuyPrice: data.averageBuyPrice,
    thesisId: data.thesisId,
  });
  return id;
}

export async function updatePortfolioPosition(
  id: string,
  data: {
    shares: number;
    averageBuyPrice: number;
    thesisId: string | null;
  },
) {
  const { db } = getDatabase();
  await db
    .update(portfolioPositions)
    .set({
      shares: data.shares,
      averageBuyPrice: data.averageBuyPrice,
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

export async function getPortfolioBriefing() {
  const { db } = getDatabase();
  const { calculatePriorityScore } = await import('@/lib/portfolio/priorityQueue');
  const { decisions, assumptions } = await import('./schema');

  // Fetch all positions up to 100
  const positions = await db
    .select({
      id: portfolioPositions.id,
      ticker: portfolioPositions.ticker,
      market: portfolioPositions.market,
      shares: portfolioPositions.shares,
      averageBuyPrice: portfolioPositions.averageBuyPrice,
      thesisId: portfolioPositions.thesisId,
      thesisTitle: theses.title,
      createdAt: portfolioPositions.createdAt,
    })
    .from(portfolioPositions)
    .leftJoin(theses, eq(portfolioPositions.thesisId, theses.id));

  const allUnreadAlerts = await db.select().from(portfolioAlerts).where(eq(portfolioAlerts.isRead, false));
  const allDecisions = await db.select().from(decisions);
  const challengedAssumptions = await db.select().from(assumptions).where(eq(assumptions.status, 'challenged'));

  const now = new Date();

  return positions.map((pos) => {
    // 1. Calculate unread alerts
    const unreadAlertCount = allUnreadAlerts.filter(a => a.positionId === pos.id).length;

    // 2. Calculate staleness (days since last review or position creation)
    let daysSinceLastReview = 14; // default to stale if no history
    
    if (pos.thesisId) {
      const posDecisions = allDecisions.filter(d => d.thesisId === pos.thesisId);
      if (posDecisions.length > 0) {
        // Find most recent decision
        const latest = posDecisions.reduce((max, d) => new Date(d.createdAt) > new Date(max.createdAt) ? d : max);
        const diffMs = now.getTime() - new Date(latest.createdAt).getTime();
        daysSinceLastReview = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      } else {
        const diffMs = now.getTime() - new Date(pos.createdAt).getTime();
        daysSinceLastReview = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
    } else {
      const diffMs = now.getTime() - new Date(pos.createdAt).getTime();
      daysSinceLastReview = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    // 3. Has challenged assumptions
    const hasChallengedAssumptions = pos.thesisId 
      ? challengedAssumptions.some(a => a.thesisId === pos.thesisId)
      : false;

    // 4. Score
    const priorityScore = calculatePriorityScore(unreadAlertCount, daysSinceLastReview, hasChallengedAssumptions);

    return {
      ...pos,
      priorityScore,
      unreadAlertCount,
      daysSinceLastReview,
      hasChallengedAssumptions,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
