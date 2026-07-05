import { NextResponse } from 'next/server';
import { recordDecisionRequestSchema } from '@/lib/domain/contracts';
import { recordDecision } from '@/lib/research/service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: thesisId } = await params;
  try {
    const json = await request.json();
    const parsed = recordDecisionRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid decision payload.' }, { status: 400 });
    }

    const result = await recordDecision(
      thesisId,
      parsed.data.outcome,
      parsed.data.optionalAction,
      parsed.data.userReasoning
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to record decision.' },
      { status: 500 }
    );
  }
}
