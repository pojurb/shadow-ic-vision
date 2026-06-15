import { describe, it, expect } from "vitest";
import { derivePortfolioStance, PORTFOLIO_PERSONA } from "./personas";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { computeMetrics } from "@/lib/finance/compute";
import { BLANK_PARAMS, type Vertical } from "@/data/presets";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import type { Analysis, PortfolioMember } from "@/lib/domain/types";

/** Minimal member analysis carrying real engine metrics + an explicit stance label. */
function analysis(id: string, vertical: Vertical, name: string, stance: string | null): Analysis {
  const parameters = { ...BLANK_PARAMS[vertical] };
  return {
    id,
    title: name,
    vertical,
    assetName: name,
    assetMeta: { currency: "IDR" },
    tags: [],
    folderId: null,
    assetType: assetTypeForVertical(vertical),
    ic: createDefaultICState(0),
    parameters,
    metrics: computeMetrics(vertical, parameters),
    debate: null,
    advisory: null,
    persona: null,
    stance: stance ? { label: stance, basis: "" } : null,
    expertReview: null,
    sources: [],
    evidence: [],
    allowWebSearch: false,
    chat: [],
    decision: null,
    model: "seed",
    status: "draft",
    createdAt: 0,
    updatedAt: 0,
  };
}

function metricsFor(rows: { a: Analysis; capital: number }[]) {
  const byId = new Map(rows.map((r) => [r.a.id, r.a]));
  const members: PortfolioMember[] = rows.map((r) => ({ analysisId: r.a.id, capital: r.capital }));
  return computePortfolioMetrics(members, byId);
}

describe("derivePortfolioStance — engine-derived, never AI-authored", () => {
  it("returns null for an empty portfolio", () => {
    expect(derivePortfolioStance(computePortfolioMetrics([], new Map()))).toBeNull();
  });

  it("flags CONCENTRATED when a holding exceeds 40% — regardless of conviction", () => {
    // All three holdings are positive-conviction, but one is 60% of capital.
    const m = metricsFor([
      { a: analysis("a", "stocks", "BBCA", "UNDERVALUED"), capital: 600 },
      { a: analysis("b", "startups", "Pay", "BACKABLE"), capital: 300 },
      { a: analysis("c", "conventional", "Kopi", "VIABLE"), capital: 100 },
    ]);
    expect(derivePortfolioStance(m)?.label).toBe("CONCENTRATED");
  });

  it("is CONSTRUCTIVE when balanced and ≥60% of holdings are positive-conviction", () => {
    const m = metricsFor([
      { a: analysis("a", "stocks", "A", "UNDERVALUED"), capital: 100 },
      { a: analysis("b", "startups", "B", "BACKABLE"), capital: 100 },
      { a: analysis("c", "conventional", "C", "MARGINAL"), capital: 100 }, // neutral
    ]);
    // 2/3 positive, top weight ~33% (balanced) → CONSTRUCTIVE
    expect(derivePortfolioStance(m)?.label).toBe("CONSTRUCTIVE");
  });

  it("is DEFENSIVE when balanced and ≥60% of holdings are negative-conviction", () => {
    const m = metricsFor([
      { a: analysis("a", "stocks", "A", "OVERVALUED"), capital: 100 },
      { a: analysis("b", "startups", "B", "UNPROVEN"), capital: 100 },
      { a: analysis("c", "conventional", "C", "VIABLE"), capital: 100 }, // positive
    ]);
    // 2/3 negative, balanced weights → DEFENSIVE
    expect(derivePortfolioStance(m)?.label).toBe("DEFENSIVE");
  });

  it("is BALANCED when balanced weights and conviction is split (<60% either way)", () => {
    const m = metricsFor([
      { a: analysis("a", "stocks", "A", "UNDERVALUED"), capital: 100 }, // positive
      { a: analysis("b", "startups", "B", "UNPROVEN"), capital: 100 }, // negative
      { a: analysis("c", "conventional", "C", "MARGINAL"), capital: 100 }, // neutral
    ]);
    expect(derivePortfolioStance(m)?.label).toBe("BALANCED");
  });

  it("produces a basis that quotes only engine display strings", () => {
    const m = metricsFor([
      { a: analysis("a", "stocks", "BBCA", "UNDERVALUED"), capital: 600 },
      { a: analysis("b", "startups", "Pay", "BACKABLE"), capital: 400 },
    ]);
    const basis = derivePortfolioStance(m)?.basis ?? "";
    const top = m.metrics.find((x) => x.key === "topWeight")!.display;
    const mix = m.metrics.find((x) => x.key === "stanceMix")!.display;
    expect(basis).toContain(top);
    expect(basis).toContain(mix);
  });

  it("exposes the stance deriver on the persona registry", () => {
    expect(PORTFOLIO_PERSONA.stance.derive).toBe(derivePortfolioStance);
    expect(PORTFOLIO_PERSONA.debateSlots).toHaveLength(4);
    expect(PORTFOLIO_PERSONA.lenses).toHaveLength(4);
  });
});
