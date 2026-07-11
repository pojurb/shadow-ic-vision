import { NextResponse } from 'next/server';
import { getPortfolioPositions, createPortfolioPosition } from '@/db/queries';
import { z } from 'zod';

const createPositionSchema = z.object({
  ticker: z.string().min(1),
  market: z.enum(['US', 'ID']),
  shares: z.number().positive(),
  averageBuyPrice: z.number().positive(),
  thesisId: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const list = await getPortfolioPositions();
    return NextResponse.json(list);
  } catch (err) {
    console.error('Failed to fetch portfolio positions:', err);
    return NextResponse.json({ error: 'Failed to fetch portfolio positions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPositionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid position data', details: parsed.error.format() }, { status: 400 });
    }

    const id = await createPortfolioPosition({
      ticker: parsed.data.ticker.toUpperCase(),
      market: parsed.data.market,
      shares: parsed.data.shares,
      averageBuyPrice: parsed.data.averageBuyPrice,
      thesisId: parsed.data.thesisId || null,
    });

    return NextResponse.json({ id, ...parsed.data });
  } catch (err) {
    console.error('Failed to create portfolio position:', err);
    return NextResponse.json({ error: 'Failed to create portfolio position' }, { status: 500 });
  }
}
