import { NextResponse } from 'next/server';
import { confirmRequestSchema } from '@/lib/domain/contracts';
import { confirmDraft } from '@/lib/research/service';

export async function POST(request: Request) {
  const parsed = confirmRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid confirmation request.' }, { status: 400 });

  try {
    return NextResponse.json(confirmDraft(parsed.data.conversationId, parsed.data.messageId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to confirm thesis.' },
      { status: 409 },
    );
  }
}
