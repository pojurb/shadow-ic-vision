import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCronSecret } from '@/lib/research/config';
import { IngestionAlreadyRunningError, refreshOfficialSources } from '@/lib/research/ingestion';

export const runtime = 'nodejs';

export function hasValidCronAuthorization(authorization: string | null, configured: string) {
  const supplied = authorization?.replace(/^Bearer\s+/i, '') ?? '';
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function run(request: Request) {
  if (!hasValidCronAuthorization(request.headers.get('authorization'), getCronSecret())) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try { return NextResponse.json(await refreshOfficialSources('cron')); }
  catch (error) {
    if (error instanceof IngestionAlreadyRunningError) return NextResponse.json({ error: error.message, errorCode: error.code }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Refresh failed.' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
