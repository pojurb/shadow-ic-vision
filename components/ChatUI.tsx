'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ChatUI.module.css';

interface Message {
  id: string;
  role: string;
  content: string;
}

export function ChatUI({ conversationId, initialMessages }: { conversationId: string, initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: userMsg }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content: userMsg })
      });
      
      const data = await res.json();
      if (data.id) {
        setMessages(prev => [...prev, data]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesArea} ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow}>
            <div className={m.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={styles.assistantMessageRow}>
            <div className={styles.assistantBubble}>
              <em>Thinking...</em>
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="State your thesis or assumption..."
          className={styles.textInput}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()} className={styles.sendButton}>
          Send
        </button>
      </form>
    </div>
  );
}
