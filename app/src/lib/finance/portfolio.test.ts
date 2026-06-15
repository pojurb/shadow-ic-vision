import { describe, it, expect } from "vitest";
import { computePortfolioMetrics } from "./portfolio";
import { computeMetrics } from "./compute";
import { normalizePortfolio } from "@/lib/repo";
import { BLANK_PARAMS, type Vertical } from "@/data/presets";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import type { Analysis, PortfolioMember, PortfolioAnalysis } from "@/lib/domain/types";

/** Minimal member analysis with real engine metrics and an explicit stance label. */
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
    allowWebSearch: false,
    chat: [],
    decision: null,
    model: "seed",
    status: "draft",
    createdAt: 0,
    updatedAt: 0,
  };
}

function mapOf(...rows: Analysis[]): Map<string, Analysis> {
  return new Map(rows.map((a) => [a.id, a]));
}

const metric = (m: ReturnType<typeof computePortfolioMetrics>, key: string) =>
  m.metrics.find((x) => x.key === key)!;

describe("computePortfolioMetrics", () => {
  it("computes total capital and weights that sum to 1 across mixed verticals", () => {
    const byId = mapOf(
      analysis("a", "stocks", "BBCA", "UNDERVALUED"),
      analysis("b", "startups", "PayGuard", "CONDITIONAL"),
      analysis("c", "conventional", "SpinExpress", "VIABLE"),
    );
    const members: PortfolioMember[] = [
      { analysisId: "a", capital: 600_000_000 },
      { analysisId: "b", capital: 300_000_000 },
      { analysisId: "c", capital: 100_000_000 },
    ];
    const r = computePortfolioMetrics(members, byId);
    expect(r.totalCapital).toBe(1_000_000_000);
    expect(r.positions.map((p) => p.weight)).toEqual([0.6, 0.3, 0.1]);
    expect(r.positions.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(1, 10);
    expect(metric(r, "holdings").value).toBe(3);
  });

  it("reports allocation by vertical and flags a concentrated top position", () => {
    const byId = mapOf(
      analysis("a", "stocks", "BBCA", "FAIR"),
      analysis("b", "startups", "PayGuard", "CONDITIONAL"),
      analysis("c", "conventional", "Kopi", "VIABLE"),
    );
    const r = computePortfolioMetrics(
      [
        { analysisId: "a", capital: 600_000_000 },
        { analysisId: "b", capital: 300_000_000 },
        { analysisId: "c", capital: 100_000_000 },
      ],
      byId,
    );
    expect(metric(r, "byVertical").display).toBe("Stocks 60% · Startups 30% · Conv 10%");
    expect(metric(r, "topWeight").display).toBe("BBCA 60%");
    expect(metric(r, "topWeight").verdict).toBe("CONCENTRATED");
  });

  it("marks a balanced top position when no holding exceeds 40%", () => {
    const byId = mapOf(
      analysis("a", "stocks", "A", "FAIR"),
      analysis("b", "stocks", "B", "FAIR"),
      analysis("c", "stocks", "C", "FAIR"),
    );
    const r = computePortfolioMetrics(
      [
        { analysisId: "a", capital: 350_000_000 },
        { analysisId: "b", capital: 350_000_000 },
        { analysisId: "c", capital: 300_000_000 },
      ],
      byId,
    );
    expect(metric(r, "topWeight").verdict).toBe("BALANCED");
  });

  it("counts stance mix per engine-derived label", () => {
    const byId = mapOf(
      analysis("a", "stocks", "A", "UNDERVALUED"),
      analysis("b", "stocks", "B", "UNDERVALUED"),
      analysis("c", "stocks", "C", "FAIR"),
    );
    const r = computePortfolioMetrics(
      [
        { analysisId: "a", capital: 1 },
        { analysisId: "b", capital: 1 },
        { analysisId: "c", capital: 1 },
      ],
      byId,
    );
    expect(metric(r, "stanceMix").display).toBe("UNDERVALUED ×2 · FAIR ×1");
  });

  it("skips a member whose analysis is missing from the map", () => {
    const byId = mapOf(analysis("a", "stocks", "A", "FAIR"));
    const r = computePortfolioMetrics(
      [
        { analysisId: "a", capital: 500_000_000 },
        { analysisId: "ghost", capital: 500_000_000 }, // deleted holding
      ],
      byId,
    );
    expect(r.positions).toHaveLength(1);
    expect(r.totalCapital).toBe(500_000_000);
    expect(r.positions[0].weight).toBe(1);
  });

  it("handles an empty portfolio without NaN or divide-by-zero", () => {
    const r = computePortfolioMetrics([], new Map());
    expect(r.totalCapital).toBe(0);
    expect(r.positions).toEqual([]);
    expect(metric(r, "holdings").value).toBe(0);
    expect(metric(r, "topWeight").display).toBe("—");
    expect(metric(r, "byVertical").display).toBe("—");
    expect(metric(r, "stanceMix").display).toBe("—");
    for (const m of r.metrics) {
      expect(Number.isFinite(m.value)).toBe(true);
      expect(typeof m.display).toBe("string");
    }
  });

  it("gives a single member weight 1 and flags it concentrated", () => {
    const byId = mapOf(analysis("a", "startups", "Solo", "BACKABLE"));
    const r = computePortfolioMetrics([{ analysisId: "a", capital: 250_000_000 }], byId);
    expect(r.positions[0].weight).toBe(1);
    expect(metric(r, "topWeight").verdict).toBe("CONCENTRATED");
    expect(metric(r, "byVertical").display).toBe("Startups 100%");
  });

  it("treats non-finite / negative capital as zero (no leak into weights)", () => {
    const byId = mapOf(analysis("a", "stocks", "A", "FAIR"), analysis("b", "stocks", "B", "FAIR"));
    const r = computePortfolioMetrics(
      [
        { analysisId: "a", capital: Number.NaN },
        { analysisId: "b", capital: -50 },
      ],
      byId,
    );
    expect(r.totalCapital).toBe(0);
    expect(r.positions.every((p) => p.weight === 0)).toBe(true);
    expect(metric(r, "byVertical").display).toBe("—");
  });
});

describe("normalizePortfolio (back-compat)", () => {
  it("maps legacy memberIds → members with capital 0", () => {
    const legacy = {
      id: "p",
      title: "Old",
      memberIds: ["x", "y"],
      tags: [],
      folderId: null,
      chat: [],
      allowWebSearch: false,
      createdAt: 0,
      updatedAt: 0,
    } as unknown as PortfolioAnalysis;
    const p = normalizePortfolio(legacy);
    expect(p.members).toEqual([
      { analysisId: "x", capital: 0 },
      { analysisId: "y", capital: 0 },
    ]);
  });

  it("passes a current-shape portfolio through untouched (idempotent)", () => {
    const current: PortfolioAnalysis = {
      id: "p",
      title: "New",
      members: [{ analysisId: "x", capital: 100 }],
      tags: [],
      folderId: null,
      chat: [],
      allowWebSearch: false,
      persona: null,
      stance: null,
      debate: null,
      advisory: null,
      decisionHistory: [],
      createdAt: 0,
      updatedAt: 0,
    };
    expect(normalizePortfolio(current)).toBe(current);
    expect(normalizePortfolio(normalizePortfolio(current)).members).toEqual(current.members);
  });
});
