import { NextResponse } from 'next/server';
import { getUnreadAlerts, markAllAlertsAsReadForPosition } from '@/db/queries';
import { z } from 'zod';

const readAllSchema = z.object({
  positionId: z.string().min(1),
});

export async function GET() {
  try {
    const list = await getUnreadAlerts();
    return NextResponse.json(list);
  } catch (err) {
    console.error('Failed to fetch portfolio alerts:', err);
    return NextResponse.json({ error: 'Failed to fetch portfolio alerts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = readAllSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'positionId is required' }, { status: 400 });
    }

    await markAllAlertsAsReadForPosition(parsed.data.positionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to dismiss all alerts for position:', err);
    return NextResponse.json({ error: 'Failed to dismiss alerts' }, { status: 500 });
  }
}
