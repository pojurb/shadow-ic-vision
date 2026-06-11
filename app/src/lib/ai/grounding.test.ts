import { describe, it, expect } from "vitest";
import {
  extractNumberTokens,
  allowedValues,
  lintGrounding,
  lintAnalysisGrounding,
  lintPortfolioGrounding,
} from "./grounding";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { computeMetrics } from "@/lib/finance/compute";
import { BLANK_PARAMS, type Vertical } from "@/data/presets";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import type { Analysis, Metric, PortfolioAnalysis, PortfolioMember } from "@/lib/domain/types";

/** Stock-shaped locked figures with id-ID + toFixed display formats (as the engine emits). */
const STOCK_METRICS: Metric[] = [
  { key: "pe", label: "Implied P/E Ratio", value: 11.1, display: "11,1x", verdict: "DISCOUNT" },
  { key: "npv", label: "Intrinsic Value (NPV)", value: 4940, display: "4.940" },
  { key: "mos", label: "Margin of Safety", value: 15.2, display: "15.2%", verdict: "NPV POSITIVE" },
];

describe("extractNumberTokens", () => {
  it("parses id-ID decimals + an x unit", () => {
    const t = extractNumberTokens("trades at 11,1x earnings")[0];
    expect(t.values).toContain(11.1);
    expect(t.unit).toBe(true);
  });

  it("scales Rp + magnitude suffix", () => {
    const t = extractNumberTokens("upside of Rp 4,2B")[0];
    expect(t.values).toContain(4.2e9);
    expect(t.unit).toBe(true);
  });

  it("returns both interpretations for an ambiguous dot group", () => {
    const t = extractNumberTokens("intrinsic 4.940")[0];
    expect(t.values).toEqual(expect.arrayContaining([4.94, 4940]));
  });

  it("does not read 'mo' as a mega suffix", () => {
    const t = extractNumberTokens("runway of 24.3 mo")[0];
    expect(t.values).toContain(24.3);
    expect(t.unit).toBe(false);
  });

  it("treats a percent as a unit-bearing figure", () => {
    const t = extractNumberTokens("yields 30%")[0];
    expect(t.values).toContain(30);
    expect(t.unit).toBe(true);
  });
});

describe("allowedValues", () => {
  it("includes each metric value and the numbers inside its display", () => {
    const allowed = allowedValues(STOCK_METRICS);
    expect(allowed).toEqual(expect.arrayContaining([11.1, 4940, 15.2]));
  });
});

describe("lintGrounding", () => {
  it("passes prose that only cites locked figures", () => {
    const r = lintGrounding({
      texts: ["At 11,1x with a 15.2% margin of safety and intrinsic value 4.940, it screens cheap."],
      metrics: STOCK_METRICS,
    });
    expect(r.clean).toBe(true);
  });

  it("flags a fabricated unit-bearing figure", () => {
    const r = lintGrounding({ texts: ["It also yields 30% dividends."], metrics: STOCK_METRICS });
    expect(r.clean).toBe(false);
    expect(r.flagged.map((f) => f.value)).toContain(30);
  });

  it("accepts a rounded citation within tolerance", () => {
    const r = lintGrounding({ texts: ["around 11.0x"], metrics: STOCK_METRICS });
    expect(r.clean).toBe(true);
  });

  it("whitelists bare counts and years (no unit)", () => {
    const r = lintGrounding({ texts: ["over the next 5 years, by 2030"], metrics: STOCK_METRICS });
    expect(r.clean).toBe(true);
  });

  it("flags a fabricated large currency figure", () => {
    const r = lintGrounding({ texts: ["a hidden Rp 9,9B liability"], metrics: STOCK_METRICS });
    expect(r.clean).toBe(false);
  });
});

function analysis(id: string, vertical: Vertical, name: string, stance: string | null): Analysis {
  const parameters = { ...BLANK_PARAMS[vertical] };
  return {
    id, title: name, vertical, assetName: name,
    assetMeta: { currency: "IDR" }, tags: [], folderId: null,
    assetType: assetTypeForVertical(vertical), ic: createDefaultICState(0),
    parameters, metrics: computeMetrics(vertical, parameters),
    debate: null, advisory: null, persona: null,
    stance: stance ? { label: stance, basis: "" } : null,
    expertReview: null, sources: [], allowWebSearch: false, chat: [],
    decision: null, model: "seed", status: "draft", createdAt: 0, updatedAt: 0,
  };
}

describe("lintAnalysisGrounding", () => {
  it("flags a bogus number planted in a debate line", () => {
    const a = analysis("a", "stocks", "BBCA", "FAIR");
    a.metrics = { vertical: "stocks", metrics: STOCK_METRICS };
    a.debate = {
      thesisSupport: "MIXED",
      bull: [{ agent: "Valuation Bull", text: "Cheap at 11,1x.", slot: "valuation" }],
      bear: [{ agent: "Risk Bear", text: "But ROE is only 42% — overstated.", slot: "risk" }],
    };
    const r = lintAnalysisGrounding(a);
    expect(r.clean).toBe(false);
    expect(r.flagged.some((f) => f.value === 42)).toBe(true);
  });
});

describe("lintPortfolioGrounding", () => {
  it("accepts a debate line citing a holding's own locked figure", () => {
    const a = analysis("a", "stocks", "BBCA", "UNDERVALUED");
    a.metrics = { vertical: "stocks", metrics: STOCK_METRICS };
    const byId = new Map([[a.id, a]]);
    const members: PortfolioMember[] = [{ analysisId: "a", capital: 100_000_000 }];
    const metrics = computePortfolioMetrics(members, byId);
    const portfolio: PortfolioAnalysis = {
      id: "p", title: "Book", members, tags: [], folderId: null, chat: [],
      allowWebSearch: false, persona: null,
      stance: { label: "CONCENTRATED", basis: "single holding at 100%" },
      debate: {
        thesisSupport: "THIN",
        bull: [{ agent: "Allocation Bull", text: "Anchored by BBCA at 11,1x — a discount name.", slot: "allocation" }],
        bear: [{ agent: "Concentration Bear", text: "100% in one name is fragile.", slot: "concentration" }],
      },
      advisory: null, createdAt: 0, updatedAt: 0,
    };
    const r = lintPortfolioGrounding(portfolio, metrics, byId);
    expect(r.clean).toBe(true);
  });
});
