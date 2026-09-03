'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SECONDARY_ACCEPTANCE_UNAVAILABLE_REASON,
  secondaryEvidenceAcceptanceAvailable,
  type ResearchPanelDTO,
  type DecisionOutcome,
  type DecisionAction,
  type MeasurementOperator,
  type MeasurementUnit,
} from '@/lib/domain/contracts';
import type { OllamaModelId } from '@/lib/ai/ollama-models';
import styles from './Workspace.module.css';

const EMPTY_PANEL: ResearchPanelDTO = { thesis: null, items: [], decisions: [] };

// M011. Rendering helpers for the verdict block. Kept alongside the other pure
// label functions in this file rather than imported from `lib/research/verdict`,
// which is server-only.
const OPERATOR_WORD: Record<MeasurementOperator, string> = {
  gte: 'at least', gt: 'above', lte: 'at most', lt: 'below', eq: 'exactly',
  increases: 'an increase in', decreases: 'a decrease in', none: '',
};

const UNEVIDENCED_REASON_LABEL: Record<'job_pending' | 'job_failed' | 'no_candidate_passed_gate' | 'no_source_for_market' | 'no_source_identified', string> = {
  job_pending: 'research still running',
  job_failed: 'research failed',
  no_candidate_passed_gate: 'nothing retrieved cleared the verification gate',
  // This app has no structured-fact adapter for this market yet — not a
  // claim that the market itself publishes nothing (2026-09-03 correction:
  // IDX has required XBRL filings since 2015; what's missing is a bulk
  // queryable API this app can call, the same distinction route.ts:71 was
  // corrected on).
  no_source_for_market: 'this app has no structured-data adapter for this market yet',
  // M013 Q6. A user classification, not a computed inference — see
  // `source_adequacy_assessments`. Distinct from the row above: this is
  // per-assumption ("no one discloses this specific figure"), not a
  // blanket market-wide capability gap.
  no_source_identified: 'no public source identified for this claim, after review',
};

function formatValue(value: number, unit: MeasurementUnit): string {
  const rounded = Number(value.toFixed(2));
  if (unit === 'percent') return `${rounded}%`;
  if (unit === 'usd') return `$${rounded.toLocaleString('en-US')}`;
  if (unit === 'idr') return `Rp${rounded.toLocaleString('en-US')}`;
  return String(rounded);
}

// Percentage gaps read as basis points, because that is how they are discussed.
function formatDelta(delta: number, unit: MeasurementUnit): string {
  if (unit === 'percent') return `${Math.round(Math.abs(delta) * 100)}bps ${delta < 0 ? 'below' : 'above'}`;
  return `${formatValue(Math.abs(delta), unit)} ${delta < 0 ? 'below' : 'above'}`;
}

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

/**
 * M011. Direction, alongside the existing trust-class badge.
 *
 * `inconclusive` renders nothing rather than a neutral chip: it is the default
 * for every text-derived row, so badging it would put a meaningless label on
 * most of the panel and dilute the two labels that carry real information.
 */
