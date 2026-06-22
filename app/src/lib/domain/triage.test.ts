import { describe, expect, it } from "vitest";
import { createDefaultICState } from "./ic";
import {
  buildFactCheckSuggestions,
  buildExplorationCarryForwardEvidence,
  buildExploreSeedThesis,
  deriveIdeaTriage,
  inspectDeeperIdeaDiscoveryOutput,
  inspectIdeaDiscoveryOutput,
  seedICStateFromExploration,
} from "./triage";

describe("idea triage", () => {
  it("keeps casual text non-persistent and candidate-free", () => {
    const result = deriveIdeaTriage("hi there");

    expect(result.mode).toBe("casual");
    expect(result.candidates).toHaveLength(0);
    expect(result.summary).toMatch(/Nothing saved yet/i);
  });

  it("routes broad stock questions to AI discovery instead of hard-coded candidates", () => {
    const result = deriveIdeaTriage("any Indonesian stocks worth digging into?");

    expect(result.mode).toBe("broad_screen");
    expect(result.requiresDiscovery).toBe(true);
    expect(result.exploration).toBeNull();
  });

  it("routes broad business ideas to AI discovery", () => {
    const result = deriveIdeaTriage("small laundry business idea in Jakarta");

    expect(result.mode).toBe("broad_screen");
    expect(result.requiresDiscovery).toBe(true);
    expect(result.exploration).toBeNull();
  });

  it("turns direct asset requests into an explicit case-start candidate", () => {
    const result = deriveIdeaTriage("analyze BBCA");

    expect(result.mode).toBe("direct_asset");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].ticker).toBe("BBCA");
  });

  it("inspects AI discovery output into normalized guided exploration", () => {
    const result = inspectIdeaDiscoveryOutput({
      summary: "Compare a few temporary directions before saving anything.",
      directions: [
        {
          title: "US quality compounder",
          assetName: "US Quality Co",
          assetType: "public_equity",
          ticker: "usqc",
          thesisAngle: "Investigate earnings quality and valuation discipline.",
          whyItCouldWork: ["High returns on capital"],
          mainRisks: ["Multiple compression"],
          nextQuestions: ["What does the latest filing show?"],
        },
        {
          title: "Local service business",
          assetName: "Laundry chain",
          assetType: "conventional_business",
          ticker: "",
          thesisAngle: "Investigate whether recurring local demand and simple operations create durable economics.",
          whyItCouldWork: ["Neighborhood repeat demand"],
          mainRisks: ["Operator dependence"],
          nextQuestions: ["How stable are margins?"],
        },
        {
          title: "Invalid missing fields",
          assetName: "",
          assetType: "public_equity",
          ticker: "",
          thesisAngle: "",
          whyItCouldWork: [],
          mainRisks: [],
          nextQuestions: [],
        },
      ],
    });

    expect(result?.directions).toHaveLength(2);
    expect(result?.directions[0]).toMatchObject({
      id: "ai-public-equity-us-quality-co",
      ticker: "USQC",
      assetType: "public_equity",
    });
    expect(result?.summary).toMatch(/temporary directions/i);
  });

  it("rejects broad exploration output with fewer than two valid directions", () => {
    expect(inspectIdeaDiscoveryOutput({
      summary: "Too thin",
      directions: [
        {
          title: "Only one",
          assetName: "Only one",
          assetType: "other",
          ticker: "",
          thesisAngle: "Too little structure",
          whyItCouldWork: ["One"],
          mainRisks: ["One"],
          nextQuestions: ["One"],
        },
      ],
    })).toBeNull();
  });

  it("inspects deeper exploration output into normalized follow-up reasoning", () => {
    const result = inspectDeeperIdeaDiscoveryOutput({
      summary: "This direction may be worth saving if the economics hold up.",
      whyItCouldWork: ["Demand can repeat"],
      mainRisks: ["Margins may be weaker than expected"],
      evidenceToCheck: ["Review monthly sales history"],
      decisionQuestions: ["Would weak repeat demand kill the idea?"],
    }, "ai-local-service-business");

    expect(result).toMatchObject({
      directionId: "ai-local-service-business",
      whyItCouldWork: ["Demand can repeat"],
      decisionQuestions: ["Would weak repeat demand kill the idea?"],
    });
  });

  it("rejects deeper exploration output with missing required lists", () => {
    expect(inspectDeeperIdeaDiscoveryOutput({
      summary: "Incomplete",
      whyItCouldWork: [],
      mainRisks: ["Risk"],
      evidenceToCheck: ["Evidence"],
      decisionQuestions: ["Question"],
    }, "dir")).toBeNull();
  });

  it("builds one imported exploration note from the raw prompt only", () => {
    const item = buildExplorationCarryForwardEvidence("  look into BBCA deposit franchise  ");

    expect(item).toMatchObject({
      title: "Imported from Exploration",
      type: "transcript",
      relation: "unresolved",
      reliability: "user_provided",
      note: "look into BBCA deposit franchise",
    });
  });

  it("skips carry-forward evidence when the prompt is empty", () => {
    expect(buildExplorationCarryForwardEvidence("   ")).toBeNull();
  });

  it("seeds saved kickoff thesis from the selected direction and deeper exploration", () => {
    const seeded = buildExploreSeedThesis({
      id: "laundry",
      title: "Laundry business",
      assetName: "Laundry business",
      assetType: "conventional_business",
      thesisAngle: "A local laundry business may matter if repeat demand is durable.",
      whyItCouldWork: ["Repeat demand"],
      mainRisks: ["Operator dependence"],
      nextQuestions: ["How stable is demand?"],
    }, {
      directionId: "laundry",
      summary: "This may deserve a saved review only if margins and repeat demand survive basic checking.",
      whyItCouldWork: ["Simple operations can support margins"],
      mainRisks: ["Margins may be weaker than expected"],
      evidenceToCheck: ["Check monthly sales history"],
      decisionQuestions: ["Would weak repeat demand kill the case?"],
    }, createDefaultICState(100).thesis);

    expect(seeded.summary).toContain("saved review");
    expect(seeded.openQuestions.map((item) => item.text)).toEqual(["Would weak repeat demand kill the case?"]);
    expect(seeded.thesisBreakers.map((item) => item.text)).toEqual(["Margins may be weaker than expected"]);
  });

  it("preserves review cadence while seeding saved kickoff thesis from exploration", () => {
    const base = createDefaultICState(100);
    const seeded = seedICStateFromExploration({
      id: "chip",
      title: "Semiconductor infrastructure",
      assetName: "Semiconductor infrastructure idea",
      assetType: "public_equity",
      ticker: "CHIP",
      thesisAngle: "Demand for AI infrastructure may outlast the next normal cycle.",
      whyItCouldWork: ["AI spending may stay elevated"],
      mainRisks: ["Capex reversal"],
      nextQuestions: ["How credible is the backlog?"],
    }, {
      directionId: "chip",
      summary: "This deserves a saved review only if backlog quality and cycle timing still hold up.",
      whyItCouldWork: ["Backlog can provide visibility"],
      mainRisks: ["Backlog may not be durable"],
      evidenceToCheck: ["Review customer concentration"],
      decisionQuestions: ["What would show the cycle is already peaking?"],
    }, base);

    expect(seeded.review).toEqual(base.review);
    expect(seeded.thesis.summary).toContain("saved review");
  });

  it("builds ticker-first fact-check suggestions for a concrete listed company", () => {
    const suggestions = buildFactCheckSuggestions({
      assetType: "public_equity",
      title: "Semiconductor infrastructure",
      assetName: "Nvidia",
      ticker: "nvda",
      thesisSummary: "Demand for AI infrastructure may stay elevated.",
      openQuestions: ["How durable is the backlog?"],
    });

    expect(suggestions[0]).toMatchObject({
      kind: "ticker",
      seedText: "NVDA",
    });
    expect(suggestions.some((item) => item.kind === "company" && item.seedText === "Nvidia")).toBe(true);
    expect(suggestions.some((item) => item.seedText.includes("How durable is the backlog?"))).toBe(true);
  });

  it("builds company-based suggestions when a direction has no ticker", () => {
    const suggestions = buildFactCheckSuggestions({
      assetType: "public_equity",
      title: "Data platforms for AI",
      assetName: "Snowflake",
      thesisSummary: "Data tooling may benefit from AI adoption.",
      openQuestions: ["How sticky are enterprise customers?"],
    });

    expect(suggestions[0]).toMatchObject({
      kind: "company",
      seedText: "Snowflake",
    });
    expect(suggestions.some((item) => item.seedText === "Find leading public companies in Data platforms for AI")).toBe(true);
  });

  it("builds fallback public-market prompts for broad themes without a company or ticker", () => {
    const suggestions = buildFactCheckSuggestions({
      assetType: "public_equity",
      title: "AI infrastructure business",
      thesisSummary: "Explore the picks-and-shovels side of AI.",
      openQuestions: ["Which listed companies have the clearest exposure?"],
    });

    expect(suggestions.map((item) => item.seedText)).toEqual(expect.arrayContaining([
      "Find leading public companies in AI infrastructure business",
      "Compare 2 listed companies exposed to AI infrastructure business",
      "Identify one ETF or public company tied to AI infrastructure business",
    ]));
  });

  it("builds note-style suggestions for non-public-equity ideas", () => {
    const suggestions = buildFactCheckSuggestions({
      assetType: "conventional_business",
      title: "Laundry chain in Jakarta",
      thesisSummary: "Recurring local demand may create durable cash flow.",
      openQuestions: ["What do repeat customer rates look like?"],
    });

    expect(suggestions.some((item) => item.seedText.includes("Define the exact business or asset to verify"))).toBe(true);
    expect(suggestions.some((item) => item.seedText.includes("customers, unit economics, and risks"))).toBe(true);
  });

  it("deduplicates repeated fact-check suggestions and drops blanks", () => {
    const suggestions = buildFactCheckSuggestions({
      assetType: "public_equity",
      title: "NVDA review",
      assetName: "NVDA",
      ticker: "NVDA",
      openQuestions: [" ", "What does the latest filing show?"],
    });

    expect(new Set(suggestions.map((item) => item.seedText)).size).toBe(suggestions.length);
    expect(suggestions.every((item) => item.seedText.trim().length > 0)).toBe(true);
  });
});
