import { NextResponse } from 'next/server';
import { getTheses } from '@/db/queries';

export async function GET() {
  try {
    const list = await getTheses();
    return NextResponse.json(list);
  } catch (err) {
    console.error('Failed to fetch theses:', err);
    return NextResponse.json({ error: 'Failed to fetch theses' }, { status: 500 });
  }
}
