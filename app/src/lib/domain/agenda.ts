import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { decisionLabel, deriveStatusFromDecisionHistory, latestDecision } from "@/lib/domain/decisions";
import { formatThesisRefLabel } from "@/lib/domain/evidence";
import type {
  Analysis,
  AnalysisStatus,
  AssetType,
  DecisionEntry,
  EvidenceItem,
  PortfolioAnalysis,
  PortfolioMetrics,
  ThesisMemory,
} from "@/lib/domain/types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const AGENDA_STALE_THRESHOLD_MS = 7 * DAY_MS;

const STOP_WORDS = new Set([
  "after",
  "against",
  "around",
  "asset",
  "basis",
  "before",
  "between",
  "business",
  "change",
  "company",
  "could",
  "current",
  "decision",
  "equity",
  "first",
  "focus",
  "holding",
  "latest",
  "macro",
  "market",
  "needs",
  "other",
  "portfolio",
  "position",
  "price",
  "review",
  "should",
  "since",
  "still",
  "their",
  "there",
  "these",
  "thesis",
  "value",
  "watch",
  "where",
  "which",
]);

export type AgendaTarget = { kind: "analysis" | "portfolio"; id: string };
export type AgendaReasonCategory =
  | "review_due"
  | "stale_thesis"
  | "thesis_breaker_pressure"
  | "contradiction_pressure"
  | "valuation_drift"
  | "conviction_review"
  | "shared_macro_exposure"
  | "decision_follow_up";

export type AgendaFilter =
  | "all"
  | "due_now"
  | "stale"
  | "contradictory_evidence"
  | "valuation_drift"
  | "shared_exposure"
  | "watching"
  | "decided"
  | "archived";

export interface AgendaReason {
  category: AgendaReasonCategory;
  message: string;
  score: number;
  refs: {
    thesisTarget?: string;
    thesisId?: string | null;
    evidenceId?: string;
    decisionId?: string;
    relatedTargetIds?: string[];
  };
}

export interface AgendaItem {
  target: AgendaTarget;
  title: string;
  assetType: AssetType | "portfolio";
  status: AnalysisStatus;
  latestDecisionSummary: string | null;
  reviewDueAt: number | null;
  followUpDueAt: number | null;
  reasons: AgendaReason[];
  priorityScore: number;
}

interface DraftAgendaItem extends AgendaItem {
  _exposures: Set<string>;
  _memberIds: Set<string>;
}

export function deriveAgendaItems(
  analyses: Analysis[],
  portfolios: PortfolioAnalysis[],
  now = Date.now(),
): AgendaItem[] {
  const byId = new Map(analyses.map((analysis) => [analysis.id, analysis] as const));
  const drafts: DraftAgendaItem[] = [
    ...analyses.map((analysis) => deriveAnalysisAgendaItem(analysis, now)),
    ...portfolios.map((portfolio) => derivePortfolioAgendaItem(portfolio, byId, now)),
  ];

  applySharedExposureReasons(drafts, now);

  return drafts
    .map(finalizeAgendaItem)
    .filter((item) => item.reasons.length > 0)
    .sort(compareAgendaItems);
}

export function filterAgendaItems(items: AgendaItem[], filter: AgendaFilter, now = Date.now()): AgendaItem[] {
  if (filter === "all") return items;
  return items.filter((item) => agendaItemMatchesFilter(item, filter, now));
}

export function agendaItemMatchesFilter(item: AgendaItem, filter: AgendaFilter, now = Date.now()): boolean {
  if (filter === "watching" || filter === "decided" || filter === "archived") return item.status === filter;
  if (filter === "due_now") return isOverdue(item.reviewDueAt, now) || isOverdue(item.followUpDueAt, now);
  if (filter === "stale") return item.reasons.some((reason) => reason.category === "stale_thesis");
  if (filter === "contradictory_evidence") {
    return item.reasons.some((reason) => reason.category === "contradiction_pressure");
  }
  if (filter === "valuation_drift") {
    return item.reasons.some((reason) => reason.category === "valuation_drift");
  }
  if (filter === "shared_exposure") {
    return item.reasons.some((reason) => reason.category === "shared_macro_exposure");
  }
  return true;
}

