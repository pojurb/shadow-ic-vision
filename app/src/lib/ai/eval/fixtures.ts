/**
 * Shared eval fixtures (offline + live). Builds real member analyses from presets, a
 * mixed 3-vertical portfolio, and crafted DebateOutputs — one fully grounded, one with
 * a deliberately fabricated figure — so the grounding guard can be scored deterministically.
 */
import { computeMetrics } from "@/lib/finance/compute";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { personaFor } from "@/lib/ai/personas";
import { PRESETS, type Vertical } from "@/data/presets";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import type { SlotSpec, LensSpec } from "@/lib/ai/personas";
import type { Analysis, PortfolioAnalysis, PortfolioMember, PortfolioMetrics } from "@/lib/domain/types";
import type { DebateOutput } from "@/lib/ai/schemas";

export const VERTICALS: Vertical[] = ["stocks", "startups", "conventional"];

/** A clearly-fabricated figure no realistic preset reaches (~9.876e14). */
export const FABRICATED_RAW = "Rp 987,6T";
export const FABRICATED_VALUE = 987.6e12;

/** Real member analysis from a preset (engine metrics + engine-derived stance). */
export function memberFromPreset(id: string, vertical: Vertical, idx = 0): Analysis {
  const preset = PRESETS[vertical][idx];
  const parameters = { ...preset.parameters };
  const metrics = computeMetrics(vertical, parameters);
  const d = personaFor(vertical).stance.derive(metrics);
  return {
    id, title: preset.name, vertical, assetName: preset.name,
    assetMeta: { currency: "IDR" }, tags: [], folderId: null,
    assetType: assetTypeForVertical(vertical), ic: createDefaultICState(0),
    parameters, metrics,
    debate: null, advisory: null, persona: null,
    stance: d ? { label: d.label, basis: d.basis } : null,
    expertReview: null, sources: [], allowWebSearch: false, chat: [],
    decision: null, decisionHistory: [], model: "seed", status: "draft", createdAt: 0, updatedAt: 0,
  };
}

/** Mixed 3-vertical book, top holding at 60% (→ engine stance CONCENTRATED). */
export function mixedPortfolio(): {
  portfolio: PortfolioAnalysis;
  members: Analysis[];
  byId: Map<string, Analysis>;
  metrics: PortfolioMetrics;
} {
  const members = [
    memberFromPreset("a", "stocks"),
    memberFromPreset("b", "startups"),
    memberFromPreset("c", "conventional"),
  ];
  const byId = new Map(members.map((a) => [a.id, a] as const));
  const memberList: PortfolioMember[] = [
    { analysisId: "a", capital: 600_000_000 },
    { analysisId: "b", capital: 300_000_000 },
    { analysisId: "c", capital: 100_000_000 },
  ];
  const metrics = computePortfolioMetrics(memberList, byId);
  const portfolio: PortfolioAnalysis = {
    id: "p", title: "Eval Book", members: memberList, tags: [], folderId: null,
    chat: [], allowWebSearch: false, persona: null, stance: null,
    debate: null, advisory: null, decisionHistory: [], createdAt: 0, updatedAt: 0,
  };
  return { portfolio, members, byId, metrics };
}

/** A fully grounded debate (purely qualitative prose — no figures to invent). */
export function groundedDebate(slots: SlotSpec[], lenses: LensSpec[]): DebateOutput {
  const line = (s: SlotSpec, side: string) => ({
    agent: `${s.name} ${side}`,
    text: `Qualitative ${side.toLowerCase()} point on ${s.name.toLowerCase()} — no invented figure.`,
    slot: s.id,
  });
  return {
    thesisSupport: "MIXED",
    stanceBasis: "Balanced read of the locked verdicts.",
    bull: slots.map((s) => line(s, "Bull")),
    bear: slots.map((s) => line(s, "Bear")),
    advisory: lenses.map((l) => ({ id: l.id, name: l.name, verdict: "NEUTRAL", text: `Grounded take for ${l.name}.` })),
  };
}

/** Same debate with a fabricated figure planted in the lead bull line. */
export function withViolation(d: DebateOutput): DebateOutput {
  const bull = d.bull.map((l, i) =>
    i === 0 ? { ...l, text: `${l.text} Also a hidden ${FABRICATED_RAW} liability lurks.` } : l,
  );
  return { ...d, bull };
}
