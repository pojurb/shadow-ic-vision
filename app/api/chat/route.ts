import { NextResponse } from 'next/server';
import { addMessage, getConversation, getMessages, getThesisForConversation, toMessageDTO } from '@/db/queries';
import { getLLMProvider } from '@/lib/ai/factory';
import type { ProjectMessage } from '@/lib/ai/provider';
import { chatRequestSchema, thesisDraftSchema } from '@/lib/domain/contracts';

const llmProvider = getLLMProvider();

export async function POST(request: Request) {
  try {
    const parsedRequest = chatRequestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Enter a message between 1 and 4,000 characters.' }, { status: 400 });
    }
    const { conversationId, content } = parsedRequest.data;
    if (!await getConversation(conversationId)) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // Save user message
    await addMessage(conversationId, 'user', content);

    // Fetch conversation history to send to LLM
    const history = await getMessages(conversationId);
    
    // Map db messages to ProjectMessage format
    const projectMessages: ProjectMessage[] = history.map((msg) => ({
      role: msg.role as ProjectMessage['role'],
      content: msg.content
    }));

    const response = await llmProvider.chat(projectMessages);
    const existingThesis = await getThesisForConversation(conversationId);
    const extraction = existingThesis
      ? null
      : await llmProvider.structuredExtract(projectMessages, thesisDraftSchema, 'thesis-draft-v1');
    const structuredPayload = extraction?.success ? extraction.data ?? undefined : undefined;

    // Save assistant message
    const savedMsgId = await addMessage(
      conversationId, 
      'assistant', 
      response.text, 
      {
        providerMetadata: response.metadata,
        structuredPayload,
        validationOutcome: extraction
          ? extraction.success ? 'valid' : 'invalid'
          : 'not_applicable',
      },
    );

    const saved = (await getMessages(conversationId)).find((message) => message.id === savedMsgId);
    if (!saved) throw new Error('Assistant message was not persisted.');

    // Return the new assistant message to the client
    return NextResponse.json({
      message: toMessageDTO(saved),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
