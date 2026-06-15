import { PRESETS } from "@/data/presets";
import { computeMetrics } from "@/lib/finance/compute";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { buildEnvelope, type BackupData } from "@/lib/repo/backup";
import { buildAnalysisDecisionSnapshot, buildPortfolioDecisionSnapshot } from "@/lib/domain/decisions";
import {
  buildDerivedStockProvenance,
  buildUserProvidedStockProvenance,
} from "@/lib/domain/stockFields";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import { memberFromPreset, mixedPortfolio } from "@/lib/ai/eval/fixtures";
import type {
  Analysis,
  EvidenceItem,
  Folder,
  PortfolioAnalysis,
  ThesisRef,
} from "@/lib/domain/types";

export type QaFixtureName = "m3" | "m4" | "m6" | "broken-m4";

const QA_NOW = Date.parse("2026-06-15T00:00:00Z");

function baseAnalysis(id: string, vertical: keyof typeof PRESETS, idx = 0): Analysis {
  const preset = PRESETS[vertical][idx];
  const parameters = { ...preset.parameters };
  const metrics = computeMetrics(vertical, parameters);
  const analysis = memberFromPreset(id, vertical, idx);
  analysis.title = preset.name;
  analysis.assetName = preset.name;
  analysis.parameters = parameters;
  analysis.metrics = metrics;
  analysis.assetType = assetTypeForVertical(vertical);
  analysis.ic = createDefaultICState(QA_NOW);
  analysis.status = "draft";
  analysis.createdAt = QA_NOW;
  analysis.updatedAt = QA_NOW;
  return analysis;
}

function stockProvenanceFixture(): Analysis {
  const analysis = baseAnalysis("qa-m3-stock", "stocks");
  analysis.title = "QA M3 Stock Provenance";
  analysis.assetName = "QA Holdings";
  analysis.assetMeta = { ticker: "QA" };
  analysis.parameters = { ...analysis.parameters, price: 2100, eps: 185, roe: 24, invested: 2100 };
  analysis.metrics = computeMetrics("stocks", analysis.parameters);
  analysis.debate = {
    thesisSupport: "MIXED",
    bull: [{ agent: "QA Bull", text: "Deterministic stock figures are visible and auditable." }],
    bear: [{ agent: "QA Bear", text: "Legacy and candidate provenance still need explicit review." }],
  };
  analysis.advisory = [
    { id: "operator", name: "Operator", verdict: "APPROVE", text: "Stock provenance renders inline." },
    { id: "risk", name: "Risk", verdict: "CHECK", text: "Candidate rows remain separate from locked values." },
    { id: "predator", name: "Predator", verdict: "PRESS", text: "Derived helper rows are still visible." },
  ];
  analysis.persona = { id: "equity-analyst", label: "Equity Analyst" };
  analysis.stance = { label: "UNDERVALUED", basis: "QA fixture with mixed provenance." };
  analysis.stockFields = [
    {
      key: "price",
      value: 2100,
      source: "stated",
      origin: "sourced_fact",
      lockable: true,
      provenance: {
        title: "2026 Annual Report",
        url: "https://example.com/annual-report",
        asOf: "2026-06-15",
        valueType: "current",
        confidence: "high",
        sourceKind: "official",
      },
    },
    {
      key: "eps",
      value: 185,
      source: "inferred",
      origin: "candidate",
      lockable: false,
      provenance: null,
      note: "Confirm before locking.",
    },
    {
      key: "roe",
      value: 24,
      source: "stated",
      origin: "user_fact",
      lockable: true,
      provenance: buildUserProvidedStockProvenance(QA_NOW),
    },
    {
      key: "invested",
      value: 2100,
      source: "inferred",
      origin: "derived_candidate",
      lockable: false,
      provenance: buildDerivedStockProvenance(QA_NOW),
      note: "Derived helper from price; review before relying on it as a buy-price assumption.",
    },
  ];
  analysis.evidence = [];
  analysis.ic.thesis.summary = "Stock provenance rows should remain distinct before lock and after reload.";
  analysis.ic.thesis.assumptions = [];
  analysis.ic.thesis.evidenceCandidates = [];
  return analysis;
}

function evidenceRefs(...refs: ThesisRef[]): ThesisRef[] {
  return refs;
}

