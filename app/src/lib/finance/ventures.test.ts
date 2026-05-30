import { describe, it, expect } from "vitest";
import { calcLTV, calcCAC, calcRunway } from "./ventures";

describe("calcLTV", () => {
  it("computes lifetime value and a strong ratio (PayGuard-like)", () => {
    const r = calcLTV(450_000, 0.7, 0.04, 1_500_000);
    expect(r.avgLifetime).toBe(25);
    expect(r.ltv).toBeCloseTo(7_875_000, 0);
    expect(r.ltvCacRatio).toBeCloseTo(5.25, 2);
    expect(r.verdict).toBe("STRONG");
  });

  it("classifies healthy and weak ratios", () => {
    expect(calcLTV(100_000, 0.5, 0.05, 300_000).verdict).toBe("HEALTHY"); // ratio 3.33
    expect(calcLTV(100_000, 0.5, 0.05, 400_000).verdict).toBe("WEAK"); // ratio 2.5
  });

  it("returns null ratio/verdict when churn is zero or CAC missing", () => {
    const r = calcLTV(100, 0.5, 0);
    expect(r.avgLifetime).toBe(0);
    expect(r.ltv).toBe(0);
    expect(r.ltvCacRatio).toBeNull();
    expect(r.verdict).toBeNull();
  });
});

describe("calcCAC", () => {
  it("computes payback months and verdict", () => {
    const r = calcCAC(1_500_000, 450_000, 0.7);
    expect(r.paybackMonths).toBeCloseTo(4.762, 2);
    expect(r.verdict).toBe("STRONG");
  });

  it("classifies acceptable and too-long payback", () => {
    expect(calcCAC(1_500_000, 100_000, 1).verdict).toBe("ACCEPTABLE"); // 15 months
    expect(calcCAC(10_000_000, 100_000, 0.5).verdict).toBe("TOO LONG"); // 200 months
  });
});

describe("calcRunway", () => {
  it("computes runway months with verdict thresholds", () => {
    expect(calcRunway(18e9, 1.2e9).runwayMonths).toBe(15);
    expect(calcRunway(18e9, 1.2e9).verdict).toBe("WATCH");
    expect(calcRunway(36e9, 1e9).verdict).toBe("SAFE");
    expect(calcRunway(5e9, 1e9).verdict).toBe("CRITICAL");
  });

  it("treats zero burn as no runway", () => {
    expect(calcRunway(5e9, 0).runwayMonths).toBe(0);
    expect(calcRunway(5e9, 0).verdict).toBe("CRITICAL");
  });
});
