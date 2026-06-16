import { describe, it, expect } from "vitest";
import { finalizeDebate } from "./analyze";
import type { Analysis } from "@/lib/domain/types";
import type { DebateOutput } from "./schemas";

/** Minimal analysis — finalizeDebate only reads vertical + metrics. */
function stockAnalysis(): Analysis {
  return {
    valuationMode: "engine",
    vertical: "stocks",
    manualMeta: null,
    metrics: {
      vertical: "stocks",
      metrics: [
        { key: "pe", label: "P/E", value: 11, display: "11.1x", verdict: "DISCOUNT" },
        { key: "mos", label: "MoS", value: 15, display: "15%" },
      ],
    },
  } as unknown as Analysis;
}

const rawDebate = (over: Partial<DebateOutput> = {}): DebateOutput => ({
  thesisSupport: "STRONG",
  stanceBasis: "cheap with a real cushion",
  bull: [
    { agent: "Valuation Bull", text: "P/E DISCOUNT", slot: "valuation" },
    { agent: "Stray", text: "bad slot", slot: "not-a-slot" },
  ],
  bear: [{ agent: "Risk Bear", text: "terminal-heavy", slot: "risk" }],
  advisory: [
    { id: "valuation", name: "Valuation", verdict: "CHEAP", text: "below mean" },
    { id: "bogus", name: "Nope", verdict: "X", text: "should be dropped" },
  ],
  ...over,
});

describe("finalizeDebate — validate + zip against the persona contract", () => {
  it("zips advisory to the persona lens set: keeps known, drops unknown, fills missing", () => {
    const r = finalizeDebate(stockAnalysis(), rawDebate());
    expect(r.advisory.map((l) => l.id)).toEqual(["valuation", "quality", "catalyst", "risk"]);
    expect(r.advisory.find((l) => l.id === "valuation")?.verdict).toBe("CHEAP");
    // missing lenses are filled with a placeholder, not omitted
    expect(r.advisory.find((l) => l.id === "quality")?.verdict).toBe("—");
    // unknown id never leaks through
    expect(r.advisory.find((l) => l.id === "bogus")).toBeUndefined();
  });

  it("clamps unknown debate slots to undefined, keeps valid ones", () => {
    const r = finalizeDebate(stockAnalysis(), rawDebate());
    expect(r.debate.bull[0].slot).toBe("valuation");
    expect(r.debate.bull[1].slot).toBeUndefined();
  });

  it("derives the stance from the ENGINE (never the model) and keeps the AI basis", () => {
    const r = finalizeDebate(stockAnalysis(), rawDebate());
    expect(r.stance?.label).toBe("UNDERVALUED"); // from pe DISCOUNT + positive mos
    expect(r.stance?.basis).toBe("cheap with a real cushion");
  });

  it("clamps an out-of-enum thesisSupport to MIXED", () => {
    const r = finalizeDebate(stockAnalysis(), rawDebate({ thesisSupport: "INVALID" as unknown as "STRONG" }));
    expect(r.debate.thesisSupport).toBe("MIXED");
  });
});
