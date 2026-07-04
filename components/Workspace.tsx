'use client';

import { useState } from 'react';
import type { MessageDTO } from '@/lib/domain/contracts';
import { ChatUI } from './ChatUI';
import { ResearchPanel } from './ResearchPanel';
import styles from './Workspace.module.css';

export function Workspace({
  conversationId,
  initialMessages,
  confirmedDraftMessageId,
}: {
  conversationId: string;
  initialMessages: MessageDTO[];
  confirmedDraftMessageId: string | null;
}) {
  const [researchVersion, setResearchVersion] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className={styles.workspace}>
      <ChatUI
        conversationId={conversationId}
        initialMessages={initialMessages}
        confirmedDraftMessageId={confirmedDraftMessageId}
        onResearchQueued={() => {
          setResearchVersion((value) => value + 1);
          setPanelOpen(true);
        }}
        onOpenResearch={() => setPanelOpen(true)}
      />
      <ResearchPanel
        conversationId={conversationId}
        refreshVersion={researchVersion}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}
