/**
 * Deterministic portfolio-level math — the cross-asset analogue of `computeMetrics`.
 * Aggregates member analyses (each with an explicit capital allocation) into locked
 * figures: total capital, per-position weights, allocation by vertical, concentration,
 * and stance mix. PURE (no JSX, no I/O) so it can ground the future composition chat/UI
 * the same way single-analysis metrics do — every number here, never the LLM, is the
 * source of truth (the no-numeric-hallucination guarantee at the portfolio level).
 */
import { formatIDR, formatNum } from "./format";
import type { Vertical } from "@/data/presets";
import type {
  Analysis,
  Metric,
  PortfolioMember,
  PortfolioMetrics,
  PortfolioPosition,
} from "@/lib/domain/types";

const VLABEL: Record<Vertical, string> = {
  stocks: "Stocks",
  startups: "Startups",
  conventional: "Conv",
};

/** Non-finite / negative capital is treated as 0 (no NaN/Infinity can leak into a weight). */
function cleanCapital(c: number): number {
  return Number.isFinite(c) && c > 0 ? c : 0;
}

export function computePortfolioMetrics(
  members: PortfolioMember[],
  byId: Map<string, Analysis>,
): PortfolioMetrics {
  // Resolve members to their analyses; drop any whose analysis is gone (deleted holding).
  const resolved = (members ?? [])
    .map((m) => ({ capital: cleanCapital(m.capital), a: byId.get(m.analysisId) }))
    .filter((x): x is { capital: number; a: Analysis } => !!x.a);

  const totalCapital = resolved.reduce((s, x) => s + x.capital, 0);

  const positions: PortfolioPosition[] = resolved.map((x) => ({
    analysisId: x.a.id,
    name: x.a.assetName || x.a.title,
    vertical: x.a.vertical,
    capital: x.capital,
    weight: totalCapital > 0 ? x.capital / totalCapital : 0,
    stance: x.a.stance?.label ?? null,
  }));

  // Allocation by vertical (summed weights).
  const vweight: Record<Vertical, number> = { stocks: 0, startups: 0, conventional: 0 };
  for (const p of positions) vweight[p.vertical] += p.weight;
  const allocParts = (Object.keys(vweight) as Vertical[])
    .filter((v) => vweight[v] > 0)
    .map((v) => `${VLABEL[v]} ${Math.round(vweight[v] * 100)}%`);

  // Largest position + concentration flag.
  const top = positions.reduce<PortfolioPosition | null>(
    (best, p) => (!best || p.weight > best.weight ? p : best),
    null,
  );
  const topDisplay = top ? `${top.name} ${Math.round(top.weight * 100)}%` : "—";
  const topVerdict = top ? (top.weight > 0.4 ? "CONCENTRATED" : "BALANCED") : undefined;

  // Stance mix (count of members per engine-derived stance label).
  const stanceCount = new Map<string, number>();
  for (const p of positions) {
    if (p.stance) stanceCount.set(p.stance, (stanceCount.get(p.stance) ?? 0) + 1);
  }
  const stanceParts = [...stanceCount.entries()].map(([s, n]) => `${s} ×${n}`);

  const metrics: Metric[] = [
    { key: "totalCapital", label: "Total Capital", value: totalCapital, display: formatIDR(totalCapital) },
    { key: "holdings", label: "Holdings", value: positions.length, display: formatNum(positions.length, 0) },
    { key: "topWeight", label: "Largest Position", value: top?.weight ?? 0, display: topDisplay, verdict: topVerdict },
    { key: "byVertical", label: "Allocation", value: allocParts.length, display: allocParts.length ? allocParts.join(" · ") : "—" },
    { key: "stanceMix", label: "Stance Mix", value: stanceCount.size, display: stanceParts.length ? stanceParts.join(" · ") : "—" },
  ];

  return { totalCapital, positions, metrics };
}
