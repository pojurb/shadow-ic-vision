import { db } from './client';
import { conversations, messages, theses } from './schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function createConversation(title: string) {
  const id = uuidv4();
  await db.insert(conversations).values({ id, title });
  return id;
}

export async function getConversations() {
  return await db.select().from(conversations).orderBy(desc(conversations.createdAt));
}

export async function getConversation(id: string) {
  const result = await db.select().from(conversations).where(eq(conversations.id, id));
  return result[0] || null;
}

export async function getMessages(conversationId: string) {
  return await db.select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function addMessage(
  conversationId: string, 
  role: 'user' | 'assistant' | 'system', 
  content: string, 
  providerMetadata?: any
) {
  const id = uuidv4();
  await db.insert(messages).values({
    id,
    conversationId,
    role,
    content,
    providerMetadata: providerMetadata ? JSON.stringify(providerMetadata) : null,
  });
  return id;
}
