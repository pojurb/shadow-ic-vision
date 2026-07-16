import { NextResponse } from 'next/server';
import { getPortfolioBriefing } from '@/db/queries';

export async function GET() {
  try {
    const queue = await getPortfolioBriefing();

    // Top-10 Queue
    const topTen = queue.slice(0, 10);
    
    // Status Index (all positions)
    const statusIndex = queue;

    return NextResponse.json({
      topTen,
      statusIndex,
    });
  } catch (error) {
    console.error('Failed to get portfolio briefing:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve portfolio briefing' },
      { status: 500 }
    );
  }
}
