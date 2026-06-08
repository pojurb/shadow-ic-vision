/**
 * Provider-agnostic AI seam. The app brings any provider's key and uses that
 * model as the brain; each provider is an adapter implementing this interface.
 * Per-capability, the app uses the native path when the model supports it and an
 * app-provided fallback otherwise (see `multi-provider-byok` decision).
 */
import type {
  Analysis,
  ContextSource,
  DebateResult,
  AdvisoryResult,
  Stance,
  PortfolioAnalysis,
  PortfolioMetrics,
} from "@/lib/domain/types";
import type { ExpertReview, IntakeResult } from "./schemas";

export type ProviderId = "anthropic" | "openai" | "gemini";

/** Finalized analysis the providers return: debate + zipped advisory + engine stance. */
export interface AnalysisResult {
  debate: DebateResult;
  advisory: AdvisoryResult;
  stance: Stance | null;
}

export interface ModelOption {
  id: string;
  label: string;
}

/** What a given model can do natively. Drives native-vs-fallback selection. */
export interface Capabilities {
  vision: boolean;
  pdfNative: boolean;
  webFetchNative: boolean;
  webSearchNative: boolean;
}

/** Two-phase analysis progress, surfaced to the RUN AI button. */
export type RunPhase = "research" | "debate";

export interface AnalysisRequest {
  apiKey: string;
  model: string;
  analysis: Analysis;
  onPhase?: (phase: RunPhase) => void;
}

export interface ChatRequest {
  apiKey: string;
  model: string;
  analysis: Analysis;
  userText: string;
  onDelta: (text: string) => void;
}

/** Intake: detect the vertical + extract engine params from prose/attachments. */
export interface IntakeRequest {
  apiKey: string;
  model: string;
  userText: string;
  sources: ContextSource[];
}

/** Portfolio-level structured debate over the composed holdings. */
export interface PortfolioAnalysisRequest {
  apiKey: string;
  model: string;
  portfolio: PortfolioAnalysis;
  metrics: PortfolioMetrics;
  /** All analyses keyed by id — resolves each member's own locked figures for grounding. */
  byId: Map<string, Analysis>;
}

/** Grounded cross-asset follow-up chat over a portfolio. */
export interface PortfolioChatRequest {
  apiKey: string;
  model: string;
  portfolio: PortfolioAnalysis;
  metrics: PortfolioMetrics;
  byId: Map<string, Analysis>;
  userText: string;
  onDelta: (text: string) => void;
}

export interface AIProvider {
  id: ProviderId;
  label: string;
  models: ModelOption[];
  /** Native capabilities for a model id (defaults are fine for unknown ids). */
  capabilities(modelId: string): Capabilities;
  /** Intake: detect vertical + extract figures from prose/attachments (one call). */
  runIntake(req: IntakeRequest): Promise<IntakeResult>;
  /** Orchestrates the research + structured-debate passes; reports phases. */
  runAnalysis(req: AnalysisRequest): Promise<AnalysisResult>;
  /** Optional, on-demand second-expert red-team of the produced analysis. */
  runExpertReview(req: AnalysisRequest): Promise<ExpertReview>;
  /** Streamed, grounded follow-up chat. Returns the full text. */
  streamChat(req: ChatRequest): Promise<string>;
  /** Portfolio-level structured debate over the composed holdings (one call, no research). */
  runPortfolioAnalysis(req: PortfolioAnalysisRequest): Promise<AnalysisResult>;
  /** Streamed, grounded cross-asset follow-up chat over the portfolio. Returns the full text. */
  streamPortfolioChat(req: PortfolioChatRequest): Promise<string>;
}
