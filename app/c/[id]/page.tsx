import { ChatUI } from '@/components/ChatUI';
import { getMessages, getConversation } from '@/db/queries';
import { notFound } from 'next/navigation';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Verify conversation exists
  const conversation = await getConversation(id);
  if (!conversation) {
    notFound();
  }

  // Load initial messages
  const messages = await getMessages(id);
  
  const formattedMessages = messages.map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content
  }));

  return (
    <ChatUI conversationId={id} initialMessages={formattedMessages} />
  );
}
