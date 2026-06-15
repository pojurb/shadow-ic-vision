import { describe, it, expect } from "vitest";
import { finalizePortfolioDebate } from "./analyze";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { computeMetrics } from "@/lib/finance/compute";
import { BLANK_PARAMS, type Vertical } from "@/data/presets";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import type { Analysis, PortfolioMember } from "@/lib/domain/types";
import type { DebateOutput } from "./schemas";

function analysis(id: string, vertical: Vertical, name: string, stance: string | null): Analysis {
  const parameters = { ...BLANK_PARAMS[vertical] };
  return {
    id, title: name, vertical, assetName: name,
    assetMeta: { currency: "IDR" }, tags: [], folderId: null,
    assetType: assetTypeForVertical(vertical), ic: createDefaultICState(0),
    parameters, metrics: computeMetrics(vertical, parameters),
    debate: null, advisory: null, persona: null,
    stance: stance ? { label: stance, basis: "" } : null,
    expertReview: null, sources: [], evidence: [], allowWebSearch: false, chat: [],
    decision: null, model: "seed", status: "draft", createdAt: 0, updatedAt: 0,
  };
}

/** A concentrated portfolio (top holding 60%) → engine stance CONCENTRATED. */
function concentratedMetrics() {
  const byId = new Map([
    analysis("a", "stocks", "BBCA", "UNDERVALUED"),
    analysis("b", "startups", "Pay", "BACKABLE"),
  ].map((a) => [a.id, a] as const));
  const members: PortfolioMember[] = [
    { analysisId: "a", capital: 600 },
    { analysisId: "b", capital: 400 },
  ];
  return computePortfolioMetrics(members, byId);
}

const rawDebate = (over: Partial<DebateOutput> = {}): DebateOutput => ({
  thesisSupport: "STRONG",
  stanceBasis: "top-heavy but high conviction",
  bull: [
    { agent: "Allocation Bull", text: "well sized", slot: "allocation" },
    { agent: "Stray", text: "bad slot", slot: "not-a-slot" },
  ],
  bear: [{ agent: "Risk Bear", text: "single-name risk", slot: "risk" }],
  advisory: [
    { id: "capital_allocation", name: "Capital Allocation", verdict: "SKEWED", text: "60/40 split" },
    { id: "bogus", name: "Nope", verdict: "X", text: "should be dropped" },
  ],
  ...over,
});

describe("finalizePortfolioDebate — validate + zip against the Portfolio Strategist", () => {
  it("zips advisory to the portfolio lens set: keeps known, drops unknown, fills missing", () => {
    const r = finalizePortfolioDebate(concentratedMetrics(), rawDebate());
    expect(r.advisory.map((l) => l.id)).toEqual([
      "capital_allocation",
      "concentration",
      "conviction_mix",
      "risk",
    ]);
    expect(r.advisory.find((l) => l.id === "capital_allocation")?.verdict).toBe("SKEWED");
    expect(r.advisory.find((l) => l.id === "concentration")?.verdict).toBe("—"); // filled
    expect(r.advisory.find((l) => l.id === "bogus")).toBeUndefined(); // dropped
  });

  it("clamps unknown debate slots to undefined, keeps valid ones", () => {
    const r = finalizePortfolioDebate(concentratedMetrics(), rawDebate());
    expect(r.debate.bull[0].slot).toBe("allocation");
    expect(r.debate.bull[1].slot).toBeUndefined();
  });

  it("derives the stance from the ENGINE (never the model) and keeps the AI basis", () => {
    const r = finalizePortfolioDebate(concentratedMetrics(), rawDebate());
    expect(r.stance?.label).toBe("CONCENTRATED"); // top weight 60% > 40%
    expect(r.stance?.basis).toBe("top-heavy but high conviction");
  });

  it("clamps an out-of-enum thesisSupport to MIXED", () => {
    const r = finalizePortfolioDebate(
      concentratedMetrics(),
      rawDebate({ thesisSupport: "INVALID" as unknown as "STRONG" }),
    );
    expect(r.debate.thesisSupport).toBe("MIXED");
  });
});
