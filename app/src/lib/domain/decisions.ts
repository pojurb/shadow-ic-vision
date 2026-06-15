import type {
  Analysis,
  AnalysisDecisionSnapshot,
  AnalysisStatus,
  Decision,
  DecisionAction,
  DecisionEntry,
  DecisionOutcomeReview,
  ICAction,
  PortfolioAnalysis,
  PortfolioDecisionSnapshot,
  PortfolioMetrics,
} from "@/lib/domain/types";

export interface DecisionDraft {
  action: ICAction;
  rationale: string;
  preMortem?: string;
  triggerDueAt?: number | null;
  triggerNote?: string;
}

export interface DecisionValidationResult {
  valid: boolean;
  errors: Partial<Record<"rationale" | "preMortem" | "triggerDueAt" | "triggerNote", string>>;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isDecisionAction(value: unknown): value is DecisionAction {
  return value === "APPROVE" || value === "HOLD" || value === "REJECT";
}

function isICAction(value: unknown): value is ICAction {
  return (
    value === "no_action" ||
    value === "watch" ||
    value === "research_more" ||
    value === "increase_conviction" ||
    value === "decrease_conviction" ||
    value === "add_increase_position" ||
    value === "trim_reduce_position" ||
    value === "exit" ||
    value === "archive"
  );
}

export function validateDecisionDraft(draft: DecisionDraft): DecisionValidationResult {
  const errors: DecisionValidationResult["errors"] = {};
  if (!draft.rationale.trim()) errors.rationale = "Rationale is required.";
  if (draft.action === "add_increase_position" && !draft.preMortem?.trim()) {
    errors.preMortem = "Pre-mortem is required for add/increase decisions.";
  }
  if (draft.action !== "archive") {
    if (typeof draft.triggerDueAt !== "number" || !Number.isFinite(draft.triggerDueAt)) {
      errors.triggerDueAt = "Review trigger date is required.";
    }
    if (!draft.triggerNote?.trim()) errors.triggerNote = "Review trigger note is required.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildAnalysisDecisionSnapshot(analysis: Analysis, capturedAt = Date.now()): AnalysisDecisionSnapshot {
  return {
    title: analysis.title,
    assetType: analysis.assetType,
    vertical: analysis.vertical,
    thesis: clone(analysis.ic.thesis),
    review: clone(analysis.ic.review),
    metrics: clone(analysis.metrics),
    stance: clone(analysis.stance),
    sources: clone(analysis.sources),
    evidence: clone(analysis.evidence),
    evidenceCandidates: clone(analysis.ic.thesis.evidenceCandidates),
    capturedAt,
  };
}

export function buildPortfolioDecisionSnapshot(
  portfolio: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  capturedAt = Date.now(),
): PortfolioDecisionSnapshot {
  return {
    title: portfolio.title,
    members: clone(portfolio.members),
    positions: clone(metrics.positions),
    metrics: clone(metrics),
    stance: clone(portfolio.stance),
    tags: clone(portfolio.tags),
    capturedAt,
  };
}

export function createAnalysisDecisionEntry(
  analysis: Analysis,
  draft: DecisionDraft,
  now = Date.now(),
): DecisionEntry {
  const validation = validateDecisionDraft(draft);
  if (!validation.valid) throw new Error(Object.values(validation.errors)[0] ?? "Invalid decision.");
  return {
    id: crypto.randomUUID(),
    decidedAt: now,
    action: draft.action,
    rationale: draft.rationale.trim(),
    preMortem: draft.action === "add_increase_position" ? draft.preMortem?.trim() : undefined,
    trigger:
      draft.action === "archive"
        ? null
        : { dueAt: draft.triggerDueAt as number, note: draft.triggerNote?.trim() ?? "" },
    snapshot: { kind: "analysis", data: buildAnalysisDecisionSnapshot(analysis, now) },
    review: null,
  };
}

export function createPortfolioDecisionEntry(
  portfolio: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  draft: DecisionDraft,
  now = Date.now(),
): DecisionEntry {
  const validation = validateDecisionDraft(draft);
  if (!validation.valid) throw new Error(Object.values(validation.errors)[0] ?? "Invalid decision.");
  return {
    id: crypto.randomUUID(),
    decidedAt: now,
    action: draft.action,
    rationale: draft.rationale.trim(),
    preMortem: draft.action === "add_increase_position" ? draft.preMortem?.trim() : undefined,
    trigger:
      draft.action === "archive"
        ? null
        : { dueAt: draft.triggerDueAt as number, note: draft.triggerNote?.trim() ?? "" },
    snapshot: { kind: "portfolio", data: buildPortfolioDecisionSnapshot(portfolio, metrics, now) },
    review: null,
  };
}

export function normalizeDecisionHistory(raw: unknown, legacyDecision?: Decision | null): DecisionEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is Partial<DecisionEntry> => !!entry && typeof entry === "object")
      .map((entry, index) => normalizeDecisionEntry(entry, index));
  }
  if (legacyDecision?.action) return [legacyDecisionEntry(legacyDecision)];
  return [];
}

