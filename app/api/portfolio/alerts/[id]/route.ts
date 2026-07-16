import { NextResponse } from 'next/server';
import { markAlertAsRead } from '@/db/queries';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await markAlertAsRead(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to mark alert as read:', err);
    return NextResponse.json({ error: 'Failed to mark alert as read' }, { status: 500 });
  }
}
