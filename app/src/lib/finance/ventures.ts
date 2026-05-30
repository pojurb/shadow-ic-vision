/**
 * Startup / VC unit-economics calculations: LTV, CAC payback, and cash runway.
 * Pure functions — the single source of numeric truth fed to the AI layer.
 */

export type LTVVerdict = "STRONG" | "HEALTHY" | "WEAK";

export interface LTVResult {
  /** Average customer lifetime in periods (1 / churn). */
  avgLifetime: number;
  /** arpu * margin * avgLifetime. */
  ltv: number;
  /** LTV / CAC. null when CAC is missing / non-positive. */
  ltvCacRatio: number | null;
  /** Verdict on the LTV:CAC ratio. null when ratio is unavailable. */
  verdict: LTVVerdict | null;
}

/** Lifetime value with optional LTV:CAC ratio and verdict (>=5 strong, >=3 healthy, else weak). */
export function calcLTV(
  arpu: number,
  margin: number,
  churn: number,
  cac?: number | null,
): LTVResult {
  const avgLifetime = churn > 0 ? 1 / churn : 0;
  const ltv = arpu * margin * avgLifetime;
  const ltvCacRatio = cac && cac > 0 ? ltv / cac : null;
  const verdict: LTVVerdict | null =
    ltvCacRatio == null ? null : ltvCacRatio >= 5 ? "STRONG" : ltvCacRatio >= 3 ? "HEALTHY" : "WEAK";
  return { avgLifetime, ltv, ltvCacRatio, verdict };
}

export type CACVerdict = "STRONG" | "ACCEPTABLE" | "TOO LONG";

export interface CACResult {
  /** Monthly gross contribution per customer (arpu * margin). */
  monthlyContribution: number;
  /** Months to recover CAC. */
  paybackMonths: number;
  verdict: CACVerdict;
}

/** CAC payback period in months with verdict (<=12 strong, <=18 acceptable, else too long). */
export function calcCAC(cac: number, arpu: number, margin: number): CACResult {
  const monthlyContribution = arpu * margin;
  const paybackMonths = monthlyContribution > 0 ? cac / monthlyContribution : 0;
  const verdict: CACVerdict =
    paybackMonths <= 12 ? "STRONG" : paybackMonths <= 18 ? "ACCEPTABLE" : "TOO LONG";
  return { monthlyContribution, paybackMonths, verdict };
}

export type RunwayVerdict = "SAFE" | "WATCH" | "CRITICAL";

export interface RunwayResult {
  /** Months of cash remaining (cash / burn). */
  runwayMonths: number;
  verdict: RunwayVerdict;
}

/** Cash runway in months with verdict (>=18 safe, >=12 watch, else critical). */
export function calcRunway(cash: number, burn: number): RunwayResult {
  const runwayMonths = burn > 0 ? cash / burn : 0;
  const verdict: RunwayVerdict =
    runwayMonths >= 18 ? "SAFE" : runwayMonths >= 12 ? "WATCH" : "CRITICAL";
  return { runwayMonths, verdict };
}
