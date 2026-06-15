import { describe, it, expect } from "vitest";
import { portfolioGroundingText, portfolioChatContextPreamble } from "./prompts";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { computeMetrics, summarizeMetrics } from "@/lib/finance/compute";
import { BLANK_PARAMS, type Vertical } from "@/data/presets";
import { assetTypeForVertical, createDefaultICState } from "@/lib/domain/ic";
import type { Analysis, PortfolioMember, PortfolioAnalysis } from "@/lib/domain/types";

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

function portfolio(members: PortfolioMember[]): PortfolioAnalysis {
  return {
    id: "p", title: "Core Book", members, tags: [], folderId: null,
    chat: [], allowWebSearch: false, persona: null, stance: null,
    debate: null, advisory: null, createdAt: 0, updatedAt: 0,
  };
}

describe("portfolioGroundingText — grounded on engine output only", () => {
  const members = [
    analysis("a", "stocks", "BBCA", "UNDERVALUED"),
    analysis("b", "startups", "PayGuard", "CONDITIONAL"),
    analysis("c", "conventional", "SpinExpress", "VIABLE"),
  ];
  const byId = new Map(members.map((a) => [a.id, a] as const));
  const memberList: PortfolioMember[] = [
    { analysisId: "a", capital: 600_000_000 },
    { analysisId: "b", capital: 300_000_000 },
    { analysisId: "c", capital: 100_000_000 },
  ];
  const metrics = computePortfolioMetrics(memberList, byId);
  const text = portfolioGroundingText(portfolio(memberList), metrics, byId);

  it("includes every portfolio-level locked display string verbatim", () => {
    for (const m of metrics.metrics) {
      expect(text).toContain(m.display);
    }
  });

  it("includes each holding's own locked figures (cross-asset grounding)", () => {
    for (const a of members) {
      expect(text).toContain(summarizeMetrics(a.metrics));
      expect(text).toContain(a.assetName);
    }
  });

  it("labels each holding with its engine stance", () => {
    expect(text).toContain("UNDERVALUED");
    expect(text).toContain("CONDITIONAL");
    expect(text).toContain("VIABLE");
  });
});

describe("portfolioChatContextPreamble", () => {
  it("works with no debate yet (grounding only, no throw)", () => {
    const members = [analysis("a", "stocks", "BBCA", "FAIR")];
    const byId = new Map(members.map((a) => [a.id, a] as const));
    const memberList: PortfolioMember[] = [{ analysisId: "a", capital: 100 }];
    const metrics = computePortfolioMetrics(memberList, byId);
    const pre = portfolioChatContextPreamble(portfolio(memberList), metrics, byId);
    expect(pre).toContain("Portfolio locked figures");
    expect(pre).not.toContain("Prior portfolio debate");
  });
});
