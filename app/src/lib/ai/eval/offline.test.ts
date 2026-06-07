/**
 * Offline grounding/stance eval — deterministic, no API. The core no-numeric-
 * hallucination guarantee, now machine-checked: finalize* + the grounding linter must
 * pass a clean debate and flag a planted fabricated figure, for every vertical and the
 * portfolio. Plus an engine-derived-stance sweep.
 */
import { describe, it, expect } from "vitest";
import { finalizeDebate, finalizePortfolioDebate } from "@/lib/ai/analyze";
import { lintAnalysisGrounding, lintPortfolioGrounding } from "@/lib/ai/grounding";
import { personaFor, portfolioPersona, derivePortfolioStance } from "@/lib/ai/personas";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import {
  VERTICALS,
  FABRICATED_VALUE,
  memberFromPreset,
  mixedPortfolio,
  groundedDebate,
  withViolation,
} from "./fixtures";
import type { Analysis, PortfolioMember, Vertical } from "@/lib/domain/types";

describe.each(VERTICALS)("offline grounding eval — %s", (v) => {
  const persona = personaFor(v);
  const a = memberFromPreset("m", v);

  it("clean fixture: lints clean, full lens set, engine-derived stance", () => {
    const fin = finalizeDebate(a, groundedDebate(persona.debateSlots, persona.lenses));
    const lint = lintAnalysisGrounding({ ...a, ...fin });
    expect(lint.clean).toBe(true);
    expect(fin.advisory).toHaveLength(persona.lenses.length);
    const d = persona.stance.derive(a.metrics);
    if (d) expect(fin.stance?.label).toBe(d.label);
  });

  it("planted fabricated figure is flagged", () => {
    const fin = finalizeDebate(a, withViolation(groundedDebate(persona.debateSlots, persona.lenses)));
    const lint = lintAnalysisGrounding({ ...a, ...fin });
    expect(lint.clean).toBe(false);
    expect(lint.flagged.some((f) => Math.abs(f.value - FABRICATED_VALUE) < 1)).toBe(true);
  });
});

describe("offline grounding eval — portfolio", () => {
  it("clean fixture lints clean; planted figure is flagged", () => {
    const { portfolio, metrics, byId } = mixedPortfolio();
    const persona = portfolioPersona();

    const finC = finalizePortfolioDebate(metrics, groundedDebate(persona.debateSlots, persona.lenses));
    expect(finC.advisory).toHaveLength(persona.lenses.length);
    expect(finC.stance?.label).toBe(derivePortfolioStance(metrics)?.label);
    expect(lintPortfolioGrounding({ ...portfolio, ...finC }, metrics, byId).clean).toBe(true);

    const finV = finalizePortfolioDebate(metrics, withViolation(groundedDebate(persona.debateSlots, persona.lenses)));
    expect(lintPortfolioGrounding({ ...portfolio, ...finV }, metrics, byId).clean).toBe(false);
  });
});

describe("stance sweep — portfolio capital splits + conviction mix", () => {
  const forced = (id: string, v: Vertical, label: string): Analysis => ({
    ...memberFromPreset(id, v),
    stance: { label, basis: "" },
  });
  type Row = { v: Vertical; label: string; cap: number };
  const cases: [string, Row[], string][] = [
    [
      "top >40% → CONCENTRATED",
      [
        { v: "stocks", label: "UNDERVALUED", cap: 600 },
        { v: "startups", label: "BACKABLE", cap: 400 },
      ],
      "CONCENTRATED",
    ],
    [
      "balanced + ≥60% positive → CONSTRUCTIVE",
      [
        { v: "stocks", label: "UNDERVALUED", cap: 100 },
        { v: "startups", label: "BACKABLE", cap: 100 },
        { v: "conventional", label: "MARGINAL", cap: 100 },
      ],
      "CONSTRUCTIVE",
    ],
    [
      "balanced + ≥60% negative → DEFENSIVE",
      [
        { v: "stocks", label: "OVERVALUED", cap: 100 },
        { v: "startups", label: "UNPROVEN", cap: 100 },
        { v: "conventional", label: "VIABLE", cap: 100 },
      ],
      "DEFENSIVE",
    ],
    [
      "balanced + split conviction → BALANCED",
      [
        { v: "stocks", label: "UNDERVALUED", cap: 100 },
        { v: "startups", label: "UNPROVEN", cap: 100 },
        { v: "conventional", label: "MARGINAL", cap: 100 },
      ],
      "BALANCED",
    ],
  ];

  it.each(cases)("%s", (_name, rows, expected) => {
    const members = rows.map((r, i) => forced(String(i), r.v, r.label));
    const byId = new Map(members.map((m) => [m.id, m] as const));
    const list: PortfolioMember[] = rows.map((r, i) => ({ analysisId: String(i), capital: r.cap * 1_000_000 }));
    const metrics = computePortfolioMetrics(list, byId);
    expect(derivePortfolioStance(metrics)?.label).toBe(expected);
  });
});
