'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ResearchPanelDTO, DecisionOutcome, DecisionAction } from '@/lib/domain/contracts';
import type { OllamaModelId } from '@/lib/ai/ollama-models';
import styles from './Workspace.module.css';

const EMPTY_PANEL: ResearchPanelDTO = { thesis: null, items: [], decisions: [] };

function evidenceBadge(status: ResearchPanelDTO['items'][number]['evidence'][number]['verificationStatus']) {
  if (status === 'ocr_matched') return 'OCR matched';
  if (status === 'derived') return 'Derived';
  if (status === 'secondary_issuer') return 'Secondary: Issuer PR';
  if (status === 'secondary_news') return 'Secondary: News Wire';
  return 'Exact source match';
}

function evidenceWarning(status: ResearchPanelDTO['items'][number]['evidence'][number]['verificationStatus']) {
  if (status === 'ocr_matched') return 'OCR evidence is matched to retained OCR text, not source-exact document text.';
  if (status === 'derived') return 'Derived evidence is calculated or parsed from retained inputs and must keep its method visible.';
  if (status === 'secondary_issuer') return 'Secondary evidence from a company press release. Not an official filing; interpretation and official confirmation remain pending.';
  if (status === 'secondary_news') return 'Secondary evidence from a curated news wire. Not an official filing; interpretation and official confirmation remain pending.';
  return null;
}

// M007. Assumption-level status badge, mirroring evidenceBadge's shape —
// today's plain-text rendering is the only status without one.
function assumptionStatusBadge(status: ResearchPanelDTO['items'][number]['assumptionStatus']) {
  if (status === 'pending_confirmation') return 'Pending confirmation';
  if (status === 'user_confirmed_secondary') return 'User-confirmed (secondary)';
  if (status === 'verified') return 'Verified';
  if (status === 'challenged') return 'Challenged';
  if (status === 'held-belief') return 'Held belief';
  return 'Untested';
}

// R-018. The flag rides in the evidence `metadata` JSON column; unparseable
// metadata is treated as unflagged rather than throwing in render.
function hasEmbeddedInstruction(metadata: string | null): boolean {
  if (!metadata) return false;
  try {
    const parsed: unknown = JSON.parse(metadata);
    return typeof parsed === 'object'
      && parsed !== null
      && (parsed as { untrustedInstructionFlagged?: unknown }).untrustedInstructionFlagged === true;
  } catch {
    return false;
  }
}

function normalizePanelData(input: ResearchPanelDTO): ResearchPanelDTO {
  return {
    ...input,
    items: input.items ?? [],
    decisions: input.decisions ?? [],
  };
}

// M008 Slice 4. Plain labels, not badges with their own CSS classes like
// evidenceBadge/assumptionStatusBadge above — discovery candidates are a
// much lighter-weight, denser list (potentially many rows) than evidence
// cards, so this stays a compact single-line label per row.
function discoveryStatusLabel(status: 'pending' | 'fetched' | 'unreachable' | 'rejected', rejectionReason: string | null): string {
  if (status === 'fetched') return 'Fetched — classified as secondary evidence';
  if (status === 'pending') return 'Pending — awaiting promotion';
  if (status === 'unreachable') return 'Unreachable';
  if (rejectionReason === 'domain_not_allowlisted') return 'Not allowlisted — add this domain to promote it';
  return rejectionReason ?? 'Rejected';
}

