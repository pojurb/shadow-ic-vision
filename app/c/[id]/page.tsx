import { Workspace } from '@/components/Workspace';
import { getMessages, getConversation, getThesisForConversation, toMessageDTO } from '@/db/queries';
import { getConfiguredOllamaModelId } from '@/lib/ai/ollama-config';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Verify conversation exists
  const conversation = await getConversation(id);
  if (!conversation) {
    notFound();
  }

  // Load initial messages
  const [messages, thesis] = await Promise.all([getMessages(id), getThesisForConversation(id)]);
  
  return (
    <Workspace
      conversationId={id}
      initialMessages={messages.map(toMessageDTO)}
      confirmedDraftMessageId={thesis?.draftMessageId ?? null}
      initialModelId={getConfiguredOllamaModelId()}
    />
  );
}
