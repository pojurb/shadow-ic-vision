import { describe, it, expect } from "vitest";
import { personaFor, PERSONAS } from "./personas";
import type { ComputedMetrics, Metric, Vertical } from "@/lib/domain/types";

function metric(key: string, value: number, verdict?: string): Metric {
  return { key, label: key, value, display: String(value), verdict };
}
function cm(vertical: Vertical, metrics: Metric[]): ComputedMetrics {
  return { vertical, metrics };
}

describe("personaFor", () => {
  it("maps each vertical to its expert persona", () => {
    expect(personaFor("stocks").id).toBe("equity-analyst");
    expect(personaFor("startups").id).toBe("venture-analyst");
    expect(personaFor("conventional").id).toBe("operator-analyst");
  });

  it("exposes a non-empty slot set and lens set per vertical", () => {
    for (const v of Object.keys(PERSONAS) as Vertical[]) {
      const p = PERSONAS[v];
      expect(p.debateSlots.length).toBeGreaterThanOrEqual(3);
      expect(p.lenses.length).toBeGreaterThanOrEqual(3);
      expect(p.label).toBeTruthy();
      expect(p.systemPrompt).toContain("GROUNDING");
    }
  });
});

describe("stocks stance.derive (engine-only, no AI)", () => {
  const d = personaFor("stocks").stance.derive;
  it("UNDERVALUED on P/E DISCOUNT + positive margin of safety", () => {
    expect(d(cm("stocks", [metric("pe", 11, "DISCOUNT"), metric("mos", 15)]))?.label).toBe("UNDERVALUED");
  });
  it("OVERVALUED on PREMIUM, or on negative margin of safety", () => {
    expect(d(cm("stocks", [metric("pe", 22, "PREMIUM"), metric("mos", 5)]))?.label).toBe("OVERVALUED");
    expect(d(cm("stocks", [metric("pe", 11, "DISCOUNT"), metric("mos", -5)]))?.label).toBe("OVERVALUED");
  });
  it("FAIR on a MARKET multiple with a positive cushion", () => {
    expect(d(cm("stocks", [metric("pe", 14, "MARKET"), metric("mos", 5)]))?.label).toBe("FAIR");
  });
  it("null when required metrics are missing", () => {
    expect(d(cm("stocks", [metric("pe", 11, "DISCOUNT")]))).toBeNull();
  });
});

describe("startups stance.derive", () => {
  const d = personaFor("startups").stance.derive;
  it("BACKABLE on healthy economics + safe runway", () => {
    expect(d(cm("startups", [metric("ltvcac", 5, "STRONG"), metric("runway", 20, "SAFE")]))?.label).toBe("BACKABLE");
  });
  it("CONDITIONAL on healthy economics but a watch-list runway", () => {
    expect(d(cm("startups", [metric("ltvcac", 4, "HEALTHY"), metric("runway", 14, "WATCH")]))?.label).toBe("CONDITIONAL");
  });
  it("UNPROVEN on weak economics or a critical runway", () => {
    expect(d(cm("startups", [metric("ltvcac", 2, "WEAK"), metric("runway", 20, "SAFE")]))?.label).toBe("UNPROVEN");
    expect(d(cm("startups", [metric("ltvcac", 5, "STRONG"), metric("runway", 6, "CRITICAL")]))?.label).toBe("UNPROVEN");
  });
});

describe("conventional stance.derive", () => {
  const d = personaFor("conventional").stance.derive;
  it("maps the IRR verdict to a viability stance", () => {
    expect(d(cm("conventional", [metric("irr", 25, "STRONG")]))?.label).toBe("VIABLE");
    expect(d(cm("conventional", [metric("irr", 17, "MARGINAL")]))?.label).toBe("MARGINAL");
    expect(d(cm("conventional", [metric("irr", 10, "WEAK")]))?.label).toBe("UNVIABLE");
  });
});
