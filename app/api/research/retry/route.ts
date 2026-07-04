import { NextResponse } from 'next/server';
import { researchRetryRequestSchema } from '@/lib/domain/contracts';
import { retryResearchJob } from '@/lib/research/service';

export async function POST(request: Request) {
  const parsed = researchRetryRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid retry request.' }, { status: 400 });

  try {
    return NextResponse.json(await retryResearchJob(parsed.data.jobId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to retry research.' },
      { status: 409 },
    );
  }
}
