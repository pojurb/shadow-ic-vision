import { NextResponse } from 'next/server';
import { thesisExportSchema } from '@/lib/domain/contracts';
import { importThesisData } from '@/lib/research/service';

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = thesisExportSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid thesis export payload.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await importThesisData(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import thesis.' },
      { status: 500 }
    );
  }
}
