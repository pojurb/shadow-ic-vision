import { describe, expect, it } from "vitest";
import { BLANK_PARAMS } from "@/data/presets";
import { computeMetrics } from "@/lib/finance/compute";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { createAnalysis, createPortfolio } from "@/lib/repo";
import {
  addDecisionReview,
  buildAnalysisDecisionSnapshot,
  buildPortfolioDecisionSnapshot,
  deriveStatusFromDecisionHistory,
  normalizeDecisionHistory,
  validateDecisionDraft,
} from "./decisions";

describe("decision validation", () => {
  it("requires rationale for every action", () => {
    const result = validateDecisionDraft({
      action: "watch",
      rationale: " ",
      triggerDueAt: Date.now(),
      triggerNote: "Review next quarter",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.rationale).toBeTruthy();
  });

  it("requires pre-mortem for add/increase decisions", () => {
    const result = validateDecisionDraft({
      action: "add_increase_position",
      rationale: "Mispriced risk/reward",
      triggerDueAt: Date.now(),
      triggerNote: "Check thesis breaker",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.preMortem).toBeTruthy();
  });

  it("allows archive without a review trigger", () => {
    const result = validateDecisionDraft({ action: "archive", rationale: "No longer relevant" });
    expect(result.valid).toBe(true);
  });
});

describe("decision normalization", () => {
  it("normalizes a legacy decision without fabricating a snapshot", () => {
    const history = normalizeDecisionHistory(undefined, {
      action: "APPROVE",
      rationale: "Legacy rationale",
      decidedAt: 123,
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      action: null,
      legacyAction: "APPROVE",
      rationale: "Legacy rationale",
      decidedAt: 123,
      trigger: null,
      review: null,
    });
    expect(history[0].snapshot).toEqual({
      kind: "legacy",
      data: { reason: "legacy_decision_without_snapshot", capturedAt: 123 },
    });
  });

  it("is idempotent for current history", () => {
    const history = normalizeDecisionHistory(undefined, {
      action: "HOLD",
      rationale: "Legacy hold",
      decidedAt: 456,
    });
    expect(normalizeDecisionHistory(history)).toEqual(history);
  });
});

describe("decision status and review", () => {
  it("derives status from current and legacy history", () => {
    expect(deriveStatusFromDecisionHistory([])).toBe("draft");
    expect(deriveStatusFromDecisionHistory([{ ...legacy("HOLD"), legacyAction: "HOLD" }])).toBe("watching");
    expect(deriveStatusFromDecisionHistory([{ ...legacy("REJECT"), legacyAction: "REJECT" }])).toBe("archived");
    expect(deriveStatusFromDecisionHistory([{ ...legacy("APPROVE"), legacyAction: "APPROVE" }])).toBe("decided");
    expect(deriveStatusFromDecisionHistory([{ ...legacy("APPROVE"), action: "archive" }])).toBe("archived");
  });

  it("allows only one outcome review", () => {
    const entry = legacy("APPROVE");
    const reviewed = addDecisionReview(entry, {
      outcome: "worked",
      reasoningAssessment: "right_right_reason",
      notes: "Thesis played out.",
    }, 789);
    expect(reviewed.review?.reviewedAt).toBe(789);
    expect(() =>
      addDecisionReview(reviewed, {
        outcome: "mixed",
        reasoningAssessment: "unclear",
        notes: "Second pass",
      }),
    ).toThrow(/already/i);
  });
});

describe("decision snapshots", () => {
  it("freezes analysis thesis, metrics, stance, sources, and evidence candidates", () => {
    const analysis = createAnalysis({
      title: "Snapshot test",
      vertical: "stocks",
      assetName: "Snapshot Asset",
      parameters: { ...BLANK_PARAMS.stocks },
      metrics: computeMetrics("stocks", { ...BLANK_PARAMS.stocks }),
      model: "test",
    });
    analysis.ic.thesis.summary = "Durable thesis";
    analysis.ic.thesis.evidenceCandidates = [{
      id: "ev1",
      title: "Source",
      type: "filing",
      relation: "supporting",
      reliability: "official",
      createdAt: 1,
    }];
    analysis.sources = [{ id: "src1", kind: "link", url: "https://example.com", createdAt: 1 }];
    analysis.stance = { label: "UNDERVALUED", basis: "Basis" };

    const snapshot = buildAnalysisDecisionSnapshot(analysis, 999);
    expect(snapshot.thesis.summary).toBe("Durable thesis");
    expect(snapshot.metrics.metrics).toEqual(analysis.metrics.metrics);
    expect(snapshot.stance?.label).toBe("UNDERVALUED");
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.evidenceCandidates).toHaveLength(1);

    analysis.ic.thesis.summary = "Changed later";
    expect(snapshot.thesis.summary).toBe("Durable thesis");
  });

  it("freezes portfolio members, weights, metrics, and linked analysis ids", () => {
    const analysis = createAnalysis({
      title: "Holding",
      vertical: "stocks",
      assetName: "Holding",
      parameters: { ...BLANK_PARAMS.stocks },
      metrics: computeMetrics("stocks", { ...BLANK_PARAMS.stocks }),
      model: "test",
    });
    const portfolio = createPortfolio("Portfolio", [{ analysisId: analysis.id, capital: 100 }]);
    const byId = new Map([[analysis.id, analysis]]);
    const metrics = computePortfolioMetrics(portfolio.members, byId);
    const snapshot = buildPortfolioDecisionSnapshot(portfolio, metrics, 999);

    expect(snapshot.members).toEqual([{ analysisId: analysis.id, capital: 100 }]);
    expect(snapshot.positions[0].analysisId).toBe(analysis.id);
    expect(snapshot.metrics.totalCapital).toBe(100);
  });
});

function legacy(action: "APPROVE" | "HOLD" | "REJECT") {
  return normalizeDecisionHistory(undefined, {
    action,
    rationale: "Legacy",
    decidedAt: 1,
  })[0];
}
