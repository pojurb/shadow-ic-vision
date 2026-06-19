import { PRESETS } from "@/data/presets";
import { computeMetrics } from "@/lib/finance/compute";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { buildEnvelope } from "@/lib/repo/backup";
import { buildAnalysisDecisionSnapshot, buildPortfolioDecisionSnapshot } from "@/lib/domain/decisions";
import {
  buildDerivedStockProvenance,
  buildUserProvidedStockProvenance,
} from "@/lib/domain/stockFields";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import { memberFromPreset, mixedPortfolio } from "@/lib/ai/eval/fixtures";
import type {
  Analysis,
  DecisionEntry,
  EvidenceItem,
  Folder,
  PortfolioAnalysis,
  ThesisRef,
} from "@/lib/domain/types";

export type QaFixtureName = "m1" | "m2" | "m3" | "m4" | "m5" | "m6" | "m7" | "broken-m4";

const QA_NOW = Date.parse("2026-06-15T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

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

function m1Fixture(): ReturnType<typeof buildEnvelope> {
  const now = Date.now();
  const analysis = baseAnalysis("qa-m1-thesis", "stocks");
  analysis.title = "QA M1 Thesis Memory";
  analysis.assetName = "QA Thesis Asset";
  analysis.ic.thesis = {
    summary: "Confirmed thesis memory should render and persist with review state.",
    assumptions: [{
      id: "m1-assumption",
      text: "Margins stay resilient while volume normalizes.",
      status: "active",
      createdAt: QA_NOW,
      updatedAt: QA_NOW,
    }],
    thesisBreakers: [{
      id: "m1-breaker",
      text: "Cost inflation breaks the margin thesis.",
      severity: "material",
      createdAt: QA_NOW,
    }],
    watchItems: [{
      id: "m1-watch",
      text: "Quarterly gross margin trend",
      cadence: "weekly",
      createdAt: QA_NOW,
    }],
    valuationAssumptions: [{
      id: "m1-valuation",
      text: "Terminal multiple remains near peer median.",
      source: "user",
      createdAt: QA_NOW,
    }],
    catalysts: [{
      id: "m1-catalyst",
      text: "New capacity comes online.",
      createdAt: QA_NOW,
    }],
    openQuestions: [{
      id: "m1-question",
      text: "How durable is customer demand?",
      createdAt: QA_NOW,
    }],
    evidenceCandidates: [],
    conviction: "medium",
  };
  analysis.ic.review = {
    cadence: "weekly",
    lastReviewedAt: now - 3 * DAY_MS,
    nextReviewDue: now - DAY_MS,
  };
  return buildEnvelope({ analyses: [analysis], portfolios: [], folders: [], blobs: [] });
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

function m5Fixture(): ReturnType<typeof buildEnvelope> {
  const stale = baseAnalysis("qa-m5-stale", "stocks");
  stale.title = "QA M5 Stale Contradiction";
  stale.assetName = stale.title;
  stale.ic.review.lastReviewedAt = QA_NOW - 16 * DAY_MS;
  stale.ic.review.nextReviewDue = QA_NOW - 9 * DAY_MS;
  stale.ic.thesis.summary = "Deposit costs stay low while management keeps repricing discipline.";
  stale.ic.thesis.assumptions = [
    {
      id: "m5-assumption-deposit",
      text: "Deposit costs stay low",
      status: "active",
      createdAt: QA_NOW - 20 * DAY_MS,
      updatedAt: QA_NOW - 12 * DAY_MS,
    },
  ];
  stale.ic.thesis.thesisBreakers = [
    {
      id: "m5-breaker-funding",
      text: "Funding costs break the spread thesis",
      severity: "material",
      createdAt: QA_NOW - 18 * DAY_MS,
    },
  ];
  stale.ic.thesis.watchItems = [
    {
      id: "m5-watch-spread",
      text: "Track deposit spread pressure",
      cadence: "weekly",
      createdAt: QA_NOW - 15 * DAY_MS,
    },
  ];
  stale.ic.thesis.conviction = "high";
  stale.tags = ["rates", "deposit-beta"];
  stale.evidence = [
    {
      id: "m5-ev-contradiction",
      title: "Deposit beta warning",
      type: "article",
      relation: "contradictory",
      reliability: "third_party",
      sourceDate: "2026-06-10",
      url: "https://example.com/deposit-beta-warning",
      note: "Deposit pricing is moving against the underwriting.",
      sourceRefIds: [],
      thesisRefs: [{ target: "assumption", id: "m5-assumption-deposit" }],
      createdAt: QA_NOW - 5 * DAY_MS,
      updatedAt: QA_NOW - 5 * DAY_MS,
    },
  ];
  stale.stance = { label: "UNDERVALUED", basis: "Old underwriting still looks optically cheap." };

  const drift = baseAnalysis("qa-m5-drift", "stocks");
  drift.title = "QA M5 Valuation Drift";
  drift.assetName = drift.title;
  drift.ic.review.lastReviewedAt = QA_NOW - 3 * DAY_MS;
  drift.ic.review.nextReviewDue = QA_NOW + 4 * DAY_MS;
  drift.tags = ["rates", "duration"];
  drift.ic.thesis.assumptions = [
    {
      id: "m5-assumption-multiple",
      text: "Rates normalize and duration rerates",
      status: "active",
      createdAt: QA_NOW - 12 * DAY_MS,
      updatedAt: QA_NOW - 4 * DAY_MS,
    },
  ];
  drift.stance = { label: "FAIR", basis: "Current multiples already reflect the upside." };
  const driftSnapshotSource = baseAnalysis("qa-m5-drift-snapshot", "stocks");
  driftSnapshotSource.title = drift.title;
  driftSnapshotSource.assetName = drift.assetName;
  driftSnapshotSource.ic = structuredClone(drift.ic);
  driftSnapshotSource.tags = [...drift.tags];
  driftSnapshotSource.stance = { label: "UNDERVALUED", basis: "Snapshot before the rerating." };
  drift.decisionHistory = [
    createHistoryEntry(
      "m5-drift-decision",
      "watch",
      "Watch while waiting for the rerating.",
      QA_NOW - 6 * DAY_MS,
      QA_NOW + 10 * DAY_MS,
      "Check whether the rerating already played out.",
      { kind: "analysis", data: buildAnalysisDecisionSnapshot(driftSnapshotSource, QA_NOW - 6 * DAY_MS) },
    ),
  ];

  const shared = baseAnalysis("qa-m5-shared", "conventional");
  shared.title = "QA M5 Shared Exposure";
  shared.assetName = shared.title;
  shared.ic.review.lastReviewedAt = QA_NOW - DAY_MS;
  shared.ic.review.nextReviewDue = QA_NOW + 6 * DAY_MS;
  shared.tags = ["rates"];
  shared.ic.thesis.assumptions = [
    {
      id: "m5-shared-assumption",
      text: "Rates and refinancing costs drive the next review.",
      status: "active",
      createdAt: QA_NOW - 8 * DAY_MS,
      updatedAt: QA_NOW - DAY_MS,
    },
  ];

  const quiet = baseAnalysis("qa-m5-quiet", "startups");
  quiet.title = "QA M5 Quiet Name";
  quiet.assetName = quiet.title;
  quiet.ic.review.lastReviewedAt = QA_NOW - DAY_MS;
  quiet.ic.review.nextReviewDue = QA_NOW + 14 * DAY_MS;
  quiet.tags = [];
  quiet.ic.thesis.assumptions = [];
  quiet.evidence = [];

  const analyses = [stale, drift, shared, quiet];
  const memberById = new Map(analyses.map((analysis) => [analysis.id, analysis] as const));
  const portfolio: PortfolioAnalysis = {
    id: "qa-m5-portfolio",
    title: "QA M5 Portfolio Follow-Up",
    members: [
      { analysisId: stale.id, capital: 600_000_000 },
      { analysisId: drift.id, capital: 250_000_000 },
      { analysisId: shared.id, capital: 150_000_000 },
    ],
    tags: ["rates", "shared_exposure"],
    folderId: null,
    chat: [],
    allowWebSearch: false,
    persona: null,
    stance: { label: "CONCENTRATED", basis: "Largest position still dominates capital." },
    debate: null,
    advisory: null,
    decisionHistory: [],
    createdAt: QA_NOW,
    updatedAt: QA_NOW,
  };
  const portfolioMetrics = computePortfolioMetrics(portfolio.members, memberById);
  const portfolioSnapshot = {
    ...portfolio,
    stance: { label: "BALANCED", basis: "Older snapshot before concentration increased." },
  };
  portfolio.decisionHistory = [
    createHistoryEntry(
      "m5-portfolio-follow-up",
      "watch",
      "Revisit the concentration after the next review window.",
      QA_NOW - 8 * DAY_MS,
      QA_NOW - 2 * DAY_MS,
      "Review portfolio concentration follow-up.",
      { kind: "portfolio", data: buildPortfolioDecisionSnapshot(portfolioSnapshot, portfolioMetrics, QA_NOW - 8 * DAY_MS) },
    ),
  ];

  return buildEnvelope({
    analyses,
    portfolios: [portfolio],
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
  if (name === "m1") {
    return m1Fixture();
  }
  if (name === "m2") {
    return buildEnvelope({ analyses: [], portfolios: [], folders: [], blobs: [] });
  }
  if (name === "m3") {
    return buildEnvelope({ analyses: [stockProvenanceFixture()], portfolios: [], folders: [], blobs: [] });
  }
  if (name === "m4") {
    return buildEnvelope({ analyses: [evidenceFixture()], portfolios: [], folders: [], blobs: [] });
  }
  if (name === "m5") {
    return m5Fixture();
  }
  if (name === "m6") {
    return m6Fixture();
  }
  if (name === "m7") {
    return buildEnvelope({ analyses: [], portfolios: [], folders: [], blobs: [] });
  }
  if (name === "broken-m4") {
    return brokenM4Fixture();
  }
  return buildEnvelope({ analyses: [], portfolios: [], folders: [], blobs: [] });
}

export function qaFixtureNames(): QaFixtureName[] {
  return ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "broken-m4"];
}

function createHistoryEntry(
  id: string,
  action: NonNullable<DecisionEntry["action"]>,
  rationale: string,
  decidedAt: number,
  dueAt: number,
  note: string,
  snapshot: DecisionEntry["snapshot"],
): DecisionEntry {
  return {
    id,
    decidedAt,
    action,
    rationale,
    trigger: { dueAt, note },
    snapshot,
    review: null,
  };
}
