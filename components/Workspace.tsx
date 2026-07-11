'use client';

import { useEffect, useState } from 'react';
import type { MessageDTO } from '@/lib/domain/contracts';
import { isOllamaModelId, type OllamaModelId } from '@/lib/ai/ollama-models';
import { ChatUI } from './ChatUI';
import { ResearchPanel } from './ResearchPanel';
import styles from './Workspace.module.css';

export function Workspace({
  conversationId,
  initialMessages,
  confirmedDraftMessageId,
  initialModelId,
}: {
  conversationId: string;
  initialMessages: MessageDTO[];
  confirmedDraftMessageId: string | null;
  initialModelId: OllamaModelId;
}) {
  const [researchVersion, setResearchVersion] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [modelId, setModelId] = useState<OllamaModelId>(initialModelId);

  useEffect(() => {
    const stored = window.localStorage.getItem('jp-invest.ollamaModelId');
    if (isOllamaModelId(stored)) {
      setTimeout(() => {
        setModelId(stored);
      }, 0);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('jp-invest.ollamaModelId', modelId);
  }, [modelId]);

  return (
    <div className={styles.workspace}>
      <ChatUI
        conversationId={conversationId}
        initialMessages={initialMessages}
        confirmedDraftMessageId={confirmedDraftMessageId}
        modelId={modelId}
        onModelChange={setModelId}
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
        modelId={modelId}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}
