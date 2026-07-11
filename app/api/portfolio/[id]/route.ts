import { NextResponse } from 'next/server';
import { updatePortfolioPosition, deletePortfolioPosition } from '@/db/queries';
import { z } from 'zod';

const updatePositionSchema = z.object({
  shares: z.number().positive(),
  averageBuyPrice: z.number().positive(),
  thesisId: z.string().nullable().optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updatePositionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid position data', details: parsed.error.format() }, { status: 400 });
    }

    await updatePortfolioPosition(id, {
      shares: parsed.data.shares,
      averageBuyPrice: parsed.data.averageBuyPrice,
      thesisId: parsed.data.thesisId || null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update portfolio position:', err);
    return NextResponse.json({ error: 'Failed to update portfolio position' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deletePortfolioPosition(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete portfolio position:', err);
    return NextResponse.json({ error: 'Failed to delete portfolio position' }, { status: 500 });
  }
}
