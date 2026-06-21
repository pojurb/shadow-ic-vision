import { BLANK_PARAMS } from "@/data/presets";
import type {
  AIProvider,
  AnalysisRequest,
  AnalysisResult,
  ChatRequest,
  DeeperIdeaDiscoveryRequest,
  IdeaDiscoveryRequest,
  IntakeRequest,
  PortfolioAnalysisRequest,
  PortfolioChatRequest,
} from "./types";
import type { DebateOutput, ExpertReview, IntakeResult } from "./schemas";
import { finalizeDebate, finalizePortfolioDebate } from "./analyze";
import { finalizeDeeperIdeaDiscovery, finalizeIdeaDiscovery } from "./discovery";

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

function delay<T>(value: T, ms = 60): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function fakeDiscovery(req: IdeaDiscoveryRequest) {
  const lower = req.prompt.toLowerCase();
  const business = /\b(business|startup|private|laundry|restaurant|real estate|property)\b/.test(lower);
  return finalizeIdeaDiscovery({
    summary: business
      ? "QA mock guided exploration for private or business ideas. Nothing is saved yet."
      : "QA mock guided exploration for broad public-market ideas. Nothing is saved yet.",
    directions: business
      ? [
          {
            title: "Local service business",
            assetName: "Local service business",
            assetType: "conventional_business",
            ticker: "",
            thesisAngle: "A boring local service may be attractive if demand repeats and operations stay manageable.",
            whyItCouldWork: ["Recurring neighborhood demand", "Simple operations", "Room to improve margins"],
            mainRisks: ["Operator dependence", "Lease or location risk", "Working capital pressure"],
            nextQuestions: ["What does monthly demand look like?", "How stable are margins?", "How concentrated is the customer base?"],
          },
          {
            title: "Early startup",
            assetName: "Early startup idea",
            assetType: "startup",
            ticker: "",
            thesisAngle: "The opportunity may matter if retention is real and the funding path is not fragile.",
            whyItCouldWork: ["Large problem space", "Potential operating leverage", "Founder speed can matter early"],
            mainRisks: ["Dilution", "Funding risk", "Weak retention"],
            nextQuestions: ["Is there customer proof?", "How long is the runway?", "What does founder ownership look like?"],
          },
          {
            title: "Private real estate",
            assetName: "Private property idea",
            assetType: "real_estate",
            ticker: "",
            thesisAngle: "This may work if the location, yield, and financing terms are better than they first appear.",
            whyItCouldWork: ["Tangible collateral", "Potential rent resilience", "Multiple ways to create value"],
            mainRisks: ["Vacancy", "Refinancing", "Stale valuation"],
            nextQuestions: ["What does the rent roll show?", "How do comparables look?", "What are the debt terms?"],
          },
        ]
      : [
          {
            title: "US quality compounder",
            assetName: "US quality compounder",
            assetType: "public_equity",
            ticker: "USQC",
            thesisAngle: "A durable compounder may deserve attention if quality and valuation are both still favorable.",
            whyItCouldWork: ["Earnings quality can compound quietly", "Strong balance sheet supports resilience", "Valuation discipline can protect returns"],
            mainRisks: ["Multiple compression", "Growth slowdown", "Crowded ownership"],
            nextQuestions: ["What does the recent filing say?", "How stretched is the valuation?", "Are margins still trending well?"],
          },
          {
            title: "Global dividend candidate",
            assetName: "Global dividend name",
            assetType: "public_equity",
            ticker: "GDVD",
            thesisAngle: "A dividend name may matter if the payout is durable and cash conversion stays healthy.",
            whyItCouldWork: ["Cash returns can support discipline", "Cash generation may be stable", "Lower drama can hide quality"],
            mainRisks: ["Dividend cut", "Leverage", "FX exposure"],
            nextQuestions: ["What is the payout ratio?", "How is free cash flow trending?", "What does the debt schedule look like?"],
          },
          {
            title: "Semiconductor infrastructure",
            assetName: "Semiconductor infrastructure idea",
            assetType: "public_equity",
            ticker: "CHIP",
            thesisAngle: "This may be interesting if the AI buildout is durable enough to outweigh normal semiconductor cyclicality.",
            whyItCouldWork: ["AI spending may support demand", "Backlog can provide visibility", "Infrastructure providers can benefit before end demand matures"],
            mainRisks: ["Inventory cycle", "Geopolitical exposure", "Capex reversal"],
            nextQuestions: ["How credible is the backlog?", "How concentrated are customers?", "Where are we in the cycle?"],
          },
        ],
  });
}

function fakeDeeperDiscovery(req: DeeperIdeaDiscoveryRequest) {
  const { direction } = req;
  const firstReason = direction.whyItCouldWork[0] ?? direction.thesisAngle;
  const firstRisk = direction.mainRisks[0] ?? "Execution risk";
  const firstQuestion = direction.nextQuestions[0] ?? "What needs checking next?";
  return finalizeDeeperIdeaDiscovery({
    summary: `${direction.title} may deserve a saved review only if the core attraction holds up under basic fact checking.`,
    whyItCouldWork: [
      `${firstReason} matters only if the business economics are real.`,
      `This direction becomes stronger when the opportunity still looks attractive after simple verification.`,
      "A saved review is justified only if the next facts would materially change your answer.",
    ],
    mainRisks: [
      `${firstRisk} could break the case early.`,
      "The first impression may rely on weak or incomplete evidence.",
      "The opportunity may look exciting before the economics are clear.",
    ],
    evidenceToCheck: [
      `Evidence check: ${firstQuestion}`,
      "Find one source that directly tests the main attraction.",
      "Look for one source that could falsify the early thesis.",
    ],
    decisionQuestions: [
      `Decision question: ${firstQuestion}`,
      "What fact would make this idea not worth saving yet?",
      "What would need to be true before this deserves a real review?",
    ],
  }, direction.id);
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
  discoverIdeas(req: IdeaDiscoveryRequest) {
    return delay(fakeDiscovery(req));
  },
  deepenIdea(req: DeeperIdeaDiscoveryRequest) {
    return delay(fakeDeeperDiscovery(req));
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
