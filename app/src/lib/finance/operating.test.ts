import { describe, it, expect } from "vitest";
import { calcBEP, calcIRR } from "./operating";

describe("calcBEP", () => {
  it("computes break-even units, revenue and margin (SpinExpress-like)", () => {
    const r = calcBEP(180_000_000, 45_000, 12_000);
    expect(r.contribution).toBe(33_000);
    expect(r.bepUnits).toBeCloseTo(5454.545, 2);
    expect(r.bepRevenue).toBeCloseTo(245_454_545.45, 0);
    expect(r.marginPct).toBeCloseTo(73.333, 2);
  });

  it("returns zeros when contribution is non-positive", () => {
    const r = calcBEP(100, 80, 80);
    expect(r.bepUnits).toBe(0);
    expect(r.bepRevenue).toBe(0);
  });
});

describe("calcIRR", () => {
  it("solves a known IRR via Newton-Raphson", () => {
    const r = calcIRR([-1000, 600, 600]);
    expect(r.irr).toBeCloseTo(13.07, 1);
    expect(r.totalInvested).toBe(1000);
    expect(r.totalReturns).toBe(1200);
    expect(r.verdict).toBe("WEAK");
  });

  it("classifies a strong IRR", () => {
    const r = calcIRR([-1000, 800, 800]);
    expect(r.irr).toBeCloseTo(37.98, 1);
    expect(r.verdict).toBe("STRONG");
  });
});
