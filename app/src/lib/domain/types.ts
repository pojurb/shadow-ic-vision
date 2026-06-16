/**
 * Domain model for the analysis workspace. The Analysis is the central object;
 * Ledger, history, and portfolios all derive from the analyses collection.
 * See DATA_MODEL.md at the repo root for the full rationale.
 */
import type { Vertical, AssetParameters, DebateLine, ThesisSupport } from "@/data/presets";
import type { ExpertReview } from "@/lib/ai/schemas";

export type { Vertical, AssetParameters, DebateLine, ThesisSupport, ExpertReview };

/** Red-team debate output (seeded from a preset; produced by the AI live). */
export interface DebateResult {
  thesisSupport: ThesisSupport;
  bull: DebateLine[];
  bear: DebateLine[];
}

/** One advisory lens result: a short verdict word + the take. */
export interface LensResult {
  id: string;
  name: string;
  verdict: string;
  text: string;
}

/** The advisory board — a per-vertical lens SET (was operator/risk/predator). */
export type AdvisoryResult = LensResult[];

/** Visible expert persona identity stored on the analysis. */
export interface PersonaRef {
  id: string;
  label: string;
}

/** The engine-derived valuation stance label + the AI's one-line basis. */
export interface Stance {
  label: string;
  basis: string;
}

export type DecisionAction = "APPROVE" | "HOLD" | "REJECT";
export type AnalysisStatus = "draft" | "decided" | "watching" | "archived";
export type AssetType =
  | "public_equity"
  | "conventional_business"
  | "startup"
  | "real_estate"
  | "crypto"
  | "macro_view"
  | "other";
export type EvidenceRelation = "supporting" | "contradictory" | "neutral" | "unresolved";
export type EvidenceType =
  | "filing"
  | "article"
  | "note"
  | "transcript"
  | "market_data"
  | "pitch_deck"
  | "memo"
  | "screenshot"
  | "pdf"
  | "deal_document"
  | "other";
export type EvidenceReliability = "official" | "third_party" | "user_provided" | "unknown";
export type AssumptionStatus = "active" | "watch" | "broken" | "resolved";
export type BreakerSeverity = "watch" | "material" | "fatal";
export type ReviewCadence = "weekly" | "monthly" | "quarterly" | "event_driven";
export type ConvictionLabel = "low" | "medium" | "high";
export type StockFieldValueType = "current" | "delayed" | "ttm" | "annual" | "estimated" | "user_provided" | "derived" | "legacy_unknown";
export type StockFieldConfidence = "high" | "medium" | "low" | "needs_review" | "legacy_unknown";
export type StockFieldSourceKind = "official" | "third_party" | "user_provided" | "derived" | "legacy_unknown";
export type StockFieldOrigin =
  | "user_fact"
  | "sourced_fact"
  | "candidate"
  | "derived_candidate"
  | "default_assumption"
  | "legacy_unverified";
export type ICAction =
  | "no_action"
  | "watch"
  | "research_more"
  | "increase_conviction"
  | "decrease_conviction"
  | "add_increase_position"
  | "trim_reduce_position"
  | "exit"
  | "archive";
export type ValuationMode = "engine" | "manual";
export type ManualRiskPromptId =
  | "illiquidity_exit"
  | "valuation_quality"
  | "concentration"
  | "key_person"
  | "balance_sheet_burn"
  | "legal_regulatory"
  | "macro_exposure"
  | "startup_dilution_funding"
  | "real_estate_vacancy_tenant"
  | "real_estate_leverage_refinancing"
  | "crypto_custody"
  | "crypto_protocol"
  | "crypto_liquidity"
  | "crypto_regulatory"
  | "crypto_smart_contract"
  | "macro_rates_fx"
  | "macro_hidden_correlation";

export interface AssetMeta {
  ticker?: string;
  sector?: string;
  currency?: string; // default "IDR"
  region?: string;
  dataAsOf?: string;
  source?: string;
}

export interface StockFieldProvenance {
  title: string;
  url: string;
  asOf: string;
  valueType: StockFieldValueType;
  confidence: StockFieldConfidence;
  sourceKind: StockFieldSourceKind;
}

