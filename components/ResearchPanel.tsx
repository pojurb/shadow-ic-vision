'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ResearchPanelDTO } from '@/lib/domain/contracts';
import styles from './Workspace.module.css';

const EMPTY_PANEL: ResearchPanelDTO = { thesis: null, items: [] };

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

  const load = useCallback(async () => {
    const response = await fetch(`/api/research?conversationId=${encodeURIComponent(conversationId)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load research.');
    setData(body);
    setError(null);
    return body as ResearchPanelDTO;
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
            <button className={styles.refreshSources} onClick={refreshAll} disabled={refreshing}>
              {refreshing ? 'Refreshingâ€¦' : 'Refresh official sources'}
            </button>
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
                  <span className={styles.verifiedBadge}>Exact source match</span>
                  <blockquote>“{record.exactQuote}”</blockquote>
                  <p>{record.impactSummary}</p>
                  <dl>
                    <div><dt>Source</dt><dd><a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceName}</a></dd></div>
                    <div><dt>Tier</dt><dd>{record.sourceTier}</dd></div>
                    <div><dt>Published</dt><dd>{record.publishDate ?? 'Not supplied'}</dd></div>
                    <div><dt>Retrieved</dt><dd>{new Date(record.retrievalTimestamp).toLocaleString()}</dd></div>
                    <div><dt>Format</dt><dd>{record.sourceFormat} · {record.extractionMethod}</dd></div>
                    {record.pageNumber && <div><dt>Page</dt><dd>{record.pageNumber}</dd></div>}
                    <div><dt>Interpretation</dt><dd>{record.interpretationStatus}</dd></div>
                  </dl>
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