function polarityBadge(record: ResearchPanelDTO['items'][number]['evidence'][number]): string | null {
  // Absent — not merely null — is a real case: an API response predating M011,
  // or a partial payload. Reading it defensively is what keeps a missing field
  // from white-screening the entire panel, which is how this was found (the
  // Playwright suite caught it against a pre-M011 route mock).
  if (!record.polarity || record.polarity === 'inconclusive') return null;
  const direction = record.polarity === 'contradicts' ? 'Contradicts' : 'Supports';
  const delta = record.deltaVsThreshold;
  if (typeof delta !== 'number' || !Number.isFinite(delta)) return direction;
  return `${direction} (${delta >= 0 ? '+' : ''}${Number(delta.toFixed(2))} vs threshold)`;
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
  const [alternativesText, setAlternativesText] = useState('');
  const [recording, setRecording] = useState(false);

  const [acceptingSecondaryEvidence, setAcceptingSecondaryEvidence] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    recommendedOutcome: 'No Change' | 'Investigate Further' | 'Update Thesis' | 'Archive';
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
      // VISION.md §7: the record must retain the relevant evidence — this
      // snapshots every evidence row currently shown for the thesis, since
      // that is what the user's reasoning was actually weighed against.
      const evidenceIds = data.items.flatMap((item) => item.evidence.map((e) => e.id));
      const alternatives = alternativesText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const response = await fetch(`/api/theses/${data.thesis.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, optionalAction, userReasoning, evidenceIds, alternatives }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to record decision.');

      setUserReasoning('');
      setAlternativesText('');
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

      {/*
        * M011. The thesis verdict and coverage ledger, rendered here —
        * immediately after the header and lexically OUTSIDE the
        * `.panelContent` wrapper below that holds the thesis summary and every
        * assumption card. Nothing inside that subtree can push these down,
        * which is the structural property: this block cannot be buried,
        * because burying it would require moving JSX, not writing text.
        *
        * Both objects are computed by pure functions server-side
        * (`lib/research/verdict.ts`, `lib/research/coverage.ts`) over persisted
        * polarity. No model produces them.
        */}
      {data.verdict && (
        <section
          className={`${styles.thesisVerdict} ${styles[`verdict_${data.verdict.level}`]}`}
          data-testid="thesis-verdict"
          aria-label="Thesis status"
        >
          <strong>{data.verdict.headline}</strong>
          {data.verdict.contradictions.map((contradiction) => (
            <p key={contradiction.evidenceId}>
              {contradiction.metric}: observed {formatValue(contradiction.observedValue, contradiction.unit)}
              {' '}versus the {OPERATOR_WORD[contradiction.operator]}{' '}
              {formatValue(contradiction.threshold, contradiction.unit)} this thesis requires
              {' '}({formatDelta(contradiction.deltaVsThreshold, contradiction.unit)}) —{' '}
              <a href={contradiction.sourceUrl} target="_blank" rel="noreferrer">{contradiction.sourceName}</a>
            </p>
          ))}
        </section>
      )}

      {data.coverage && data.coverage.totalAssumptions > 0 && (
        <section className={styles.coverageLedger} data-testid="coverage-ledger" aria-label="Evidence coverage">
          {/*
            * Leads with `supported`, not `evidenced`. `evidenced` counts an
            * assumption carrying any quote at all, of any polarity, so leading
            * with it reproduced here the same overstatement the verdict
            * headline was corrected for (2026-08-05): the ratio reads as
            * confirmation while `supported` may be zero.
            */}
          <strong>
            Evidence coverage: {data.coverage.supported} of {data.coverage.totalAssumptions} assumptions supported
            {data.coverage.contradicted > 0 ? ` · ${data.coverage.contradicted} contradicted` : ''}
          </strong>
          {data.coverage.inconclusiveOnly > 0 && (
            <p>
              {data.coverage.inconclusiveOnly} assumption
              {data.coverage.inconclusiveOnly === 1 ? ' has a quote' : 's have quotes'} verified verbatim
              from their source but never checked for relevance to the claim.
            </p>
          )}
          {/* Absence of evidence is stated by name, not left to be inferred
              from which cards happen to be empty. */}
          {data.coverage.unevidencedAssumptions.length > 0 && (
            <ul>
              {data.coverage.unevidencedAssumptions.map((gap) => (
                <li key={gap.assumptionId}>
                  {gap.statement} — <em>{UNEVIDENCED_REASON_LABEL[gap.reason]}</em>
                </li>
              ))}
            </ul>
          )}
          {data.coverage.unresolvedContracts > 0 && (
            <p>
              {data.coverage.unresolvedContracts} assumption
              {data.coverage.unresolvedContracts === 1 ? '' : 's'} cannot be measured as stated. A thesis
              created before measurement contracts existed has no basis to check evidence against —
              re-confirm it to record one.
            </p>
          )}
        </section>
      )}

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
              {/*
                * The acceptance control is withheld while relevance is
                * unassessed — see `secondaryEvidenceAcceptanceAvailable`, which
                * is the one place to flip when that changes. `confirmDraft`'s
                * server half refuses the request too, so this is not the only
                * guard. Showing the reason rather than a greyed-out button:
                * the user should know *why* nothing is being asked of them.
                */}
              {item.assumptionStatus === 'pending_confirmation' && (
                secondaryEvidenceAcceptanceAvailable() ? (
                  <button
                    className={styles.acceptSecondaryEvidenceButton}
                    onClick={() => acceptSecondaryEvidence(item.assumptionId)}
                    disabled={acceptingSecondaryEvidence === item.assumptionId}
                  >
                    {acceptingSecondaryEvidence === item.assumptionId ? 'Accepting…' : 'Accept secondary evidence'}
                  </button>
                ) : (
                  <p className={styles.muted}>{SECONDARY_ACCEPTANCE_UNAVAILABLE_REASON}</p>
                )
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
                  {polarityBadge(record) && (
                    <span
                      className={`${styles.verifiedBadge} ${styles[`polarity_${record.polarity}`]}`}
                      data-testid="polarity-badge"
                    >
                      {polarityBadge(record)}
                    </span>
                  )}
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
                    {dec.alternatives.length > 0 && (
                      <p className={styles.decisionAlternatives}>
                        Alternatives considered: {dec.alternatives.join('; ')}
                      </p>
                    )}
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
                  // M011. Under a suppressed confidence gate the confident
                  // artifact cannot even be requested. The schema narrowing in
                  // `generateDecisionRecommendation` is the real control; this
                  // just avoids offering the user something the system has
                  // already established it cannot answer honestly.
                  disabled={analyzing || data.coverage?.confidenceGate === 'suppressed'}
                  className={styles.aiAnalystButton}
                >
                  {analyzing ? 'Analyzing…' : '🪄 Ask AI Analyst'}
                </button>
              </div>
              {data.coverage?.confidenceGate === 'suppressed' && (
                <p className={styles.coverageSuppressionNote}>
                  A recommendation is unavailable while the evidence base is this thin — too many
                  assumptions are unevidenced or cannot be measured as stated.
                </p>
              )}

              {recommendation && (
                <div className={styles.recommendationBox}>
                  <div className={styles.recommendationHeader}>
                    <strong className={styles.recommendationLabel}>Evidence Assessment:</strong>
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
              <div>
                <label htmlFor="alternatives-textarea" className={styles.decisionFieldLabel}>Known Alternatives Considered (one per line, optional)</label>
                <textarea
                  id="alternatives-textarea"
                  rows={2}
                  value={alternativesText}
                  onChange={(e) => setAlternativesText(e.target.value)}
                  placeholder="e.g. Wait for next quarter's filing before deciding"
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
