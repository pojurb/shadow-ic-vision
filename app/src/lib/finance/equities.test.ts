import { describe, it, expect } from "vitest";
import { calcPE, calcDCF } from "./equities";

describe("calcPE", () => {
  it("computes P/E, earnings yield, PEG and a fair verdict (BBCA-like)", () => {
    const r = calcPE(9200, 680, 22.5);
    expect(r.pe).toBeCloseTo(13.529, 2);
    expect(r.earningsYield).toBeCloseTo(7.391, 2);
    expect(r.peg).toBeCloseTo(0.601, 2);
    expect(r.verdict).toBe("MARKET");
  });

  it("flags cheap and expensive multiples", () => {
    expect(calcPE(100, 10).verdict).toBe("DISCOUNT");
    expect(calcPE(1000, 50).verdict).toBe("PREMIUM");
  });

  it("handles non-positive eps and missing roe", () => {
    const r = calcPE(100, 0);
    expect(r.pe).toBe(0);
    expect(r.earningsYield).toBe(0);
    expect(r.peg).toBeNull();
    expect(r.verdict).toBe("DISCOUNT");
  });
});

describe("calcDCF", () => {
  const cfs = [600, 680, 780, 890, 1020];

  it("discounts cash flows and adds a terminal value", () => {
    const r = calcDCF(cfs, 0.1, 15, 8500);
    expect(r.discounted).toHaveLength(5);
    expect(r.discounted[0]).toBeCloseTo(545.45, 2);
    expect(r.totalNPV).toBeCloseTo(12434.78, 1);
    expect(r.marginOfSafety).toBeCloseTo(31.64, 1);
    expect(r.verdict).toBe("NPV POSITIVE");
  });

  it("reports negative NPV when intrinsic value is below cost", () => {
    const r = calcDCF(cfs, 0.1, 15, 20000);
    expect(r.verdict).toBe("NPV NEGATIVE");
    expect(r.marginOfSafety).toBeLessThan(0);
  });

  it("omits margin of safety without a cost basis", () => {
    const r = calcDCF(cfs, 0.1, 15);
    expect(r.marginOfSafety).toBeNull();
    expect(r.verdict).toBeNull();
  });
});
