import { NextResponse } from 'next/server';
import { acceptSecondaryEvidence } from '@/lib/research/service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assumptionId } = await params;
  try {
    return NextResponse.json(await acceptSecondaryEvidence(assumptionId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to accept secondary evidence.' },
      { status: 409 },
    );
  }
}
