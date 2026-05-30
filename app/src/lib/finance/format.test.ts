import { describe, it, expect } from "vitest";
import { formatIDR, formatNum } from "./format";

describe("formatIDR", () => {
  it("returns N/A for null/NaN", () => {
    expect(formatIDR(null)).toBe("N/A");
    expect(formatIDR(undefined)).toBe("N/A");
    expect(formatIDR(Number.NaN)).toBe("N/A");
  });

  it("formats small numbers with id-ID grouping", () => {
    expect(formatIDR(8500)).toBe("Rp 8.500");
  });

  it("formats millions / billions / trillions compactly", () => {
    expect(formatIDR(245_454_545)).toBe("Rp 245.45M");
    expect(formatIDR(1.2e9)).toBe("Rp 1.20B");
    expect(formatIDR(3.5e12)).toBe("Rp 3.50T");
  });

  it("preserves sign", () => {
    expect(formatIDR(-8500)).toBe("-Rp 8.500");
  });
});

describe("formatNum", () => {
  it("returns 0 for null/NaN", () => {
    expect(formatNum(null)).toBe("0");
    expect(formatNum(Number.NaN)).toBe("0");
  });

  it("formats with id-ID decimal comma and dot grouping", () => {
    expect(formatNum(1234.5, 2)).toBe("1.234,50");
    expect(formatNum(13.5291, 1)).toBe("13,5");
  });
});
