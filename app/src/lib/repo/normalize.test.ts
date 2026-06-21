import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "./index";
import type { Analysis } from "@/lib/domain/types";
import { createEvidenceItem } from "@/lib/domain/evidence";

/** An analysis persisted in the old shape before persona migration. */
function legacyAnalysis(): Analysis {
  return {
    vertical: "stocks",
    metrics: {
      vertical: "stocks",
      metrics: [
        { key: "pe", label: "P/E", value: 11, display: "11.1x", verdict: "DISCOUNT" },
        { key: "mos", label: "MoS", value: 15, display: "15%" },
      ],
    },
    debate: { confidence: 85, bull: [{ agent: "a", text: "t" }], bear: [] },
    advisory: {
      operator: { title: "Operator", text: "operator text" },
      risk: { title: "Risk", text: "risk text" },
      predator: { title: "Predator", text: "predator text" },
    },
  } as unknown as Analysis;
}

describe("normalizeAnalysis back-compat on read", () => {
  it("converts the old advisory object to a lens array", () => {
    const n = normalizeAnalysis(legacyAnalysis());
    expect(Array.isArray(n.advisory)).toBe(true);
    expect(n.advisory).toHaveLength(3);
    expect(n.advisory?.[0]).toMatchObject({ id: "operator", text: "operator text" });
  });

  it("buckets numeric confidence into a discrete thesisSupport", () => {
    expect(normalizeAnalysis(legacyAnalysis()).debate?.thesisSupport).toBe("STRONG");
  });

  it("backfills persona identity and the engine stance", () => {
    const n = normalizeAnalysis(legacyAnalysis());
    expect(n.persona?.id).toBe("equity-analyst");
    expect(n.stance?.label).toBe("UNDERVALUED");
    expect(n.expertReview).toBeNull();
  });

  it("backfills asset type and empty IC thesis memory", () => {
    const n = normalizeAnalysis(legacyAnalysis());
    expect(n.assetType).toBe("public_equity");
    expect(n.ic.thesis.summary).toBe("");
    expect(n.ic.thesis.assumptions).toEqual([]);
    expect(n.ic.review.cadence).toBe("weekly");
    expect(Array.isArray(n.stockFields)).toBe(true);
    expect(n.evidence).toEqual([]);
  });

  it("normalizes malformed legacy IC fields into the current shape", () => {
    const raw = legacyAnalysis();
    raw.assetType = undefined as unknown as Analysis["assetType"];
    raw.ic = {
      thesis: {
        summary: "Legacy thesis",
        assumptions: "not an array",
        thesisBreakers: [{ id: "breaker", text: "Funding breaks", severity: "material", createdAt: 1 }],
        watchItems: undefined,
        valuationAssumptions: null,
        catalysts: [{ id: "cat", text: "Catalyst", createdAt: 1 }],
        openQuestions: "none",
        evidenceCandidates: [{ id: "candidate", title: "Candidate", createdAt: 1 }],
        conviction: "certain",
      },
      review: {
        cadence: "daily",
        lastReviewedAt: "2026-06-01",
        nextReviewDue: "2026-06-15",
      },
    } as unknown as Analysis["ic"];

    const n = normalizeAnalysis(raw);
    expect(n.assetType).toBe("public_equity");
    expect(n.ic.thesis.summary).toBe("Legacy thesis");
    expect(n.ic.thesis.assumptions).toEqual([]);
    expect(n.ic.thesis.thesisBreakers).toHaveLength(1);
    expect(n.ic.thesis.catalysts).toHaveLength(1);
    expect(n.ic.thesis.openQuestions).toEqual([]);
    expect(n.ic.thesis.evidenceCandidates).toHaveLength(1);
    expect(n.ic.thesis.conviction).toBeNull();
    expect(n.ic.review.cadence).toBe("weekly");
    expect(n.ic.review.lastReviewedAt).toBeNull();
    expect(typeof n.ic.review.nextReviewDue).toBe("number");
  });

  it("keeps normalization idempotent for current-shape records", () => {
    const once = normalizeAnalysis(legacyAnalysis());
    const twice = normalizeAnalysis(once);
    expect(twice.advisory).toEqual(once.advisory);
    expect(twice.debate?.thesisSupport).toBe(once.debate?.thesisSupport);
    expect(twice.persona).toEqual(once.persona);
  });

  it("normalizes the explicit triage review mode safely", () => {
    const raw = legacyAnalysis();
    (raw as Analysis & { reviewMode?: unknown }).reviewMode = "kickoff";
    expect(normalizeAnalysis(raw).reviewMode).toBe("kickoff");

    (raw as Analysis & { reviewMode?: unknown }).reviewMode = "unknown";
    expect(normalizeAnalysis(raw).reviewMode).toBeNull();
  });
});

