import { BLANK_PARAMS } from "@/data/presets";
import type {
  AIProvider,
  AnalysisRequest,
  AnalysisResult,
  ChatRequest,
  IntakeRequest,
  PortfolioAnalysisRequest,
  PortfolioChatRequest,
} from "./types";
import type { DebateOutput, ExpertReview, IntakeResult } from "./schemas";
import { finalizeDebate, finalizePortfolioDebate } from "./analyze";

export function isQaMockMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("qaMode") === "mock";
}

function fakeDebate(title: string): DebateOutput {
  return {
    thesisSupport: "MIXED",
    stanceBasis: `QA mock output for ${title}.`,
    bull: [{ agent: "QA Bull", text: `Mock bull case for ${title}.` }],
    bear: [{ agent: "QA Bear", text: `Mock bear case for ${title}.` }],
    advisory: [
      { id: "operator", name: "Operator", verdict: "BALANCED", text: "Mock operator lens." },
      { id: "risk", name: "Risk", verdict: "WATCH", text: "Mock risk lens." },
      { id: "predator", name: "Predator", verdict: "PRESS", text: "Mock predator lens." },
    ],
  };
}

function fakeReview(title: string): ExpertReview {
  return {
    verdictLine: `QA mock review for ${title}.`,
    strengths: ["Deterministic QA path."],
    gaps: ["No live provider dependency."],
    groundingCheck: "clean",
    whatWouldChangeMyMind: ["A broken fixture or selector would fail the run."],
  };
}

function fakeIntake(): IntakeResult {
  const vertical = "stocks";
  return {
    vertical,
    mode: "scoping",
    assetName: "",
    title: "QA Mock Intake",
    note: "QA mock intake result.",
    fields: [],
    params: { ...BLANK_PARAMS[vertical] },
    thesis: {
      summary: "",
      assumptions: [],
      thesisBreakers: [],
      watchItems: [],
      valuationAssumptions: [],
      catalysts: [],
      openQuestions: [],
      evidenceCandidates: [],
    },
  };
}

function pushDelta(text: string, onDelta?: (delta: string) => void): Promise<string> {
  onDelta?.(text);
  return Promise.resolve(text);
}

export const qaMockProvider: AIProvider = {
  id: "anthropic",
  label: "QA Mock",
  models: [{ id: "qa-mock", label: "QA Mock" }],
  capabilities() {
    return { vision: false, pdfNative: false, webFetchNative: false, webSearchNative: false };
  },
  runIntake(req: IntakeRequest): Promise<IntakeResult> {
    void req;
    return Promise.resolve(fakeIntake());
  },
  runAnalysis(req: AnalysisRequest): Promise<AnalysisResult> {
    return Promise.resolve(finalizeDebate(req.analysis, fakeDebate(req.analysis.title)));
  },
  runExpertReview(req: AnalysisRequest): Promise<ExpertReview> {
    return Promise.resolve(fakeReview(req.analysis.title));
  },
  streamChat(req: ChatRequest): Promise<string> {
    return pushDelta(`QA mock chat for ${req.analysis.title}.`, req.onDelta);
  },
  runPortfolioAnalysis(req: PortfolioAnalysisRequest): Promise<AnalysisResult> {
    void req.byId;
    return Promise.resolve(finalizePortfolioDebate(req.metrics, fakeDebate(req.portfolio.title)));
  },
  streamPortfolioChat(req: PortfolioChatRequest): Promise<string> {
    return pushDelta(`QA mock portfolio chat for ${req.portfolio.title}.`, req.onDelta);
  },
};
