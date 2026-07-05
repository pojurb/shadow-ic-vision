import { NextResponse } from 'next/server';
import { IngestionAlreadyRunningError, refreshOfficialSources } from '@/lib/research/ingestion';

export async function POST() {
  try {
    return NextResponse.json(await refreshOfficialSources('manual'));
  } catch (error) {
    if (error instanceof IngestionAlreadyRunningError) return NextResponse.json({ error: error.message, errorCode: error.code }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Refresh failed.' }, { status: 500 });
  }
}