function deriveAnalysisAgendaItem(analysis: Analysis, now: number): DraftAgendaItem {
  const status = deriveStatusFromDecisionHistory(analysis.decisionHistory);
  const latest = latestDecision(analysis.decisionHistory);
  const reasons: AgendaReason[] = [];
  const reviewDueAt = analysis.ic.review.nextReviewDue;
  const followUpDueAt = latest?.trigger?.dueAt ?? null;

  pushIfPresent(reasons, buildReviewReason(reviewDueAt, now));
  pushIfPresent(reasons, buildStaleReason(reviewDueAt, now));
  pushIfPresent(reasons, buildDecisionFollowUpReason(latest, now));
  pushIfPresent(reasons, buildContradictionReason(analysis.evidence, analysis.ic.thesis, now));
  pushIfPresent(reasons, buildBreakerPressureReason(analysis, now));
  pushIfPresent(reasons, buildAnalysisValuationDriftReason(analysis, latest));
  pushIfPresent(reasons, buildConvictionReviewReason(analysis, reviewDueAt, now));

  return {
    target: { kind: "analysis", id: analysis.id },
    title: analysis.assetName || analysis.title,
    assetType: analysis.assetType,
    status,
    latestDecisionSummary: latest ? decisionLabel(latest).replaceAll("_", " ") : null,
    reviewDueAt,
    followUpDueAt,
    reasons,
    priorityScore: 0,
    _exposures: gatherAnalysisExposureTokens(analysis),
    _memberIds: new Set<string>(),
  };
}

function derivePortfolioAgendaItem(
  portfolio: PortfolioAnalysis,
  byId: Map<string, Analysis>,
  now: number,
): DraftAgendaItem {
  const status = deriveStatusFromDecisionHistory(portfolio.decisionHistory);
  const latest = latestDecision(portfolio.decisionHistory);
  const metrics = computePortfolioMetrics(portfolio.members, byId);
  const reasons: AgendaReason[] = [];

  pushIfPresent(reasons, buildDecisionFollowUpReason(latest, now));
  pushIfPresent(reasons, buildPortfolioValuationDriftReason(portfolio, metrics, latest));

  return {
    target: { kind: "portfolio", id: portfolio.id },
    title: portfolio.title,
    assetType: "portfolio",
    status,
    latestDecisionSummary: latest ? decisionLabel(latest).replaceAll("_", " ") : null,
    reviewDueAt: null,
    followUpDueAt: latest?.trigger?.dueAt ?? null,
    reasons,
    priorityScore: 0,
    _exposures: gatherPortfolioExposureTokens(portfolio, byId),
    _memberIds: new Set(portfolio.members.map((member) => member.analysisId)),
  };
}

function finalizeAgendaItem(item: DraftAgendaItem): AgendaItem {
  const reasons = [...item.reasons].sort((a, b) => b.score - a.score || a.message.localeCompare(b.message));
  const priorityScore = reasons.reduce((sum, reason) => sum + reason.score, 0);
  return {
    target: item.target,
    title: item.title,
    assetType: item.assetType,
    status: item.status,
    latestDecisionSummary: item.latestDecisionSummary,
    reviewDueAt: item.reviewDueAt,
    followUpDueAt: item.followUpDueAt,
    reasons,
    priorityScore,
  };
}

function compareAgendaItems(a: AgendaItem, b: AgendaItem): number {
  const dueA = earliestDueAt(a);
  const dueB = earliestDueAt(b);
  if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
  if (dueA !== dueB) return dueA - dueB;
  return a.title.localeCompare(b.title);
}

function earliestDueAt(item: AgendaItem): number {
  const dueCandidates = [item.followUpDueAt, item.reviewDueAt].filter((value): value is number => typeof value === "number");
  if (dueCandidates.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...dueCandidates);
}

