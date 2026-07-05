import { NextResponse } from 'next/server';
import { exportThesisData } from '@/lib/research/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: thesisId } = await params;
  try {
    const data = await exportThesisData(thesisId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to export thesis.' },
      { status: 500 }
    );
  }
}
