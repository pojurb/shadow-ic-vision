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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const res = await fetch('/api/theses/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to import thesis.');

      const listRes = await fetch('/api/conversations');
      const listData = await listRes.json();
      if (Array.isArray(listData)) setConversations(listData);

      if (data.conversationId) {
        router.push(`/c/${data.conversationId}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Import failed. Ensure it is a valid thesis JSON package.');
    } finally {
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>Theses</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={createNew} className={styles.newButton}>+ New</button>
          <label className={styles.newButton} style={{ cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center' }}>
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
      {error && <p className={styles.sidebarError} style={{ color: 'var(--color-error, red)', fontSize: '0.875rem', padding: '0 16px' }}>{error}</p>}
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
