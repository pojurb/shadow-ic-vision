import 'server-only';

import { getDatabase } from './client';
import { conversations, messages, theses } from './schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { ProviderMetadata } from '@/lib/ai/provider';
import { thesisDraftSchema, type MessageDTO, type ThesisDraft } from '@/lib/domain/contracts';

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
    structuredPayload?: ThesisDraft;
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

export function toMessageDTO(message: typeof messages.$inferSelect): MessageDTO {
  let structuredPayload: ThesisDraft | null = null;
  if (message.structuredPayload) {
    try {
      const parsed = thesisDraftSchema.safeParse(JSON.parse(message.structuredPayload));
      structuredPayload = parsed.success ? parsed.data : null;
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