function evidenceFixture(): Analysis {
  const analysis = baseAnalysis("qa-m4-evidence", "stocks");
  analysis.title = "QA M4 Evidence Locker";
  analysis.assetName = "QA Evidence Asset";
  analysis.assetMeta = { ticker: "EVID" };
  analysis.sources = [
    {
      id: "src-q3",
      kind: "link",
      url: "https://example.com/q3-call",
      title: "Q3 earnings call",
      createdAt: QA_NOW - 50_000,
    },
    {
      id: "src-filing",
      kind: "link",
      url: "https://example.com/filing",
      title: "Annual filing",
      createdAt: QA_NOW - 40_000,
    },
  ];
  analysis.ic.thesis = {
    summary: "Evidence should be first-class, linked, and editable.",
    assumptions: [{ id: "assumption-1", text: "Margins stay stable", status: "active", createdAt: QA_NOW, updatedAt: QA_NOW }],
    thesisBreakers: [{ id: "breaker-1", text: "Revenue growth slips", severity: "material", createdAt: QA_NOW }],
    watchItems: [{ id: "watch-1", text: "Track gross margin", cadence: "weekly", createdAt: QA_NOW }],
    valuationAssumptions: [{ id: "value-1", text: "Multiple stays at parity", source: "user", createdAt: QA_NOW }],
    catalysts: [{ id: "cat-1", text: "New product launch", createdAt: QA_NOW }],
    openQuestions: [{ id: "question-1", text: "Can the thesis survive a slower quarter?", createdAt: QA_NOW }],
    evidenceCandidates: [
      {
        id: "candidate-1",
        title: "Management commentary",
        url: "https://example.com/management-commentary",
        note: "Promote into the locker if the line of reasoning is useful.",
        type: "transcript",
        relation: "supporting",
        reliability: "official",
        createdAt: QA_NOW,
      },
    ],
    conviction: null,
  };
  const refs = evidenceRefs(
    { target: "summary", id: null },
    { target: "assumption", id: "assumption-1" },
    { target: "breaker", id: "breaker-1" },
    { target: "watch_item", id: "watch-1" },
    { target: "valuation_assumption", id: "value-1" },
    { target: "catalyst", id: "cat-1" },
    { target: "open_question", id: "question-1" },
  );
  const evidence: EvidenceItem[] = [
    {
      id: "ev-support",
      title: "Q3 call note",
      type: "transcript",
      relation: "supporting",
      reliability: "official",
      sourceDate: "2026-05-15",
      url: "https://example.com/q3-call",
      note: "Anchors the growth commentary.",
      sourceRefIds: ["src-q3"],
      thesisRefs: refs.slice(0, 2),
      createdAt: QA_NOW - 30_000,
      updatedAt: QA_NOW - 20_000,
    },
    {
      id: "ev-contrary",
      title: "Filing caveat",
      type: "filing",
      relation: "contradictory",
      reliability: "third_party",
      sourceDate: "2026-04-01",
      url: "https://example.com/filing",
      note: "Shows the caveat that should be visible in the row.",
      sourceRefIds: ["src-filing"],
      thesisRefs: refs.slice(2, 4),
      createdAt: QA_NOW - 25_000,
      updatedAt: QA_NOW - 15_000,
    },
  ];
  analysis.evidence = evidence;
  analysis.debate = {
    thesisSupport: "STRONG",
    bull: [{ agent: "QA Bull", text: "Evidence is linked and editable with thesis refs." }],
    bear: [{ agent: "QA Bear", text: "Candidate promotion and link state need verification." }],
  };
  analysis.advisory = [
    { id: "operator", name: "Operator", verdict: "APPROVE", text: "Evidence can be captured without valuation." },
    { id: "risk", name: "Risk", verdict: "WATCH", text: "Broken refs should stay visible if the source disappears." },
    { id: "predator", name: "Predator", verdict: "PRESS", text: "Promotion should not duplicate matching evidence." },
  ];
  analysis.persona = { id: "equity-analyst", label: "Equity Analyst" };
  analysis.stance = { label: "NEUTRAL", basis: "QA evidence locker seed." };
  analysis.status = "draft";
  return analysis;
}

function decisionHistoryFixture(
  portfolio: PortfolioAnalysis,
  metrics: ReturnType<typeof computePortfolioMetrics>,
): PortfolioAnalysis {
  return {
    ...portfolio,
    debate: {
      thesisSupport: "MIXED",
      bull: [{ agent: "QA Bull", text: "Portfolio review history is visible." }],
      bear: [{ agent: "QA Bear", text: "Review state should render newest-first." }],
    },
    advisory: [
      { id: "operator", name: "Operator", verdict: "BALANCED", text: "Decision history should be writable." },
      { id: "risk", name: "Risk", verdict: "WATCH", text: "Review due entries should stay flagged." },
      { id: "predator", name: "Predator", verdict: "PRESS", text: "Legacy labels must not remap away." },
    ],
    stance: { label: "CONCENTRATED", basis: "QA portfolio fixture." },
    decisionHistory: [
      {
        id: "legacy-hold",
        decidedAt: QA_NOW - 200_000,
        action: null,
        legacyAction: "HOLD",
        rationale: "Legacy hold preserved for browser rendering.",
        trigger: null,
        snapshot: { kind: "legacy", data: { reason: "legacy_decision_without_snapshot", capturedAt: QA_NOW - 200_000 } },
        review: null,
      },
      {
        id: "watch-due",
        decidedAt: QA_NOW - 100_000,
        action: "watch",
        rationale: "Review the mix after the next catalyst.",
        trigger: { dueAt: QA_NOW - 86_400_000, note: "Review after earnings" },
        snapshot: {
          kind: "portfolio",
          data: buildPortfolioDecisionSnapshot(portfolio, metrics, QA_NOW - 100_000),
        },
        review: null,
      },
    ],
  };
}