export interface StockFieldRecord {
  key: string;
  value: number;
  source: "stated" | "inferred";
  origin: StockFieldOrigin;
  lockable: boolean;
  provenance: StockFieldProvenance | null;
  note?: string;
}

/** A single deterministic figure — the engine output in serializable, prompt-ready form. */
export interface Metric {
  key: string;
  label: string;
  value: number;
  display: string;
  verdict?: string;
}

export interface ComputedMetrics {
  vertical: Vertical;
  metrics: Metric[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** First assistant turn is the grounded red-team debate. "report" = the
   * templated written analysis posted after intake locks + the debate runs. */
  kind?: "debate" | "answer" | "report";
  /** Ids of other analyses pulled in as context (composition). */
  contextRefs?: string[];
  createdAt: number;
}

export interface Decision {
  action: DecisionAction;
  rationale: string;
  decidedAt: number;
}

export interface DecisionOutcomeReview {
  reviewedAt: number;
  outcome: "worked" | "mixed" | "did_not_work" | "unresolved";
  reasoningAssessment: "right_right_reason" | "wrong_right_reason" | "lucky" | "unclear";
  notes: string;
}

export interface ThesisAssumption {
  id: string;
  text: string;
  status: AssumptionStatus;
  monitor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ThesisBreaker {
  id: string;
  text: string;
  severity: BreakerSeverity;
  createdAt: number;
}

export interface WatchItem {
  id: string;
  text: string;
  cadence?: ReviewCadence;
  createdAt: number;
}

export interface ValuationAssumption {
  id: string;
  text: string;
  source: "user" | "model" | "sourced";
  createdAt: number;
}

export interface Catalyst {
  id: string;
  text: string;
  timeframe?: string;
  createdAt: number;
}

export interface OpenQuestion {
  id: string;
  text: string;
  createdAt: number;
}

export interface EvidenceCandidate {
  id: string;
  title: string;
  url?: string;
  note?: string;
  type: EvidenceType;
  relation: EvidenceRelation;
  reliability: EvidenceReliability;
  createdAt: number;
}

export type ThesisRefTarget =
  | "summary"
  | "assumption"
  | "breaker"
  | "watch_item"
  | "valuation_assumption"
  | "catalyst"
  | "open_question";

export interface ThesisRef {
  target: ThesisRefTarget;
  id: string | null;
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: EvidenceType;
  relation: EvidenceRelation;
  reliability: EvidenceReliability;
  sourceDate: string | null;
  url?: string;
  note?: string;
  sourceRefIds: string[];
  thesisRefs: ThesisRef[];
  createdAt: number;
  updatedAt: number;
}

export interface ThesisMemory {
  summary: string;
  assumptions: ThesisAssumption[];
  thesisBreakers: ThesisBreaker[];
  watchItems: WatchItem[];
  valuationAssumptions: ValuationAssumption[];
  catalysts: Catalyst[];
  openQuestions: OpenQuestion[];
  evidenceCandidates: EvidenceCandidate[];
  conviction: ConvictionLabel | null;
}

export interface ReviewState {
  cadence: ReviewCadence;
  lastReviewedAt: number | null;
  nextReviewDue: number | null;
}

export interface ManualRiskNote {
  promptId: ManualRiskPromptId;
  note: string;
}

export interface AnalysisManualMeta {
  valuationAmount: number | null;
  valuationDate: string;
  valuationSource: string;
  pricingFreshness: string;
  liquidity: string;
  expectedDuration: string;
  portfolioRole: string;
  sizingIntent: string;
  macroDependencies: string[];
  riskNotes: ManualRiskNote[];
}

export interface ICState {
  thesis: ThesisMemory;
  review: ReviewState;
}

/**
 * Droppable context. Files (PDF/image) are native Claude content blocks; links and
 * web research use Anthropic's server-side web_fetch / web_search tools.
 */
export type ContextSource =
  | {
      id: string;
      kind: "file";
      name: string;
      mime: string;
      fileKind: "image" | "pdf";
      blobId: string;
      extractedText?: string;
      createdAt: number;
    }
  | {
      id: string;
      kind: "link";
      url: string;
      title?: string;
      createdAt: number;
    };

export interface AnalysisDecisionSnapshot {
  title: string;
  assetType: AssetType;
  valuationMode: ValuationMode;
  vertical: Vertical | null;
  thesis: ThesisMemory;
  review: ReviewState;
  metrics: ComputedMetrics | null;
  manualMeta: AnalysisManualMeta | null;
  stance: Stance | null;
  sources: ContextSource[];
  evidence: EvidenceItem[];
  evidenceCandidates: EvidenceCandidate[];
  capturedAt: number;
}

export interface PortfolioDecisionSnapshot {
  title: string;
  members: PortfolioMember[];
  positions: PortfolioPosition[];
  metrics: PortfolioMetrics;
  stance: Stance | null;
  tags: string[];
  capturedAt: number;
}

export interface LegacyDecisionSnapshot {
  reason: "legacy_decision_without_snapshot";
  capturedAt: number;
}

export type DecisionSnapshot =
  | { kind: "analysis"; data: AnalysisDecisionSnapshot }
  | { kind: "portfolio"; data: PortfolioDecisionSnapshot }
  | { kind: "legacy"; data: LegacyDecisionSnapshot };

export interface DecisionEntry {
  id: string;
  decidedAt: number;
  action: ICAction | null;
  legacyAction?: DecisionAction;
  rationale: string;
  preMortem?: string;
  trigger: { dueAt: number; note: string } | null;
  snapshot: DecisionSnapshot;
  review: DecisionOutcomeReview | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface Analysis {
  id: string;
  title: string;
  valuationMode: ValuationMode;
  vertical: Vertical | null;
  assetType: AssetType;
  assetName: string;
  assetMeta: AssetMeta;
  manualMeta: AnalysisManualMeta | null;
  stockFields?: StockFieldRecord[];
  tags: string[];
  folderId: string | null;
  ic: ICState;
  parameters: AssetParameters;
  metrics: ComputedMetrics | null;
  debate: DebateResult | null;
  advisory: AdvisoryResult | null;
  /** Visible expert persona that produced the analysis (per vertical). */
  persona: PersonaRef | null;
  /** Engine-derived valuation stance + AI basis. */
  stance: Stance | null;
  /** Optional, on-demand second-expert review of the produced analysis. */
  expertReview: ExpertReview | null;
  sources: ContextSource[];
  evidence: EvidenceItem[];
  allowWebSearch: boolean;
  chat: ChatMessage[];
  decision: Decision | null;
  decisionHistory: DecisionEntry[];
  model: string;
  status: AnalysisStatus;
  createdAt: number;
  updatedAt: number;
}

/** One holding in a portfolio: a member analysis + the capital allocated to it. */
export interface PortfolioMember {
  analysisId: string;
  /** Capital allocated to this position (IDR). Drives the deterministic weights. */
  capital: number;
}

/** One resolved position in the computed portfolio view (member + derived weight). */
export interface PortfolioPosition {
  analysisId: string;
  name: string;
  vertical: Vertical;
  capital: number;
  /** Share of total portfolio capital, 0..1. */
  weight: number;
  /** Engine-derived stance label of the member analysis, if any. */
  stance: string | null;
}

/**
 * Deterministic portfolio-level "locked facts" — the cross-asset analogue of
 * `ComputedMetrics`. Same serializable `Metric[]` shape so the future composition
 * chat/UI ground on portfolio figures exactly as a single analysis does. Every
 * number originates in `computePortfolioMetrics` (never the LLM).
 */
export interface PortfolioMetrics {
  totalCapital: number;
  positions: PortfolioPosition[];
  metrics: Metric[];
}

export interface PortfolioAnalysis {
  id: string;
  title: string;
  members: PortfolioMember[];
  tags: string[];
  folderId: string | null;
  chat: ChatMessage[];
  allowWebSearch: boolean;
  /** Cross-asset expert persona that produced the portfolio debate (Portfolio Strategist). */
  persona: PersonaRef | null;
  /** Engine-derived portfolio stance (concentration + conviction mix) + AI basis. */
  stance: Stance | null;
  /** Portfolio-level red-team debate (bull/bear over the composed holdings). */
  debate: DebateResult | null;
  /** Portfolio-level advisory lenses (capital allocation, concentration, conviction, risk). */
  advisory: AdvisoryResult | null;
  decisionHistory: DecisionEntry[];
  createdAt: number;
  updatedAt: number;
}
