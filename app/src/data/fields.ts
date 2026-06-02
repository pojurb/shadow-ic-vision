/**
 * Shared slider/param spec for the three verticals. Lifted out of `AnalysisView`
 * so the intake engine (`finalizeIntake`, prompts) and the inspector both reuse
 * one source of truth for which parameters each vertical exposes and how to
 * format them. The keys here are the engine parameters the model may extract.
 */
import type { AssetParameters, Vertical } from "@/data/presets";
import { formatIDR, formatNum } from "@/lib/finance";

export interface Field {
  key: keyof AssetParameters;
  label: string;
  min: number;
  max: number;
  step: number;
  type: "currency" | "percent" | "percent_raw" | "number";
}

export const FIELDS: Record<Vertical, Field[]> = {
  stocks: [
    { key: "price", label: "Share Price (IDR)", min: 100, max: 20000, step: 100, type: "currency" },
    { key: "eps", label: "Earnings Per Share (EPS)", min: 10, max: 2000, step: 10, type: "currency" },
    { key: "roe", label: "Return on Equity (ROE %)", min: 1, max: 50, step: 0.5, type: "percent" },
    { key: "discountRate", label: "Discount Rate %", min: 0.05, max: 0.25, step: 0.01, type: "percent_raw" },
    { key: "terminalMult", label: "Terminal DCF Multiple", min: 5, max: 25, step: 1, type: "number" },
    { key: "invested", label: "Invested / Buy Price", min: 100, max: 20000, step: 100, type: "currency" },
  ],
  startups: [
    { key: "cash", label: "Cash Balance", min: 1e9, max: 5e10, step: 5e8, type: "currency" },
    { key: "burn", label: "Monthly Cash Burn", min: 1e8, max: 5e9, step: 5e7, type: "currency" },
    { key: "cac", label: "CAC (Acquisition Cost)", min: 50000, max: 5e6, step: 50000, type: "currency" },
    { key: "arpu", label: "Monthly ARPU", min: 10000, max: 2e6, step: 10000, type: "currency" },
    { key: "margin", label: "Gross Profit Margin %", min: 0.1, max: 0.95, step: 0.05, type: "percent_raw" },
    { key: "churn", label: "Monthly Churn Rate %", min: 0.01, max: 0.15, step: 0.005, type: "percent_raw" },
  ],
  conventional: [
    { key: "invested", label: "Initial CapEx Investment", min: 5e7, max: 2e9, step: 2.5e7, type: "currency" },
    { key: "fixed", label: "Annual Fixed Cost", min: 2e7, max: 1e9, step: 1e7, type: "currency" },
    { key: "price", label: "Avg Customer Billing / Unit", min: 5000, max: 500000, step: 2000, type: "currency" },
    { key: "variable", label: "Variable Cost / Unit (COGS)", min: 1000, max: 200000, step: 1000, type: "currency" },
  ],
};

/** The engine parameter keys a given vertical exposes (drives the intake zip). */
export function paramKeysFor(vertical: Vertical): (keyof AssetParameters)[] {
  return FIELDS[vertical].map((f) => f.key);
}

export function fmtVal(v: number, type: Field["type"]): string {
  if (type === "currency") return formatIDR(v);
  if (type === "percent") return `${v}%`;
  if (type === "percent_raw") return `${(v * 100).toFixed(1)}%`;
  return formatNum(v, 0);
}