function m6Fixture(): ReturnType<typeof buildEnvelope> {
  const { portfolio } = mixedPortfolio();
  const members = [
    baseAnalysis("qa-m6-stock", "stocks"),
    baseAnalysis("qa-m6-startup", "startups"),
    baseAnalysis("qa-m6-conv", "conventional"),
  ];
  members[0].title = "QA M6 Analysis Ledger";
  members[0].assetName = "QA Legacy Analysis";
  members[0].decisionHistory = [
    {
      id: "legacy-approve",
      decidedAt: QA_NOW - 300_000,
      action: null,
      legacyAction: "APPROVE",
      rationale: "Legacy approval entry.",
      trigger: null,
      snapshot: { kind: "legacy", data: { reason: "legacy_decision_without_snapshot", capturedAt: QA_NOW - 300_000 } },
      review: null,
    },
    {
      id: "analysis-watch",
      decidedAt: QA_NOW - 150_000,
      action: "watch",
      rationale: "Watch the thesis after the next update.",
      trigger: { dueAt: QA_NOW - 10_000, note: "Re-check after guidance" },
      snapshot: {
        kind: "analysis",
        data: buildAnalysisDecisionSnapshot(members[0], QA_NOW - 150_000),
      },
      review: null,
    },
  ];
  members[0].status = "watching";
  members[0].updatedAt = QA_NOW;
  const memberById = new Map([
    [members[0].id, members[0]],
    [members[1].id, members[1]],
    [members[2].id, members[2]],
  ]);
  const portfolioSeed = decisionHistoryFixture(
    {
      ...portfolio,
      title: "QA Portfolio Ledger",
      updatedAt: QA_NOW,
      createdAt: QA_NOW,
      members: portfolio.members,
    },
    computePortfolioMetrics(portfolio.members, memberById),
  );
  const portfolioMetrics = computePortfolioMetrics(portfolioSeed.members, memberById);
  portfolioSeed.decisionHistory = portfolioSeed.decisionHistory.map((entry) =>
    entry.snapshot.kind === "portfolio"
      ? { ...entry, snapshot: { kind: "portfolio", data: buildPortfolioDecisionSnapshot(portfolioSeed, portfolioMetrics, entry.decidedAt) } }
      : entry,
  );
  return buildEnvelope({
    analyses: members,
    portfolios: [portfolioSeed],
    folders: [] as Folder[],
    blobs: [],
  });
}

function brokenM4Fixture(): ReturnType<typeof buildEnvelope> {
  const analysis = evidenceFixture();
  analysis.title = "QA Broken Evidence";
  analysis.ic.thesis.evidenceCandidates = [];
  analysis.evidence = [
    {
      id: "ev-broken",
      title: "Broken source reference",
      type: "note",
      relation: "supporting",
      reliability: "unknown",
      sourceDate: "2026-06-15",
      url: "https://example.com/broken",
      note: "This row is intentionally mismatched for failure classification.",
      sourceRefIds: ["missing-source"],
      thesisRefs: [{ target: "summary", id: null }],
      createdAt: QA_NOW,
      updatedAt: QA_NOW,
    },
  ];
  return buildEnvelope({ analyses: [analysis], portfolios: [], folders: [], blobs: [] });
}

export function buildQaBackup(name: QaFixtureName): ReturnType<typeof buildEnvelope> {
  if (name === "m3") {
    return buildEnvelope({ analyses: [stockProvenanceFixture()], portfolios: [], folders: [], blobs: [] });
  }
  if (name === "m4") {
    return buildEnvelope({ analyses: [evidenceFixture()], portfolios: [], folders: [], blobs: [] });
  }
  if (name === "m6") {
    return m6Fixture();
  }
  if (name === "broken-m4") {
    return brokenM4Fixture();
  }
  return buildEnvelope({ analyses: [], portfolios: [], folders: [], blobs: [] });
}

export function qaFixtureNames(): QaFixtureName[] {
  return ["m3", "m4", "m6", "broken-m4"];
}
