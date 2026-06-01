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

export interface AssetMeta {
  ticker?: string;
  sector?: string;
  currency?: string; // default "IDR"
  region?: string;
  dataAsOf?: string;
  source?: string;
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
  /** First assistant turn is the grounded red-team debate. */
  kind?: "debate" | "answer";
  /** Ids of other analyses pulled in as context (composition). */
  contextRefs?: string[];
  createdAt: number;
}

export interface Decision {
  action: DecisionAction;
  rationale: string;
  decidedAt: number;
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

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface Analysis {
  id: string;
  title: string;
  vertical: Vertical;
  assetName: string;
  assetMeta: AssetMeta;
  tags: string[];
  folderId: string | null;
  parameters: AssetParameters;
  metrics: ComputedMetrics;
  debate: DebateResult | null;
  advisory: AdvisoryResult | null;
  /** Visible expert persona that produced the analysis (per vertical). */
  persona: PersonaRef | null;
  /** Engine-derived valuation stance + AI basis. */
  stance: Stance | null;
  /** Optional, on-demand second-expert review of the produced analysis. */
  expertReview: ExpertReview | null;
  sources: ContextSource[];
  allowWebSearch: boolean;
  chat: ChatMessage[];
  decision: Decision | null;
  model: string;
  status: AnalysisStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PortfolioAnalysis {
  id: string;
  title: string;
  memberIds: string[];
  tags: string[];
  folderId: string | null;
  chat: ChatMessage[];
  allowWebSearch: boolean;
  createdAt: number;
  updatedAt: number;
}
