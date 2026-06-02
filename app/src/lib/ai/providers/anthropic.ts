/**
 * Anthropic adapter — the first AIProvider. Wraps the existing raw-fetch wire
 * logic (client/analyze/chat) behind the provider interface and owns the
 * research→debate orchestration. Claude supports every capability natively.
 */
import type { AIProvider, AnalysisRequest, AnalysisResult, ChatRequest, IntakeRequest, Capabilities } from "../types";
import type { ExpertReview, IntakeResult } from "../schemas";
import { MODELS } from "../client";
import { runAnalysis, runResearch, runExpertReview, runIntake, needsResearch } from "../analyze";
import { streamChat } from "../chat";

const NATIVE: Capabilities = {
  vision: true,
  pdfNative: true,
  webFetchNative: true,
  webSearchNative: true,
};

export const anthropicProvider: AIProvider = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  models: MODELS,
  capabilities: () => NATIVE,

  runIntake({ apiKey, model, userText, sources }: IntakeRequest): Promise<IntakeResult> {
    return runIntake(apiKey, model, userText, sources);
  },

  async runAnalysis({ apiKey, model, analysis, onPhase }: AnalysisRequest): Promise<AnalysisResult> {
    // Two-pass when there are links / web research: free-form research with native
    // web tools, then the structured debate using the notes as qualitative context.
    let notes: string | undefined;
    if (needsResearch(analysis)) {
      onPhase?.("research");
      notes = await runResearch(apiKey, model, analysis);
    }
    onPhase?.("debate");
    return runAnalysis(apiKey, model, analysis, notes);
  },

  runExpertReview({ apiKey, model, analysis }: AnalysisRequest): Promise<ExpertReview> {
    return runExpertReview(apiKey, model, analysis);
  },

  streamChat({ apiKey, model, analysis, userText, onDelta }: ChatRequest): Promise<string> {
    return streamChat({ apiKey, model, analysis, userText, onDelta });
  },
};
