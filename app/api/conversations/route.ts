import { NextResponse } from 'next/server';
import { getConversations, createConversation } from '@/db/queries';

export async function GET() {
  try {
    const list = await getConversations();
    return NextResponse.json(list);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title } = await request.json();
    const id = await createConversation(title || 'New Thesis');
    return NextResponse.json({ id, title: title || 'New Thesis' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
