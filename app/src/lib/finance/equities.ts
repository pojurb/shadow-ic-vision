/**
 * Listed-equities calculations: valuation multiples (P/E) and discounted cash flow (DCF).
 * Pure functions — these are the single source of numeric truth fed to the AI layer.
 */

export type PEVerdict = "DISCOUNT" | "MARKET" | "PREMIUM";

export interface PEResult {
  price: number;
  eps: number;
  /** Price / Earnings. 0 when eps <= 0. */
  pe: number;
  /** Inverse of P/E as a percentage. */
  earningsYield: number;
  /** P/E divided by ROE%. null when roe is missing / non-positive. */
  peg: number | null;
  verdict: PEVerdict;
}

/** Price-to-earnings with earnings yield, optional PEG, and a cheap/fair/expensive verdict. */
export function calcPE(price: number, eps: number, roe?: number | null): PEResult {
  const pe = eps > 0 ? price / eps : 0;
  const earningsYield = pe > 0 ? (1 / pe) * 100 : 0;
  const peg = roe && roe > 0 ? pe / roe : null;
  const verdict: PEVerdict = pe < 13 ? "DISCOUNT" : pe <= 15 ? "MARKET" : "PREMIUM";
  return { price, eps, pe, earningsYield, peg, verdict };
}

export type DCFVerdict = "NPV POSITIVE" | "NPV NEGATIVE";

export interface DCFResult {
  /** Per-period discounted cash flows (period 1..n). */
  discounted: number[];
  /** Sum of discounted explicit cash flows. */
  pvSum: number;
  /** Discounted terminal value (last cash flow * terminalMult, discounted at period n). */
  terminalValue: number;
  /** pvSum + terminalValue. */
  totalNPV: number;
  /** ((totalNPV - invested) / totalNPV) * 100. null when invested is missing / non-positive. */
  marginOfSafety: number | null;
  verdict: DCFVerdict | null;
}

/**
 * 5-year (or n-year) DCF with a terminal multiple on the final cash flow.
 * @param cashflows explicit per-period cash flows (period 1..n)
 * @param rate discount rate as a decimal (e.g. 0.10)
 * @param terminalMult multiple applied to the final cash flow for terminal value
 * @param invested optional cost basis to compute a margin of safety
 */
export function calcDCF(
  cashflows: number[],
  rate: number,
  terminalMult: number,
  invested?: number | null,
): DCFResult {
  const discounted = cashflows.map((cf, t) => cf / Math.pow(1 + rate, t + 1));
  const pvSum = discounted.reduce((a, b) => a + b, 0);
  const lastCF = cashflows[cashflows.length - 1] ?? 0;
  const terminalValue = (lastCF * terminalMult) / Math.pow(1 + rate, cashflows.length);
  const totalNPV = pvSum + terminalValue;
  const hasBasis = invested != null && invested > 0;
  return {
    discounted,
    pvSum,
    terminalValue,
    totalNPV,
    marginOfSafety: hasBasis ? ((totalNPV - invested) / totalNPV) * 100 : null,
    verdict: hasBasis ? (totalNPV > invested ? "NPV POSITIVE" : "NPV NEGATIVE") : null,
  };
}