export function ResearchPanel({
  conversationId,
  refreshVersion,
  open,
  modelId,
  onClose,
}: {
  conversationId: string;
  refreshVersion: number;
  open: boolean;
  modelId: OllamaModelId;
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

  const [acceptingSecondaryEvidence, setAcceptingSecondaryEvidence] = useState<string | null>(null);

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
      const response = await fetch(`/api/theses/${data.thesis.id}/recommendation?modelId=${encodeURIComponent(modelId)}`);
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

  // M007 Slice 5/6. Explicit user acceptance of a secondary-only assumption
  // (clearing path 2) — lands on 'user_confirmed_secondary', never
  // 'verified', so the badge stays visibly distinct even after acceptance.
  const acceptSecondaryEvidence = async (assumptionId: string) => {
    setAcceptingSecondaryEvidence(assumptionId);
    setError(null);
    try {
      const response = await fetch(`/api/assumptions/${assumptionId}/accept-secondary-evidence`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to accept secondary evidence.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to accept secondary evidence.');
    } finally {
      setAcceptingSecondaryEvidence(null);
    }
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
              <p className={styles.muted}>
                Assumption:{' '}
                <span className={`${styles.statusBadge} ${styles[`status_${item.assumptionStatus.replace('-', '_')}`] ?? ''}`}>
                  {assumptionStatusBadge(item.assumptionStatus)}
                </span>
              </p>
              {item.assumptionStatus === 'pending_confirmation' && (
                <button
                  className={styles.acceptSecondaryEvidenceButton}
                  onClick={() => acceptSecondaryEvidence(item.assumptionId)}
                  disabled={acceptingSecondaryEvidence === item.assumptionId}
                >
                  {acceptingSecondaryEvidence === item.assumptionId ? 'Accepting…' : 'Accept secondary evidence'}
                </button>
              )}
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
                  {hasEmbeddedInstruction(record.metadata) && (
                    <p className={styles.evidenceInjectionWarning}>
                      This source contained embedded instruction text aimed at the model. It was withheld from
                      model prompts and must not be treated as guidance.
                    </p>
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

          {/* M008 Slice 4. Discovery Candidates — web-search-discovered URLs
              for this ticker, most-recent first, with plain-language status
              so a "domain_not_allowlisted" row tells the user exactly what
              to do (copy the URL's domain into .env) rather than showing a
              terse code. */}
          {data.discoverySummary && data.discoverySummary.candidates.length > 0 && (
            <section className={styles.thesisSummary}>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>Discovery Candidates</h3>
              <p className={styles.muted} style={{ fontSize: '13px', marginBottom: '12px' }}>
                URLs found by web search for this ticker. A candidate only becomes evidence once its
                domain is added to the issuer press-release or news-wire allowlist.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...data.discoverySummary.candidates].reverse().map((candidate) => (
                  <div
                    key={candidate.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #333',
                      background: '#242424',
                    }}
                  >
                    <a
                      href={candidate.candidateUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#93c5fd', fontSize: '13px', wordBreak: 'break-all' }}
                    >
                      {candidate.candidateUrl}
                    </a>
                    <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#c7c7c7' }}>
                      {discoveryStatusLabel(candidate.status, candidate.rejectionReason)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Decision Library section */}
          <section className={`${styles.thesisSummary} ${styles.decisionLibrary}`}>
            <h3 className={styles.decisionLibraryTitle}>Decision Library</h3>

            {data.decisions.length === 0 ? (
              <p className={styles.muted} style={{ fontSize: '0.875rem' }}>No decisions recorded yet for this thesis.</p>
            ) : (
              <div className={styles.decisionList}>
                {[...data.decisions].reverse().map((dec) => (
                  <div key={dec.id} className={styles.decisionCard}>
                    <div className={styles.decisionCardHeader}>
                      <strong className={styles.decisionCardOutcome}>
                        {dec.outcome} {dec.optionalAction ? `(${dec.optionalAction})` : ''}
                      </strong>
                      <span className={`${styles.muted} ${styles.decisionCardTimestamp}`}>
                        {new Date(dec.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {dec.previousAction !== undefined && dec.previousAction !== dec.optionalAction && (
                      <p className={styles.decisionDelta}>
                        changed from {dec.previousAction ?? 'None'}
                      </p>
                    )}
                    <p className={styles.decisionReasoning}>{dec.userReasoning}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={recordUserDecision} className={styles.decisionForm}>
              <div className={styles.decisionFormHeader}>
                <h4 className={styles.decisionFormTitle}>Record New Decision</h4>
                <button
                  type="button"
                  onClick={getSystemRecommendation}
                  disabled={analyzing}
                  className={styles.aiAnalystButton}
                >
                  {analyzing ? 'Analyzing…' : '🪄 Ask AI Analyst'}
                </button>
              </div>

              {recommendation && (
                <div className={styles.recommendationBox}>
                  <div className={styles.recommendationHeader}>
                    <strong className={styles.recommendationLabel}>AI Suggestion:</strong>
                    <button
                      type="button"
                      onClick={applyRecommendation}
                      className={styles.applyRecommendationButton}
                    >
                      Apply
                    </button>
                  </div>
                  <p className={styles.recommendationOutcome}>
                    {recommendation.recommendedOutcome}
                    {recommendation.recommendedAction ? ` (${recommendation.recommendedAction})` : ''}
                  </p>
                  <p className={styles.recommendationRationale}>{recommendation.rationale}</p>
                </div>
              )}
              <div className={styles.decisionFieldRow}>
                <div className={styles.decisionField}>
                  <label htmlFor="outcome-select" className={styles.decisionFieldLabel}>Outcome</label>
                  <select
                    id="outcome-select"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as DecisionOutcome)}
                    className={styles.decisionSelect}
                  >
                    <option value="No Change">No Change</option>
                    <option value="Investigate Further">Investigate Further</option>
                    <option value="Update Thesis">Update Thesis</option>
                    <option value="Archive">Archive</option>
                  </select>
                </div>
                <div className={styles.decisionField}>
                  <label htmlFor="action-select" className={styles.decisionFieldLabel}>Optional Action</label>
                  <select
                    id="action-select"
                    value={optionalAction || ''}
                    onChange={(e) => setOptionalAction(e.target.value ? (e.target.value as DecisionAction) : null)}
                    className={styles.decisionSelect}
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
                <label htmlFor="reasoning-textarea" className={styles.decisionFieldLabel}>User Reasoning / Rationale</label>
                <textarea
                  id="reasoning-textarea"
                  rows={3}
                  value={userReasoning}
                  onChange={(e) => setUserReasoning(e.target.value)}
                  placeholder="Explain the reasoning..."
                  className={styles.decisionTextarea}
                />
              </div>
              <button
                type="submit"
                disabled={recording}
                className={styles.recordDecisionButton}
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
