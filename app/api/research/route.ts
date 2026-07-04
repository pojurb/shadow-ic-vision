import { NextResponse } from 'next/server';
import { getConversation } from '@/db/queries';
import { researchRunRequestSchema } from '@/lib/domain/contracts';
import { getResearchPanel } from '@/lib/research/service';

export async function GET(request: Request) {
  const conversationId = new URL(request.url).searchParams.get('conversationId');
  const parsed = researchRunRequestSchema.safeParse({ conversationId });
  if (!parsed.success) return NextResponse.json({ error: 'A valid conversationId is required.' }, { status: 400 });
  if (!await getConversation(parsed.data.conversationId)) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }
  return NextResponse.json(await getResearchPanel(parsed.data.conversationId));
}
