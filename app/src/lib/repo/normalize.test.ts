import { describe, it, expect } from "vitest";
import { normalizeAnalysis } from "./index";
import type { Analysis } from "@/lib/domain/types";

/** An analysis persisted in the OLD shape (pre-persona migration). */
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

describe("normalizeAnalysis — back-compat on read", () => {
  it("converts the old advisory object to a lens array", () => {
    const n = normalizeAnalysis(legacyAnalysis());
    expect(Array.isArray(n.advisory)).toBe(true);
    expect(n.advisory).toHaveLength(3);
    expect(n.advisory?.[0]).toMatchObject({ id: "operator", text: "operator text" });
  });

  it("buckets numeric confidence into a discrete thesisSupport", () => {
    expect(normalizeAnalysis(legacyAnalysis()).debate?.thesisSupport).toBe("STRONG"); // 85
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

  it("is idempotent — re-normalizing a current-shape record is a no-op", () => {
    const once = normalizeAnalysis(legacyAnalysis());
    const twice = normalizeAnalysis(once);
    expect(twice.advisory).toEqual(once.advisory);
    expect(twice.debate?.thesisSupport).toBe(once.debate?.thesisSupport);
    expect(twice.persona).toEqual(once.persona);
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
