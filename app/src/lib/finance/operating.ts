/**
 * Conventional / real-business calculations: break-even point (BEP) and IRR.
 * Pure functions — the single source of numeric truth fed to the AI layer.
 */

export interface BEPResult {
  fixed: number;
  price: number;
  variable: number;
  /** Per-unit contribution margin (price - variable). */
  contribution: number;
  /** Units required to break even. 0 when contribution <= 0. */
  bepUnits: number;
  /** Revenue at break-even (bepUnits * price). */
  bepRevenue: number;
  /** Contribution margin as a percentage of price. */
  marginPct: number;
}

/** Break-even point in units and revenue for a unit-economics business. */
export function calcBEP(fixed: number, price: number, variable: number): BEPResult {
  const contribution = price - variable;
  const bepUnits = contribution > 0 ? fixed / contribution : 0;
  return {
    fixed,
    price,
    variable,
    contribution,
    bepUnits,
    bepRevenue: bepUnits * price,
    marginPct: price > 0 ? (contribution / price) * 100 : 0,
  };
}

export type IRRVerdict = "STRONG" | "MARGINAL" | "WEAK";

export interface IRRResult {
  /** Internal rate of return as a percentage. */
  irr: number;
  /** Absolute value of the initial (period 0) cash outflow. */
  totalInvested: number;
  /** Sum of all subsequent cash flows. */
  totalReturns: number;
  /** Verdict (>20% strong, >15% marginal, else weak). */
  verdict: IRRVerdict;
}

/**
 * IRR via Newton-Raphson on the NPV polynomial. The first cash flow (period 0)
 * is treated as undiscounted (typically the initial investment, negative).
 */
export function calcIRR(cashflows: number[]): IRRResult {
  const npv = (r: number) => cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  const dNpv = (r: number) =>
    cashflows.reduce((s, cf, t) => s - (t * cf) / Math.pow(1 + r, t + 1), 0);

  let r = 0.1;
  for (let i = 0; i < 1000; i++) {
    const slope = dNpv(r);
    if (Math.abs(slope) < 1e-12) break;
    const next = r - npv(r) / slope;
    if (Math.abs(next - r) < 1e-7) {
      r = next;
      break;
    }
    r = next;
  }

  const irr = r * 100;
  return {
    irr,
    totalInvested: Math.abs(cashflows[0] ?? 0),
    totalReturns: cashflows.slice(1).reduce((a, b) => a + b, 0),
    verdict: irr > 20 ? "STRONG" : irr > 15 ? "MARGINAL" : "WEAK",
  };
}
