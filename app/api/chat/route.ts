import { NextResponse } from 'next/server';
import { addMessage, getMessages } from '@/db/queries';
import { MockProvider } from '@/lib/ai/adapters/mock';
import type { ProjectMessage } from '@/lib/ai/provider';

const llmProvider = new MockProvider();

export async function POST(request: Request) {
  try {
    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save user message
    await addMessage(conversationId, 'user', content);

    // Fetch conversation history to send to LLM
    const history = await getMessages(conversationId);
    
    // Map db messages to ProjectMessage format
    const projectMessages: ProjectMessage[] = history.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    // Get response from our LLM provider wrapper
    const response = await llmProvider.chat(projectMessages);

    // Save assistant message
    const savedMsgId = await addMessage(
      conversationId, 
      'assistant', 
      response.text, 
      response.metadata
    );

    // Return the new assistant message to the client
    return NextResponse.json({
      id: savedMsgId,
      role: 'assistant',
      content: response.text,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