function normalizeDecisionEntry(entry: Partial<DecisionEntry>, index: number): DecisionEntry {
  const decidedAt = typeof entry.decidedAt === "number" ? entry.decidedAt : Date.now();
  const legacyAction = isDecisionAction(entry.legacyAction) ? entry.legacyAction : undefined;
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : `decision-${decidedAt}-${index}`,
    decidedAt,
    action: isICAction(entry.action) ? entry.action : null,
    legacyAction,
    rationale: typeof entry.rationale === "string" ? entry.rationale : "",
    preMortem: typeof entry.preMortem === "string" ? entry.preMortem : undefined,
    trigger: normalizeTrigger(entry.trigger),
    snapshot: entry.snapshot ?? {
      kind: "legacy",
      data: { reason: "legacy_decision_without_snapshot", capturedAt: decidedAt },
    },
    review: normalizeReview(entry.review),
  };
}

function legacyDecisionEntry(decision: Decision): DecisionEntry {
  return {
    id: `legacy-${decision.decidedAt}-${decision.action}`,
    decidedAt: decision.decidedAt,
    action: null,
    legacyAction: decision.action,
    rationale: decision.rationale || "Legacy decision imported.",
    trigger: null,
    snapshot: {
      kind: "legacy",
      data: { reason: "legacy_decision_without_snapshot", capturedAt: decision.decidedAt },
    },
    review: null,
  };
}

function normalizeTrigger(trigger: DecisionEntry["trigger"] | undefined): DecisionEntry["trigger"] {
  if (!trigger || typeof trigger !== "object") return null;
  if (typeof trigger.dueAt !== "number" || !Number.isFinite(trigger.dueAt)) return null;
  return { dueAt: trigger.dueAt, note: typeof trigger.note === "string" ? trigger.note : "" };
}

function normalizeReview(review: DecisionEntry["review"] | undefined): DecisionEntry["review"] {
  if (!review || typeof review !== "object") return null;
  if (typeof review.reviewedAt !== "number" || typeof review.notes !== "string") return null;
  return review;
}

export function latestDecision(history: DecisionEntry[]): DecisionEntry | null {
  return history.length > 0 ? history[history.length - 1] : null;
}

export function deriveStatusFromDecisionHistory(history: DecisionEntry[]): AnalysisStatus {
  const latest = latestDecision(history);
  if (!latest) return "draft";
  if (latest.action === "watch") return "watching";
  if (latest.action === "archive") return "archived";
  if (latest.action) return "decided";
  if (latest.legacyAction === "HOLD") return "watching";
  if (latest.legacyAction === "REJECT") return "archived";
  return "decided";
}

export function addDecisionReview(
  entry: DecisionEntry,
  review: Omit<DecisionOutcomeReview, "reviewedAt">,
  reviewedAt = Date.now(),
): DecisionEntry {
  if (entry.review) throw new Error("This decision already has an outcome review.");
  if (!review.notes.trim()) throw new Error("Review notes are required.");
  return {
    ...entry,
    review: {
      ...review,
      notes: review.notes.trim(),
      reviewedAt,
    },
  };
}

export function decisionLabel(entry: DecisionEntry): string {
  return entry.action ?? entry.legacyAction ?? "NO_DECISION";
}
