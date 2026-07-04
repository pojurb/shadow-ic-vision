import { NextResponse } from 'next/server';
import { getConversation } from '@/db/queries';
import { researchRunRequestSchema } from '@/lib/domain/contracts';
import { processResearchJobs } from '@/lib/research/service';

export async function POST(request: Request) {
  const parsed = researchRunRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid research request.' }, { status: 400 });
  if (!await getConversation(parsed.data.conversationId)) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }
  return NextResponse.json(await processResearchJobs(parsed.data.conversationId));
}
