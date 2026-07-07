'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ResearchPanelDTO, DecisionOutcome, DecisionAction } from '@/lib/domain/contracts';
import styles from './Workspace.module.css';

const EMPTY_PANEL: ResearchPanelDTO = { thesis: null, items: [], decisions: [] };

function evidenceBadge(status: ResearchPanelDTO['items'][number]['evidence'][number]['verificationStatus']) {
  if (status === 'ocr_matched') return 'OCR matched';
  if (status === 'derived') return 'Derived';
  return 'Exact source match';
}

function evidenceWarning(status: ResearchPanelDTO['items'][number]['evidence'][number]['verificationStatus']) {
  if (status === 'ocr_matched') return 'OCR evidence is matched to retained OCR text, not source-exact document text.';
  if (status === 'derived') return 'Derived evidence is calculated or parsed from retained inputs and must keep its method visible.';
  return null;
}

function normalizePanelData(input: ResearchPanelDTO): ResearchPanelDTO {
  return {
    ...input,
    items: input.items ?? [],
    decisions: input.decisions ?? [],
  };
}

export function ResearchPanel({
  conversationId,
  refreshVersion,
  open,
  onClose,
}: {
  conversationId: string;
  refreshVersion: number;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<ResearchPanelDTO>(EMPTY_PANEL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [outcome, setOutcome] = useState<'No Change' | 'Investigate Further' | 'Update Thesis' | 'Archive'>('No Change');
  const [optionalAction, setOptionalAction] = useState<'Buy' | 'Hold' | 'Reduce' | 'Exit' | null>(null);
  const [userReasoning, setUserReasoning] = useState('');
  const [recording, setRecording] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    recommendedOutcome: 'No Change' | 'Investigate Further' | 'Update Thesis' | 'Archive';
    recommendedAction: 'Buy' | 'Hold' | 'Reduce' | 'Exit' | null;
    rationale: string;
  } | null>(null);

  const getSystemRecommendation = async () => {
    if (!data.thesis) return;
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(`/api/theses/${data.thesis.id}/recommendation`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to get recommendation.');
      setRecommendation(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to get recommendation.');
    } finally {
      setAnalyzing(false);
    }
  };

  const applyRecommendation = () => {
    if (!recommendation) return;
    setOutcome(recommendation.recommendedOutcome);
    setOptionalAction(recommendation.recommendedAction);
    setUserReasoning(recommendation.rationale);
  };

  const recordUserDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.thesis) return;
    if (!userReasoning.trim()) {
      setError('Please provide reasoning for the decision.');
      return;
    }
    setRecording(true);
    setError(null);
    try {
      const response = await fetch(`/api/theses/${data.thesis.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, optionalAction, userReasoning }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to record decision.');
      
      setUserReasoning('');
      setOutcome('No Change');
      setOptionalAction(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to record decision.');
    } finally {
      setRecording(false);
    }
  };

  const triggerExport = async () => {
    if (!data.thesis) return;
    try {
      setError(null);
      const res = await fetch(`/api/theses/${data.thesis.id}/export`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Export failed.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thesis-export-${data.thesis.ticker}-${data.thesis.market}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.');
    }
  };

  const load = useCallback(async () => {
    const response = await fetch(`/api/research?conversationId=${encodeURIComponent(conversationId)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load research.');
    const normalized = normalizePanelData(body);
    setData(normalized);
    setError(null);
    return normalized;
  }, [conversationId]);

  const runQueued = useCallback(async () => {
    const current = await load();
    if (!current.items.some((item) => item.job.status === 'queued' || item.job.status === 'running')) return;
    const response = await fetch('/api/research/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to run research.');
    setData(body);
  }, [conversationId, load]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      runQueued()
        .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : 'Unable to load research.'))
        .finally(() => active && setLoading(false));
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [runQueued, refreshVersion]);

  useEffect(() => {
    const hasActiveJob = data.items.some((item) => item.job.status === 'queued' || item.job.status === 'running');
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => load().catch(() => undefined), 1_500);
    return () => window.clearInterval(timer);
  }, [data.items, load]);

  const retry = async (jobId: string) => {
    setError(null);
    const response = await fetch('/api/research/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? 'Unable to retry research.');
      return;
    }
    await runQueued();
  };

  const refreshAll = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/research/refresh', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to refresh official sources.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to refresh official sources.');
    } finally { setRefreshing(false); }
  };

  return (
    <aside className={`${styles.researchPanel} ${open ? styles.researchPanelOpen : ''}`} aria-label="Research panel">
      <header className={styles.panelHeader}>
        <div>
          <span className={styles.eyebrow}>Local trust engine</span>
          <h2>Research</h2>
        </div>
        <button className={styles.closePanel} onClick={onClose} aria-label="Close research panel">×</button>
      </header>

      {loading && <p className={styles.panelMessage}>Loading research…</p>}
      {error && <div className={styles.errorBanner}>{error}</div>}
      {!loading && !data.thesis && (
        <div className={styles.emptyPanel}>
          <strong>No research yet</strong>
          <p>Confirm a structured thesis draft to start deterministic local research.</p>
        </div>
      )}

      {data.thesis && (
        <div className={styles.panelContent}>
          <section className={styles.thesisSummary}>
            <div className={styles.tickerRow}>
              <strong>{data.thesis.ticker}</strong>
              <span>{data.thesis.market}</span>
            </div>
            <p>{data.thesis.companyName}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className={styles.refreshSources} onClick={refreshAll} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : 'Refresh official sources'}
              </button>
              <button
                className={styles.refreshSources}
                onClick={triggerExport}
                style={{
                  backgroundColor: 'var(--color-bg-secondary, #333)',
                  color: '#fff',
                  border: '1px solid #555',
                }}
              >
                Export
              </button>
            </div>
            {data.ingestion && (
              <div className={styles.ingestionStatus}>
                <span>Daily refresh</span>
                <span>Next: {new Date(data.ingestion.nextScheduledAt).toLocaleString()}</span>
                {data.ingestion.lastRun && <span>Last: {data.ingestion.lastRun.status} Â· {data.ingestion.lastRun.newDocumentCount} new document(s)</span>}
                {data.ingestion.lastRun?.error && <span>{data.ingestion.lastRun.errorCode}: {data.ingestion.lastRun.error}</span>}
              </div>
            )}
          </section>

          {data.items.map((item) => (
            <article className={styles.researchCard} key={item.job.id}>
              <div className={styles.cardHeader}>
                <span className={`${styles.statusBadge} ${styles[`status_${item.job.status}`]}`}>
                  {item.job.status}
                </span>
                <span className={styles.attempts}>
                  {item.job.sourceMode === 'live' ? 'Live official source' : 'Synthetic fixture'} · Attempt {item.job.attemptCount}
                </span>
              </div>
              <h3>{item.statement}</h3>
              <p className={styles.muted}>Assumption: {item.assumptionStatus}</p>
              {(item.job.status === 'queued' || item.job.status === 'running') && (
                <p className={styles.muted}>
                  Checking {item.job.sourceMode === 'live' ? 'the live official source' : 'the synthetic official-source fixture'}…
                </p>
              )}
              {item.job.error && (
                <div className={styles.jobError}>
                  {item.job.errorCode && <strong>{item.job.errorCode}</strong>}
                  <p>{item.job.error}</p>
                  <button onClick={() => retry(item.job.id)}>Retry</button>
                </div>
              )}
              {item.evidence.map((record) => (
                <div className={styles.evidence} key={record.id}>
                  <span className={`${styles.verifiedBadge} ${styles[`verified_${record.verificationStatus}`]}`}>
                    {evidenceBadge(record.verificationStatus)}
                  </span>
                  <blockquote>“{record.exactQuote}”</blockquote>
                  {evidenceWarning(record.verificationStatus) && (
                    <p className={styles.evidenceWarning}>{evidenceWarning(record.verificationStatus)}</p>
                  )}
                  <p>{record.impactSummary}</p>
                  <dl>
                    <div><dt>Source</dt><dd><a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceName}</a></dd></div>
                    <div><dt>Tier</dt><dd>{record.sourceTier}</dd></div>
                    <div><dt>Published</dt><dd>{record.publishDate ?? 'Not supplied'}</dd></div>
                    <div><dt>Retrieved</dt><dd>{new Date(record.retrievalTimestamp).toLocaleString()}</dd></div>
                    <div><dt>Format</dt><dd>{record.sourceFormat}{record.sourceVariant ? `/${record.sourceVariant}` : ''} · {record.contentKind} · {record.extractionMethod}</dd></div>
                    {record.pageNumber && <div><dt>Page</dt><dd>{record.pageNumber}</dd></div>}
                    {record.boundingBox && <div><dt>Box</dt><dd>{record.boundingBox}</dd></div>}
                    <div><dt>Interpretation</dt><dd>{record.interpretationStatus}</dd></div>
                  </dl>
                </div>
              ))}
            </article>
          ))}

          {/* Decision Library section */}
          <section className={styles.thesisSummary} style={{ borderTop: '1px solid #444', marginTop: '24px', paddingTop: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#fff' }}>Decision Library</h3>
            
            {data.decisions.length === 0 ? (
              <p className={styles.muted} style={{ fontSize: '0.875rem' }}>No decisions recorded yet for this thesis.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {data.decisions.map((dec) => (
                  <div key={dec.id} style={{ backgroundColor: '#222', padding: '12px', borderRadius: '6px', fontSize: '0.875rem', borderLeft: '3px solid #ff4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ color: '#fff' }}>
                        {dec.outcome} {dec.optionalAction ? `(${dec.optionalAction})` : ''}
                      </strong>
                      <span className={styles.muted} style={{ fontSize: '0.75rem' }}>
                        {new Date(dec.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#ccc' }}>{dec.userReasoning}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={recordUserDecision} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>Record New Decision</h4>
                <button
                  type="button"
                  onClick={getSystemRecommendation}
                  disabled={analyzing}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    backgroundColor: 'var(--color-bg-secondary, #333)',
                    color: '#ff4444',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {analyzing ? 'Analyzing…' : '🪄 Ask AI Analyst'}
                </button>
              </div>

              {recommendation && (
                <div style={{ backgroundColor: '#111', border: '1px dashed #ff4444', padding: '12px', borderRadius: '4px', fontSize: '0.875rem', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                    <strong style={{ color: '#ff4444' }}>AI Suggestion:</strong>
                    <button
                      type="button"
                      onClick={applyRecommendation}
                      style={{
                        fontSize: '0.725rem',
                        padding: '2px 6px',
                        backgroundColor: '#ff4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      Apply
                    </button>
                  </div>
                  <p style={{ margin: '0 0 6px 0', color: '#fff', fontWeight: 'bold' }}>
                    {recommendation.recommendedOutcome}
                    {recommendation.recommendedAction ? ` (${recommendation.recommendedAction})` : ''}
                  </p>
                  <p style={{ margin: 0, color: '#ccc', fontSize: '0.8rem', lineHeight: '1.4', fontStyle: 'italic' }}>{recommendation.rationale}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="outcome-select" style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Outcome</label>
                  <select
                    id="outcome-select"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as DecisionOutcome)}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                  >
                    <option value="No Change">No Change</option>
                    <option value="Investigate Further">Investigate Further</option>
                    <option value="Update Thesis">Update Thesis</option>
                    <option value="Archive">Archive</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="action-select" style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>Optional Action</label>
                  <select
                    id="action-select"
                    value={optionalAction || ''}
                    onChange={(e) => setOptionalAction(e.target.value ? (e.target.value as DecisionAction) : null)}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                  >
                    <option value="">None</option>
                    <option value="Buy">Buy</option>
                    <option value="Hold">Hold</option>
                    <option value="Reduce">Reduce</option>
                    <option value="Exit">Exit</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="reasoning-textarea" style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>User Reasoning / Rationale</label>
                <textarea
                  id="reasoning-textarea"
                  rows={3}
                  value={userReasoning}
                  onChange={(e) => setUserReasoning(e.target.value)}
                  placeholder="Explain the reasoning..."
                  style={{ width: '100%', padding: '8px', backgroundColor: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>
              <button
                type="submit"
                disabled={recording}
                style={{
                  padding: '8px',
                  backgroundColor: '#ff4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {recording ? 'Recording…' : 'Record Decision'}
              </button>
            </form>
          </section>
        </div>
      )}
    </aside>
  );
}
