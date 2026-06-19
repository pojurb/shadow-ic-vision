import { describe, expect, it } from "vitest";
import { deriveIdeaTriage } from "./triage";

describe("idea triage", () => {
  it("keeps casual text non-persistent and candidate-free", () => {
    const result = deriveIdeaTriage("hi there");

    expect(result.mode).toBe("casual");
    expect(result.candidates).toHaveLength(0);
    expect(result.summary).toMatch(/No case file opened/i);
  });

  it("frames broad Indonesian stock questions as investigation candidates", () => {
    const result = deriveIdeaTriage("any Indonesian stocks worth digging into?");

    expect(result.mode).toBe("broad_screen");
    expect(result.heading).toMatch(/Indonesian equity/i);
    expect(result.summary).toMatch(/not buy\/sell recommendations/i);
    expect(result.candidates.map((candidate) => candidate.assetName)).toContain("BBCA");
  });

  it("turns direct asset requests into an explicit case-start candidate", () => {
    const result = deriveIdeaTriage("analyze BBCA");

    expect(result.mode).toBe("direct_asset");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].ticker).toBe("BBCA");
    expect(result.chairNotes.join(" ")).toMatch(/temporary/i);
  });
});
