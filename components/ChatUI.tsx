'use client';

import { useState, useRef, useEffect } from 'react';
import type { MessageDTO } from '@/lib/domain/contracts';
import { OLLAMA_MODEL_OPTIONS, type OllamaModelId } from '@/lib/ai/ollama-models';
import styles from './ChatUI.module.css';

export function ChatUI({
  conversationId,
  initialMessages,
  confirmedDraftMessageId,
  modelId,
  onModelChange,
  onResearchQueued,
  onOpenResearch,
}: {
  conversationId: string;
  initialMessages: MessageDTO[];
  confirmedDraftMessageId: string | null;
  modelId: OllamaModelId;
  onModelChange: (modelId: OllamaModelId) => void;
  onResearchQueued: () => void;
  onOpenResearch: () => void;
}) {
  const [messages, setMessages] = useState<MessageDTO[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState(() => new Set(confirmedDraftMessageId ? [confirmedDraftMessageId] : []));
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleTrackAsset = (candidate: { ticker: string; companyName: string; market: 'US' | 'ID' }) => {
    const event = new CustomEvent('jp-invest:track-asset', { detail: candidate });
    window.dispatchEvent(event);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);

    // Optimistically add user message
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: userMsg,
      structuredPayload: null,
      validationOutcome: 'not_applicable',
      createdAt: new Date().toISOString(),
    }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content: userMsg, modelId }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to send message.');
      setMessages(prev => [...prev, data.message]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send message.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDraft = async (messageId: string) => {
    setError(null);
    const response = await fetch('/api/theses/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, messageId }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? 'Unable to confirm thesis.');
      return;
    }
    setConfirmedIds((current) => new Set(current).add(messageId));
    onResearchQueued();
  };

  return (
    <div className={styles.chatContainer}>
      <header className={styles.chatToolbar}>
        <div>
          <span className={styles.toolbarLabel}>Model</span>
          <p className={styles.toolbarCaption}>Switch the active Ollama Cloud model for this conversation.</p>
        </div>
        <label className={styles.modelSelectWrap}>
          <span className={styles.srOnly}>Select model</span>
          <select
            className={styles.modelSelect}
            value={modelId}
            onChange={(e) => onModelChange(e.target.value as OllamaModelId)}
            title={OLLAMA_MODEL_OPTIONS.find((option) => option.id === modelId)?.description}
          >
            {OLLAMA_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id} title={option.description}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className={styles.messagesArea} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <span>Deterministic local demo</span>
            <h1>State a thesis to begin</h1>
            <p>Try “I believe PLTR gross margin will remain above 80%” or “BBRI NIM will remain above 6%.”</p>
          </div>
        )}
        {messages.map(m => {
          const thesisDraft = m.structuredPayload
            ? ('type' in m.structuredPayload)
              ? m.structuredPayload.type === 'thesis_draft' ? m.structuredPayload.thesisDraft : null
              : m.structuredPayload
            : null;

          const explorationDraft = m.structuredPayload && ('type' in m.structuredPayload) && m.structuredPayload.type === 'exploration_draft'
            ? m.structuredPayload.explorationDraft
            : null;

          return (
            <div key={m.id} className={m.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow}>
              <div className={m.role === 'user' ? styles.userBubble : styles.assistantBubble}>
                {m.content}
                
                {thesisDraft && (
                  <div className={styles.draftCard}>
                    <span>Confirmation required</span>
                    <h3>{thesisDraft.ticker} · {thesisDraft.companyName}</h3>
                    <p>{thesisDraft.coreBelief}</p>
                    <ul>
                      {thesisDraft.assumptions.map((assumption) => (
                        <li key={assumption.statement}>{assumption.statement}</li>
                      ))}
                    </ul>
                    {confirmedIds.has(m.id) ? (
                      <button className={styles.secondaryButton} onClick={onOpenResearch}>View research</button>
                    ) : (
                      <button className={styles.confirmButton} onClick={() => confirmDraft(m.id)}>
                        Confirm &amp; Research
                      </button>
                    )}
                  </div>
                )}

                {explorationDraft && (
                  <div className={styles.explorationCard}>
                    <span className={styles.explorationHeader}>Sector Candidates: {explorationDraft.sectorName}</span>
                    <div className={styles.explorationList}>
                      {explorationDraft.candidates.map((candidate) => (
                        <div key={candidate.ticker} className={styles.candidateItem}>
                          <div className={styles.candidateRow}>
                            <span className={styles.candidateTicker}>
                              {candidate.ticker} <span className={styles.marketBadge}>{candidate.market}</span>
                            </span>
                            <button
                              onClick={() => handleTrackAsset(candidate)}
                              className={styles.trackAssetButton}
                            >
                              Track Asset
                            </button>
                          </div>
                          <div className={styles.candidateName}>{candidate.companyName}</div>
                          <p className={styles.candidateRationale}>{candidate.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className={styles.assistantMessageRow}>
            <div className={styles.assistantBubble}>
              <em>Thinking...</em>
            </div>
          </div>
        )}
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}
      
      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="State your thesis or assumption..."
          className={styles.textInput}
          disabled={isLoading}
          rows={2}
        />
        <button type="submit" disabled={isLoading || !input.trim()} className={styles.sendButton}>
          Send
        </button>
      </form>
    </div>
  );
}
