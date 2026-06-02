import { describe, it, expect } from "vitest";
import { finalizeIntake } from "./analyze";
import type { IntakeOutput } from "./schemas";
import { BLANK_PARAMS } from "@/data/presets";

/** Minimal raw-output factory; override per case. */
function raw(over: Partial<IntakeOutput>): IntakeOutput {
  return {
    vertical: "stocks",
    mode: "figures",
    assetName: "Test Co",
    title: "Test",
    note: "",
    fields: [],
    ...over,
  };
}

describe("finalizeIntake", () => {
  it("keeps known stock keys, tags stated vs inferred, and merges BLANK_PARAMS", () => {
    const r = finalizeIntake(
      raw({
        vertical: "stocks",
        fields: [
          { key: "price", value: 4200, source: "stated" },
          { key: "eps", value: 380, source: "stated" },
          { key: "roe", value: 19, source: "inferred" },
        ],
      }),
    );
    expect(r.vertical).toBe("stocks");
    expect(r.mode).toBe("figures");
    // kept rows carry their source tags
    expect(r.fields.map((f) => [f.key, f.value, f.source])).toEqual([
      ["price", 4200, "stated"],
      ["eps", 380, "stated"],
      ["roe", 19, "inferred"],
    ]);
    // numbers overlay the blank defaults; untouched defaults remain
    expect(r.params.price).toBe(4200);
    expect(r.params.eps).toBe(380);
    expect(r.params.roe).toBe(19);
    expect(r.params.discountRate).toBe(BLANK_PARAMS.stocks.discountRate);
  });

  it("drops unknown keys and non-numeric values", () => {
    const r = finalizeIntake(
      raw({
        vertical: "stocks",
        fields: [
          { key: "price", value: 5000, source: "stated" },
          { key: "ebitda", value: 999, source: "inferred" }, // not a stock engine key
          { key: "eps", value: Number.NaN, source: "stated" }, // non-finite
        ],
      }),
    );
    expect(r.fields.map((f) => f.key)).toEqual(["price"]);
    expect("ebitda" in r.params).toBe(false);
  });

  it("defaults stocks cashflows to a flat-EPS proxy when not given", () => {
    const r = finalizeIntake(
      raw({ vertical: "stocks", fields: [{ key: "eps", value: 250, source: "stated" }] }),
    );
    expect(r.params.cashflows).toEqual([250, 250, 250, 250, 250]);
  });

  it("clamps an unknown vertical to stocks", () => {
    const r = finalizeIntake(raw({ vertical: "crypto", fields: [{ key: "price", value: 100, source: "stated" }] }));
    expect(r.vertical).toBe("stocks");
  });

  it("clamps an unknown source to inferred (so it gets confirmed)", () => {
    const r = finalizeIntake(
      raw({ fields: [{ key: "price", value: 100, source: "guessed" as unknown as "stated" }] }),
    );
    expect(r.fields[0].source).toBe("inferred");
  });

  it("forces scoping mode when no fields survive, even if model said figures", () => {
    const r = finalizeIntake(raw({ mode: "figures", fields: [] }));
    expect(r.mode).toBe("scoping");
  });

  it("passes scoping mode through and still yields clean blank params", () => {
    const r = finalizeIntake(raw({ vertical: "startups", mode: "scoping", fields: [] }));
    expect(r.mode).toBe("scoping");
    expect(r.params).toMatchObject(BLANK_PARAMS.startups);
  });

  it("zips startup keys against the startup engine params", () => {
    const r = finalizeIntake(
      raw({
        vertical: "startups",
        fields: [
          { key: "cash", value: 5e9, source: "stated" },
          { key: "burn", value: 4e8, source: "inferred" },
          { key: "price", value: 50000, source: "stated" }, // a conventional key — not valid here
        ],
      }),
    );
    expect(r.fields.map((f) => f.key).sort()).toEqual(["burn", "cash"]);
    expect(r.params.cash).toBe(5e9);
    expect(r.params.burn).toBe(4e8);
  });

  it("defaults a blank/missing title", () => {
    const r = finalizeIntake(raw({ title: "   ", fields: [{ key: "price", value: 1, source: "stated" }] }));
    expect(r.title).toBe("New analysis");
  });
});