function buildReviewReason(reviewDueAt: number | null, now: number): AgendaReason | null {
  if (!isOverdue(reviewDueAt, now)) return null;
  const overdueDays = daysOverdue(reviewDueAt as number, now);
  return {
    category: "review_due",
    message: `Review overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}.`,
    score: 105 + Math.min(overdueDays, 21),
    refs: {},
  };
}

function buildStaleReason(reviewDueAt: number | null, now: number): AgendaReason | null {
  if (typeof reviewDueAt !== "number") return null;
  const staleAt = reviewDueAt + AGENDA_STALE_THRESHOLD_MS;
  if (now < staleAt) return null;
  const staleDays = Math.max(1, Math.ceil((now - staleAt) / DAY_MS));
  return {
    category: "stale_thesis",
    message: `Thesis is stale by ${staleDays} day${staleDays === 1 ? "" : "s"} past the grace window.`,
    score: 130 + Math.min(staleDays, 21),
    refs: {},
  };
}

function buildDecisionFollowUpReason(latest: DecisionEntry | null, now: number): AgendaReason | null {
  if (!latest?.trigger?.dueAt || latest.review) return null;
  if (!isOverdue(latest.trigger.dueAt, now)) return null;
  const overdueDays = daysOverdue(latest.trigger.dueAt, now);
  return {
    category: "decision_follow_up",
    message: `Last decision follow-up overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}: ${latest.trigger.note}.`,
    score: 140 + Math.min(overdueDays, 30),
    refs: { decisionId: latest.id },
  };
}

function buildContradictionReason(evidence: EvidenceItem[], thesis: ThesisMemory, now: number): AgendaReason | null {
  const contradictory = evidence.filter((item) => item.relation === "contradictory");
  const unresolved = evidence.filter((item) => item.relation === "unresolved");
  if (contradictory.length === 0 && unresolved.length < 2) return null;

  const lead = contradictory[0] ?? unresolved[0];
  const leadRef = lead?.thesisRefs[0];
  const thesisLabel = leadRef ? formatThesisRefLabel(leadRef, thesis) : "the thesis";
  const recentBonus = contradictory.some((item) => now - item.updatedAt < 14 * DAY_MS) ? 6 : 0;
  const score = 82 + contradictory.length * 12 + unresolved.length * 5 + recentBonus;
  const message =
    contradictory.length > 0
      ? `${contradictory.length} contradictory evidence item${contradictory.length === 1 ? "" : "s"} challenge ${thesisLabel}.`
      : `${unresolved.length} unresolved evidence item${unresolved.length === 1 ? "" : "s"} still need classification.`;

  return {
    category: "contradiction_pressure",
    message,
    score,
    refs: {
      evidenceId: lead?.id,
      thesisTarget: leadRef?.target,
      thesisId: leadRef?.id ?? null,
    },
  };
}

function buildBreakerPressureReason(analysis: Analysis, now: number): AgendaReason | null {
  const breakers = analysis.ic.thesis.thesisBreakers;
  if (breakers.length === 0) return null;
  const contradictory = analysis.evidence.filter((item) => item.relation === "contradictory").length;
  const unresolvedWatch = analysis.ic.thesis.watchItems.filter((item) => {
    const itemAge = now - item.createdAt;
    return itemAge > AGENDA_STALE_THRESHOLD_MS;
  }).length;
  if (contradictory === 0 && unresolvedWatch === 0) return null;

  const lead = breakers[0];
  const severityBonus =
    lead.severity === "fatal" ? 28 : lead.severity === "material" ? 18 : 9;

  return {
    category: "thesis_breaker_pressure",
    message: `Breaker pressure on "${lead.text}" with ${contradictory} contradictory evidence item${contradictory === 1 ? "" : "s"} and ${unresolvedWatch} stale watch item${unresolvedWatch === 1 ? "" : "s"}.`,
    score: 90 + severityBonus + contradictory * 8 + unresolvedWatch * 4,
    refs: {
      thesisTarget: "breaker",
      thesisId: lead.id,
    },
  };
}

