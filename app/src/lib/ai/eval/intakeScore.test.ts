import { describe, expect, it } from "vitest";
import { finalizeIntake } from "@/lib/ai/analyze";
import { gatherIntakeWebEvidence } from "@/lib/ai/intakeContext";
import type { IntakeOutput } from "@/lib/ai/schemas";
import {
  INTAKE_EVAL_CASES,
  buildIntakeEvalText,
  createIntakeEvalFetch,
} from "./intakeCases";
import { IMPROVEMENT_LOG } from "./improvementLog";
import {
  failedChecks,
  mergeIntakeScores,
  scoreIntakeResearch,
  scoreIntakeResult,
} from "./intakeScore";

async function evidenceForCase(testCase: (typeof INTAKE_EVAL_CASES)[number]) {
  return gatherIntakeWebEvidence({
    conversationText: testCase.conversationText,
    sources: testCase.sources,
    allowWebSearch: testCase.allowWebSearch,
    fetchImpl: createIntakeEvalFetch(testCase),
  });
}

describe.each(INTAKE_EVAL_CASES)("intake eval harness - $id", (testCase) => {
  it("scores mocked research retrieval cleanly", async () => {
    const evidence = await evidenceForCase(testCase);
    const score = scoreIntakeResearch(testCase, evidence);

    expect(failedChecks(score)).toEqual([]);
  });

  it("scores the passing intake fixture cleanly", async () => {
    const evidence = await evidenceForCase(testCase);
    const result = finalizeIntake(testCase.passingOutput);
    const combined = mergeIntakeScores(testCase.id, [
      scoreIntakeResearch(testCase, evidence),
      scoreIntakeResult(testCase, result, evidence),
    ]);

    expect(failedChecks(combined)).toEqual([]);
  });

  it("builds an augmented model prompt from deterministic evidence", async () => {
    const evidence = await evidenceForCase(testCase);
    const augmented = buildIntakeEvalText(testCase, evidence);

    expect(augmented).toContain("Research evidence:");
    expect(augmented).toContain("extract valuation-engine figures only when they are visible");
  });
});

describe("intake eval harness - regression detection", () => {
  it("flags invented assumptions and generic evidence for the MBMA failure class", async () => {
    const testCase = INTAKE_EVAL_CASES.find((c) => c.id === "mbma-noisy-stock");
    expect(testCase).toBeTruthy();
    if (!testCase) return;

    const badOutput: IntakeOutput = {
      vertical: "stocks",
      mode: "figures",
      assetName: "MBMA",
      title: "MBMA stock analysis",
      note: "Invented valuation assumptions slipped into intake.",
      fields: [
        { key: "price", value: 5000, source: "inferred" },
        { key: "eps", value: 500, source: "inferred" },
        { key: "discountRate", value: 10, source: "inferred" },
        { key: "terminalMult", value: 10, source: "inferred" },
      ],
      thesis: {
        summary: "MBMA is interesting.",
        assumptions: [],
        thesisBreakers: [],
        watchItems: [],
        valuationAssumptions: ["Discount rate and terminal multiple are assumed."],
        catalysts: [],
        openQuestions: [],
        evidenceCandidates: [
          {
            title: "JPMorgan annual report",
            url: "https://example.com/jpmorgan",
            note: "Generic annual report result.",
            type: "filing",
            relation: "neutral",
            reliability: "unknown",
          },
        ],
      },
    };

    const evidence = await evidenceForCase(testCase);
    const result = finalizeIntake(badOutput);
    const score = scoreIntakeResult(testCase, result, evidence);
    const failed = failedChecks(score, true).map((c) => c.id);

    expect(score.criticalPass).toBe(false);
    expect(failed).toContain("field:roe");
    expect(failed).toContain("no-field:discountRate");
    expect(failed).toContain("no-field:terminalMult");
    expect(failed.some((id) => id.startsWith("no-evidence:"))).toBe(true);
    expect(failed).toContain("evidence-visible");
  });

  it("keeps improvement-log entries tied to concrete eval cases", () => {
    const caseIds = new Set(INTAKE_EVAL_CASES.map((testCase) => testCase.id));

    for (const entry of IMPROVEMENT_LOG) {
      expect(caseIds.has(entry.caseId), entry.id).toBe(true);
      expect(entry.guardedBy.length, entry.id).toBeGreaterThan(0);
    }
  });
});
