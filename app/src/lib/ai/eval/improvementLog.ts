export type ImprovementStatus = "new" | "fixed" | "accepted-risk";

export interface ImprovementLogEntry {
  id: string;
  createdAt: string;
  area: "intake" | "grounding" | "decision" | "portfolio";
  caseId: string;
  status: ImprovementStatus;
  observedFailure: string;
  expectedBehavior: string;
  guardedBy: string[];
  notes?: string;
}

export const IMPROVEMENT_LOG: ImprovementLogEntry[] = [
  {
    id: "2026-06-11-mbma-intake-missing-data",
    createdAt: "2026-06-11",
    area: "intake",
    caseId: "mbma-noisy-stock",
    status: "fixed",
    observedFailure:
      "MBMA intake produced generic evidence and did not reliably extract supported stock data from web research.",
    expectedBehavior:
      "Detect MBMA as an IDX stock, keep search results ticker-relevant, extract only visible fields, and avoid invented valuation assumptions.",
    guardedBy: [
      "src/lib/ai/eval/intakeScore.test.ts",
      "src/lib/ai/eval/intakeCases.ts",
    ],
    notes:
      "Future intake failures should become eval cases before prompt or retrieval changes are promoted.",
  },
];
