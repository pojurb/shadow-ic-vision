/**
 * Provider-agnostic AI seam. The app brings any provider's key and uses that
 * model as the brain; each provider is an adapter implementing this interface.
 * Per-capability, the app uses the native path when the model supports it and an
 * app-provided fallback otherwise (see `multi-provider-byok` decision).
 */
import type { Analysis } from "@/lib/domain/types";
import type { DebateOutput } from "./schemas";

export type ProviderId = "anthropic" | "openai";

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

export interface AIProvider {
  id: ProviderId;
  label: string;
  models: ModelOption[];
  /** Native capabilities for a model id (defaults are fine for unknown ids). */
  capabilities(modelId: string): Capabilities;
  /** Orchestrates the research + structured-debate passes; reports phases. */
  runAnalysis(req: AnalysisRequest): Promise<DebateOutput>;
  /** Streamed, grounded follow-up chat. Returns the full text. */
  streamChat(req: ChatRequest): Promise<string>;
}
