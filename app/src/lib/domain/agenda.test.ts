import { describe, expect, it } from "vitest";
import { memberFromPreset, mixedPortfolio } from "@/lib/ai/eval/fixtures";
import { buildAnalysisDecisionSnapshot, buildPortfolioDecisionSnapshot } from "@/lib/domain/decisions";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import {
  AGENDA_STALE_THRESHOLD_MS,
  agendaItemMatchesFilter,
  deriveAgendaItems,
  filterAgendaItems,
} from "./agenda";

const NOW = Date.parse("2026-06-17T00:00:00Z");

describe("agenda derivation", () => {
  it("distinguishes review due from stale thesis after the grace threshold", () => {
    const due = analysisFixture("due");
    due.ic.review.nextReviewDue = NOW - 2 * DAY_MS;

    const stale = analysisFixture("stale");
    stale.ic.review.nextReviewDue = NOW - AGENDA_STALE_THRESHOLD_MS - DAY_MS;

    const items = deriveAgendaItems([due, stale], [], NOW);
    const dueItem = items.find((item) => item.target.id === due.id)!;
    const staleItem = items.find((item) => item.target.id === stale.id)!;

    expect(dueItem.reasons.some((reason) => reason.category === "review_due")).toBe(true);
    expect(dueItem.reasons.some((reason) => reason.category === "stale_thesis")).toBe(false);
    expect(staleItem.reasons.some((reason) => reason.category === "stale_thesis")).toBe(true);
  });

  it("detects contradiction pressure from contradictory evidence", () => {
    const analysis = analysisFixture("contradiction");
    analysis.ic.thesis.assumptions = [
      { id: "assumption-1", text: "Deposit costs stay low", status: "active", createdAt: NOW, updatedAt: NOW },
    ];
    analysis.evidence = [
      {
        id: "ev-1",
        title: "Funding stress",
        type: "article",
        relation: "contradictory",
        reliability: "third_party",
        sourceDate: "2026-06-15",
        sourceRefIds: [],
        thesisRefs: [{ target: "assumption", id: "assumption-1" }],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    const item = deriveAgendaItems([analysis], [], NOW)[0];
    expect(item.reasons.find((reason) => reason.category === "contradiction_pressure")?.message).toMatch(/Deposit costs stay low/i);
  });

  it("detects valuation drift for analyses against the latest decision snapshot", () => {
    const analysis = analysisFixture("analysis-drift");
    analysis.stance = { label: "FAIR", basis: "Current read." };
    const previous = analysisFixture("analysis-drift");
    previous.stance = { label: "UNDERVALUED", basis: "Earlier read." };
    analysis.decisionHistory = [
      {
        id: "decision-1",
        decidedAt: NOW - DAY_MS,
        action: "watch",
        rationale: "Keep following it.",
        trigger: { dueAt: NOW + DAY_MS, note: "Revisit" },
        snapshot: { kind: "analysis", data: buildAnalysisDecisionSnapshot(previous, NOW - DAY_MS) },
        review: null,
      },
    ];

    const item = deriveAgendaItems([analysis], [], NOW)[0];
    expect(item.reasons.some((reason) => reason.category === "valuation_drift")).toBe(true);
  });

  it("detects shared macro exposure across assumptions, tags, and manual dependencies", () => {
    const one = analysisFixture("one");
    one.tags = ["rates"];
    one.ic.thesis.assumptions = [
      { id: "a1", text: "Rates stay high", status: "active", createdAt: NOW, updatedAt: NOW },
    ];

    const two = analysisFixture("two");
    two.assetType = "real_estate";
    two.valuationMode = "manual";
    two.vertical = null;
    two.metrics = null;
    two.manualMeta = {
      valuationAmount: 100,
      valuationDate: "2026-06-10",
      valuationSource: "Broker",
      pricingFreshness: "Quarterly",
      liquidity: "Illiquid",
      expectedDuration: "5 years",
      portfolioRole: "Income",
      sizingIntent: "Core",
      macroDependencies: ["rates", "refinancing"],
      riskNotes: [],
    };
    two.ic.review.nextReviewDue = NOW + DAY_MS;

    const items = deriveAgendaItems([one, two], [], NOW);
    expect(items.every((item) => item.reasons.some((reason) => reason.category === "shared_macro_exposure"))).toBe(true);
  });

  it("detects overdue decision follow-up for portfolios without review cadence", () => {
    const { portfolio, members, byId } = mixedPortfolio();
    portfolio.decisionHistory = [
      {
        id: "portfolio-decision",
        decidedAt: NOW - DAY_MS,
        action: "watch",
        rationale: "Follow concentration risk.",
        trigger: { dueAt: NOW - DAY_MS, note: "Review after earnings" },
        snapshot: {
          kind: "portfolio",
          data: buildPortfolioDecisionSnapshot(portfolio, buildPortfolioMetricsForTest(portfolio, byId), NOW - DAY_MS),
        },
        review: null,
      },
    ];

    const item = deriveAgendaItems(members, [portfolio], NOW).find((entry) => entry.target.kind === "portfolio")!;
    expect(item.reasons.some((reason) => reason.category === "decision_follow_up")).toBe(true);
  });

  it("ranks overdue and stale items above shared-exposure-only items", () => {
    const urgent = analysisFixture("urgent");
    urgent.ic.review.nextReviewDue = NOW - AGENDA_STALE_THRESHOLD_MS - DAY_MS;

    const overlapA = analysisFixture("overlap-a");
    overlapA.tags = ["rates"];
    overlapA.ic.review.nextReviewDue = NOW + DAY_MS;

    const overlapB = analysisFixture("overlap-b");
    overlapB.tags = ["rates"];
    overlapB.ic.review.nextReviewDue = NOW + DAY_MS;

    const items = deriveAgendaItems([urgent, overlapA, overlapB], [], NOW);
    expect(items[0].target.id).toBe("urgent");
    expect(items[0].priorityScore).toBeGreaterThan(items[1].priorityScore);
  });

  it("degrades gracefully for analyses without evidence or decisions", () => {
    const analysis = analysisFixture("graceful");
    analysis.evidence = [];
    analysis.decisionHistory = [];
    analysis.ic.review.nextReviewDue = NOW + DAY_MS;

    expect(deriveAgendaItems([analysis], [], NOW)).toEqual([]);
  });

  it("keeps manual assets eligible without engine metrics", () => {
    const analysis = analysisFixture("manual");
    analysis.assetType = "crypto";
    analysis.valuationMode = "manual";
    analysis.vertical = null;
    analysis.metrics = null;
    analysis.manualMeta = {
      valuationAmount: 100,
      valuationDate: "2026-06-10",
      valuationSource: "Desk marks",
      pricingFreshness: "Stale",
      liquidity: "Thin",
      expectedDuration: "Open",
      portfolioRole: "Optionality",
      sizingIntent: "Small",
      macroDependencies: ["liquidity", "rates"],
      riskNotes: [],
    };
    analysis.ic.review.nextReviewDue = NOW - DAY_MS;

    const item = deriveAgendaItems([analysis], [], NOW)[0];
    expect(item.target.id).toBe("manual");
    expect(item.reasons.some((reason) => reason.category === "review_due")).toBe(true);
  });

  it("supports agenda filters for due, stale, contradiction, drift, and status", () => {
    const due = analysisFixture("due-filter");
    due.ic.review.nextReviewDue = NOW - DAY_MS;

    const contradictory = analysisFixture("contradictory-filter");
    contradictory.evidence = [
      {
        id: "ev-1",
        title: "Pushback",
        type: "note",
        relation: "contradictory",
        reliability: "user_provided",
        sourceDate: null,
        sourceRefIds: [],
        thesisRefs: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    const drift = analysisFixture("drift-filter");
    const previous = analysisFixture("drift-filter");
    previous.stance = { label: "UNDERVALUED", basis: "Before" };
    drift.stance = { label: "FAIR", basis: "After" };
    drift.decisionHistory = [
      {
        id: "decision-2",
        decidedAt: NOW - DAY_MS,
        action: "watch",
        rationale: "Track it",
        trigger: { dueAt: NOW + DAY_MS, note: "Later" },
        snapshot: { kind: "analysis", data: buildAnalysisDecisionSnapshot(previous, NOW - DAY_MS) },
        review: null,
      },
    ];
    const items = deriveAgendaItems([due, contradictory, drift], [], NOW);
    expect(filterAgendaItems(items, "due_now", NOW).map((item) => item.target.id)).toContain("due-filter");
    expect(filterAgendaItems(items, "contradictory_evidence", NOW).map((item) => item.target.id)).toEqual(["contradictory-filter"]);
    expect(filterAgendaItems(items, "valuation_drift", NOW).map((item) => item.target.id)).toEqual(["drift-filter"]);
    const driftItem = items.find((item) => item.target.id === "drift-filter")!;
    expect(agendaItemMatchesFilter(driftItem, "watching", NOW)).toBe(true);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

function analysisFixture(id: string) {
  const analysis = memberFromPreset(id, "stocks");
  analysis.title = id;
  analysis.assetName = id;
  analysis.ic.review.nextReviewDue = NOW + 5 * DAY_MS;
  analysis.ic.review.lastReviewedAt = NOW - DAY_MS;
  return analysis;
}

function buildPortfolioMetricsForTest(
  portfolio: ReturnType<typeof mixedPortfolio>["portfolio"],
  byId: ReturnType<typeof mixedPortfolio>["byId"],
) {
  return computePortfolioMetrics(portfolio.members, byId);
}