function buildConvictionReviewReason(
  analysis: Analysis,
  reviewDueAt: number | null,
  now: number,
): AgendaReason | null {
  const conviction = analysis.ic.thesis.conviction;
  if (!conviction) return null;
  const contradictory = analysis.evidence.filter((item) => item.relation === "contradictory").length;
  const stale = typeof reviewDueAt === "number" && now >= reviewDueAt + AGENDA_STALE_THRESHOLD_MS;
  const weakEvidence = analysis.evidence.length < 2;
  if (!stale && contradictory === 0 && !weakEvidence) return null;

  const convictionBonus = conviction === "high" ? 12 : conviction === "medium" ? 6 : 2;
  const tension: string[] = [];
  if (stale) tension.push("stale review");
  if (contradictory > 0) tension.push("rising contradictions");
  if (weakEvidence) tension.push("thin evidence");

  return {
    category: "conviction_review",
    message: `${conviction.toUpperCase()} conviction needs review because of ${tension.join(", ")}.`,
    score: 62 + convictionBonus + contradictory * 5 + (stale ? 8 : 0) + (weakEvidence ? 4 : 0),
    refs: {},
  };
}

function buildAnalysisValuationDriftReason(analysis: Analysis, latest: DecisionEntry | null): AgendaReason | null {
  if (!latest || latest.snapshot.kind !== "analysis") return null;
  const previous = latest.snapshot.data;
  const prevStance = previous.stance?.label ?? null;
  const currentStance = analysis.stance?.label ?? null;
  if (prevStance !== currentStance && (prevStance || currentStance)) {
    return {
      category: "valuation_drift",
      message: `Valuation stance drifted from ${prevStance ?? "none"} to ${currentStance ?? "none"} since the latest decision.`,
      score: 86,
      refs: { decisionId: latest.id },
    };
  }

  if (analysis.valuationMode === "manual") {
    const before = previous.manualMeta?.valuationAmount;
    const after = analysis.manualMeta?.valuationAmount;
    const delta = relativeDelta(before, after);
    if (delta >= 0.15 && typeof before === "number" && typeof after === "number") {
      return {
        category: "valuation_drift",
        message: `Manual valuation moved ${formatPercent(delta)} since the latest decision.`,
        score: 74 + Math.round(delta * 100),
        refs: { decisionId: latest.id },
      };
    }
    return null;
  }

  const drift = strongestMetricDrift(previous.metrics?.metrics, analysis.metrics?.metrics);
  if (!drift) return null;
  return {
    category: "valuation_drift",
    message: `${drift.label} shifted from ${drift.beforeDisplay} to ${drift.afterDisplay} since the latest decision.`,
    score: 74 + Math.min(Math.round(drift.delta * 100), 25),
    refs: { decisionId: latest.id },
  };
}

function buildPortfolioValuationDriftReason(
  portfolio: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  latest: DecisionEntry | null,
): AgendaReason | null {
  if (!latest || latest.snapshot.kind !== "portfolio") return null;
  const previous = latest.snapshot.data;
  const prevStance = previous.stance?.label ?? null;
  const currentStance = portfolio.stance?.label ?? null;
  if (prevStance !== currentStance && (prevStance || currentStance)) {
    return {
      category: "valuation_drift",
      message: `Portfolio stance drifted from ${prevStance ?? "none"} to ${currentStance ?? "none"} since the latest decision.`,
      score: 84,
      refs: { decisionId: latest.id },
    };
  }

  const before = strongestPortfolioWeight(previous.metrics);
  const after = strongestPortfolioWeight(metrics);
  if (!before || !after) return null;
  const delta = Math.abs(after.weight - before.weight);
  if (delta < 0.1) return null;

  return {
    category: "valuation_drift",
    message: `Largest portfolio weight changed from ${Math.round(before.weight * 100)}% to ${Math.round(after.weight * 100)}% since the latest decision.`,
    score: 72 + Math.round(delta * 100),
    refs: { decisionId: latest.id },
  };
}

