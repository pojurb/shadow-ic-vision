'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './ChatUI.module.css';

interface Conversation {
  id: string;
  title: string;
}

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(() => setError('Unable to load theses.'));
  }, []);

  const createNew = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Thesis' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to create conversation.');
      if (data.id) {
        setConversations(prev => [data, ...prev]);
        router.push(`/c/${data.id}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create conversation.');
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>Theses</h2>
        <button onClick={createNew} className={styles.newButton}>+ New</button>
      </div>
      {error && <p className={styles.sidebarError}>{error}</p>}
      <ul className={styles.conversationList}>
        {conversations.map(c => (
          <li key={c.id}>
            <Link href={`/c/${c.id}`} className={styles.conversationLink}>
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
