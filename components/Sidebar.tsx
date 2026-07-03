'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ChatUI.module.css';

interface Conversation {
  id: string;
  title: string;
}

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(console.error);
  }, []);

  const createNew = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Thesis' })
      });
      const data = await res.json();
      if (data.id) {
        setConversations(prev => [data, ...prev]);
        router.push(`/c/${data.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>Theses</h2>
        <button onClick={createNew} className={styles.newButton}>+ New</button>
      </div>
      <ul className={styles.conversationList}>
        {conversations.map(c => (
          <li key={c.id}>
            <a href={`/c/${c.id}`} className={styles.conversationLink}>
              {c.title}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