function strongestMetricDrift(
  before: Array<{ key: string; label: string; value: number; display: string }> | null | undefined,
  after: Array<{ key: string; label: string; value: number; display: string }> | null | undefined,
) {
  if (!before || !after) return null;
  const beforeByKey = new Map(before.map((metric) => [metric.key, metric]));
  let winner:
    | { label: string; beforeDisplay: string; afterDisplay: string; delta: number }
    | null = null;
  for (const metric of after) {
    const prior = beforeByKey.get(metric.key);
    if (!prior) continue;
    const delta = relativeDelta(prior.value, metric.value);
    if (delta < 0.15) continue;
    if (!winner || delta > winner.delta) {
      winner = {
        label: metric.label,
        beforeDisplay: prior.display,
        afterDisplay: metric.display,
        delta,
      };
    }
  }
  return winner;
}

function strongestPortfolioWeight(metrics: PortfolioMetrics) {
  return metrics.positions.reduce<(typeof metrics.positions)[number] | null>(
    (best, position) => (!best || position.weight > best.weight ? position : best),
    null,
  );
}

function relativeDelta(before: number | null | undefined, after: number | null | undefined): number {
  if (typeof before !== "number" || typeof after !== "number") return 0;
  if (!Number.isFinite(before) || !Number.isFinite(after)) return 0;
  const base = Math.max(Math.abs(before), 1);
  return Math.abs(after - before) / base;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function gatherAnalysisExposureTokens(analysis: Analysis): Set<string> {
  const tokens = new Set<string>();
  analysis.tags.forEach((tag) => addTextTokens(tokens, tag));
  addTextTokens(tokens, analysis.ic.thesis.summary);
  analysis.ic.thesis.assumptions.forEach((item) => addTextTokens(tokens, item.text));
  analysis.ic.thesis.watchItems.forEach((item) => addTextTokens(tokens, item.text));
  analysis.ic.thesis.valuationAssumptions.forEach((item) => addTextTokens(tokens, item.text));
  analysis.manualMeta?.macroDependencies.forEach((item) => addTextTokens(tokens, item));
  return tokens;
}

function gatherPortfolioExposureTokens(portfolio: PortfolioAnalysis, byId: Map<string, Analysis>): Set<string> {
  const tokens = new Set<string>();
  portfolio.tags.forEach((tag) => addTextTokens(tokens, tag));
  for (const member of portfolio.members) {
    const analysis = byId.get(member.analysisId);
    if (!analysis) continue;
    for (const token of gatherAnalysisExposureTokens(analysis)) tokens.add(token);
  }
  return tokens;
}

function addTextTokens(target: Set<string>, text: string | null | undefined) {
  if (!text) return;
  const parts = text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !STOP_WORDS.has(part));
  parts.forEach((part) => target.add(part));
}

function applySharedExposureReasons(items: DraftAgendaItem[], now: number) {
  for (const item of items) {
    const matches: Array<{ id: string; overlap: string[] }> = [];
    for (const other of items) {
      if (item.target.id === other.target.id && item.target.kind === other.target.kind) continue;
      if (item.target.kind === "portfolio" && item._memberIds.has(other.target.id)) continue;
      if (other.target.kind === "portfolio" && other._memberIds.has(item.target.id)) continue;
      const overlap = [...item._exposures].filter((token) => other._exposures.has(token)).slice(0, 3);
      if (overlap.length === 0) continue;
      matches.push({ id: `${other.target.kind}:${other.target.id}`, overlap });
    }
    if (matches.length === 0) continue;
    const leadTokens = [...new Set(matches.flatMap((match) => match.overlap))].slice(0, 3);
    item.reasons.push({
      category: "shared_macro_exposure",
      message: `Shares macro exposure with ${matches.length} other name${matches.length === 1 ? "" : "s"}: ${leadTokens.join(", ")}.`,
      score: 40 + matches.length * 6 + leadTokens.length * 4 + (now > 0 ? 0 : 0),
      refs: { relatedTargetIds: matches.map((match) => match.id) },
    });
  }
}

function isOverdue(dueAt: number | null | undefined, now: number): boolean {
  return typeof dueAt === "number" && dueAt <= now;
}

function daysOverdue(dueAt: number, now: number): number {
  return Math.max(1, Math.ceil((now - dueAt) / DAY_MS));
}

function pushIfPresent<T>(items: T[], value: T | null) {
  if (value) items.push(value);
}