describe("normalizeAnalysis evidence compatibility", () => {
  it("promotes legacy evidence candidates into analysis evidence on read", () => {
    const raw = legacyAnalysis();
    raw.ic = {
      thesis: {
        summary: "",
        assumptions: [],
        thesisBreakers: [],
        watchItems: [],
        valuationAssumptions: [],
        catalysts: [],
        openQuestions: [],
        conviction: null,
        evidenceCandidates: [{
          id: "candidate-1",
          title: "Visible source",
          url: "https://example.com/source",
          type: "article",
          relation: "supporting",
          reliability: "third_party",
          createdAt: 1,
        }],
      },
      review: { cadence: "weekly", lastReviewedAt: null, nextReviewDue: null },
    };

    const n = normalizeAnalysis(raw);
    expect(n.evidence).toHaveLength(1);
    expect(n.evidence[0]).toMatchObject({
      id: "candidate-1",
      title: "Visible source",
      url: "https://example.com/source",
      relation: "supporting",
    });
  });

  it("keeps persisted evidence and dedupes matching legacy candidates", () => {
    const raw = legacyAnalysis();
    raw.evidence = [{
      id: "persisted",
      title: "Persisted source",
      type: "filing",
      relation: "contradictory",
      reliability: "official",
      sourceDate: "2026-01-01",
      url: "https://example.com/source",
      sourceRefIds: ["src1"],
      thesisRefs: [{ target: "summary", id: null }],
      createdAt: 1,
      updatedAt: 2,
    }];
    raw.ic = {
      thesis: {
        summary: "Thesis",
        assumptions: [],
        thesisBreakers: [],
        watchItems: [],
        valuationAssumptions: [],
        catalysts: [],
        openQuestions: [],
        conviction: null,
        evidenceCandidates: [{
          id: "candidate-1",
          title: "Candidate duplicate",
          url: "https://example.com/source",
          type: "article",
          relation: "supporting",
          reliability: "third_party",
          createdAt: 1,
        }],
      },
      review: { cadence: "weekly", lastReviewedAt: null, nextReviewDue: null },
    };

    const n = normalizeAnalysis(raw);
    expect(n.evidence).toHaveLength(1);
    expect(n.evidence[0].id).toBe("persisted");
    expect(n.evidence[0].sourceRefIds).toEqual(["src1"]);
  });
});

describe("normalizeAnalysis manual asset compatibility", () => {
  it("normalizes a manual asset with nullable vertical and metrics", () => {
    const raw = legacyAnalysis();
    raw.valuationMode = "manual";
    raw.vertical = null as unknown as Analysis["vertical"];
    raw.metrics = null as unknown as Analysis["metrics"];
    raw.assetType = "real_estate";
    raw.manualMeta = {
      valuationAmount: 1_250_000_000,
      valuationDate: "2026-06-16",
      valuationSource: "Broker opinion",
      pricingFreshness: "Quarterly",
      liquidity: "Illiquid",
      expectedDuration: "3-5 years",
      portfolioRole: "Income",
      sizingIntent: "Small starter",
      macroDependencies: ["rates"],
      riskNotes: [{ promptId: "illiquidity_exit", note: "Exit through sale only." }],
    };

    const n = normalizeAnalysis(raw);
    expect(n.valuationMode).toBe("manual");
    expect(n.vertical).toBeNull();
    expect(n.metrics).toBeNull();
    expect(n.manualMeta?.valuationAmount).toBe(1_250_000_000);
    expect(n.manualMeta?.riskNotes.find((note) => note.promptId === "valuation_quality")).toBeTruthy();
  });

  it("backfills kickoff for legacy manual triage reviews imported from Explore", () => {
    const raw = legacyAnalysis();
    raw.valuationMode = "manual";
    raw.vertical = null as unknown as Analysis["vertical"];
    raw.metrics = null as unknown as Analysis["metrics"];
    raw.assetType = "conventional_business";
    raw.tags = ["triage"];
    raw.evidence = [
      createEvidenceItem({
        title: "Imported from Exploration",
        type: "transcript",
        relation: "unresolved",
        reliability: "user_provided",
        note: "private logistics business in France",
      }),
    ];

    const n = normalizeAnalysis(raw);
    expect(n.reviewMode).toBe("kickoff");
  });

  it("does not force kickoff when a manual triage review already has decisions", () => {
    const raw = legacyAnalysis();
    raw.valuationMode = "manual";
    raw.vertical = null as unknown as Analysis["vertical"];
    raw.metrics = null as unknown as Analysis["metrics"];
    raw.assetType = "conventional_business";
    raw.tags = ["triage"];
    raw.evidence = [
      createEvidenceItem({
        title: "Imported from Exploration",
        type: "transcript",
        relation: "unresolved",
        reliability: "user_provided",
        note: "private logistics business in France",
      }),
    ];
    raw.decisionHistory = [
      {
        id: "decision-1",
        decidedAt: 1,
        action: "watch",
        rationale: "Need more diligence",
        trigger: null,
        snapshot: { kind: "legacy", data: { reason: "legacy_decision_without_snapshot", capturedAt: 1 } },
        review: null,
      },
    ];

    const n = normalizeAnalysis(raw);
    expect(n.reviewMode).toBeNull();
  });
});
