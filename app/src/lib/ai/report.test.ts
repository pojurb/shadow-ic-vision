import { describe, it, expect } from "vitest";
import { buildReport } from "./report";
import { computeMetrics } from "@/lib/finance/compute";
import { personaFor } from "./personas";
import { BLANK_PARAMS, type Vertical } from "@/data/presets";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import type { Analysis } from "@/lib/domain/types";

/**
 * Build a realistic produced analysis for a vertical. Debate/advisory text is kept
 * digit-free on purpose so the "no figure outside the metric set" assertion below is
 * a clean test of buildReport (it must not introduce numbers beyond the engine's).
 */
function fixture(vertical: Vertical): Analysis {
  const parameters = { ...BLANK_PARAMS[vertical] };
  const metrics = computeMetrics(vertical, parameters);
  const persona = personaFor(vertical);
  const derived = persona.stance.derive(metrics);
  return {
    id: "t",
    title: "Test Analysis",
    valuationMode: "engine",
    vertical,
    assetType: assetTypeForVertical(vertical),
    assetName: "Acme Holdings",
    assetMeta: { currency: "IDR" },
    manualMeta: null,
    tags: [],
    folderId: null,
    ic: createDefaultICState(0),
    parameters,
    metrics,
    debate: {
      thesisSupport: "MIXED",
      bull: persona.debateSlots.map((s) => ({ agent: "Bull", text: `Bull take on ${s.name.toLowerCase()}.`, slot: s.id })),
      bear: persona.debateSlots.map((s) => ({ agent: "Bear", text: `Bear take on ${s.name.toLowerCase()}.`, slot: s.id })),
    },
    advisory: persona.lenses.map((l) => ({ id: l.id, name: l.name, verdict: "NEUTRAL", text: `Lens note for ${l.name.toLowerCase()}.` })),
    persona: { id: persona.id, label: persona.label },
    stance: derived ? { label: derived.label, basis: "Valuation and quality verdicts taken together." } : null,
    expertReview: null,
    sources: [],
    evidence: [],
    allowWebSearch: false,
    chat: [],
    decision: null,
    decisionHistory: [],
    model: "seed",
    status: "draft",
    createdAt: 0,
    updatedAt: 0,
  };
}

const VERTICALS: Vertical[] = ["stocks", "startups", "conventional"];

describe("buildReport", () => {
  for (const v of VERTICALS) {
    it(`renders for ${v} and prints every locked display verbatim`, () => {
      const a = fixture(v);
      const md = buildReport(a);
      for (const m of a.metrics.metrics) {
        expect(md).toContain(m.display);
      }
      // headline carries the engine-derived stance label
      expect(md).toContain(a.stance!.label);
      // thesis support framing present
      expect(md).toContain("MIXED");
    });

    it(`introduces no figure outside the metric set for ${v}`, () => {
      const a = fixture(v);
      const md = buildReport(a);
      // Every numeric token in the report must trace to an engine-produced string
      // (a metric display, label, or verdict) — buildReport must not introduce a
      // figure of its own. Fixture debate/advisory/stance text is digit-free.
      const grounded = a.metrics.metrics
        .flatMap((m) => [m.display, m.label, m.verdict ?? ""])
        .join(" | ");
      const numbers = md.match(/\d[\d.,]*/g) ?? [];
      for (const n of numbers) {
        expect(grounded.includes(n), `"${n}" should trace to an engine string`).toBe(true);
      }
    });
  }

  it("handles a pre-debate analysis (stance/debate/advisory absent)", () => {
    const a = fixture("stocks");
    a.stance = null;
    a.debate = null;
    a.advisory = null;
    const md = buildReport(a);
    expect(md).toContain("Acme Holdings");
    // figures still print
    for (const m of a.metrics.metrics) expect(md).toContain(m.display);
  });
});
