import { describe, expect, it } from "vitest";
import { createDefaultICState, nextReviewDueAfter, normalizeICState } from "./ic";
import type { ICState } from "./types";

const NOW = Date.parse("2026-06-18T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("IC state normalization", () => {
  it("backfills missing IC state with default thesis memory and weekly review", () => {
    const ic = normalizeICState(undefined, NOW);

    expect(ic.thesis.summary).toBe("");
    expect(ic.thesis.assumptions).toEqual([]);
    expect(ic.thesis.evidenceCandidates).toEqual([]);
    expect(ic.review).toEqual({
      cadence: "weekly",
      lastReviewedAt: null,
      nextReviewDue: NOW + 7 * DAY_MS,
    });
  });

  it("sanitizes malformed thesis and review values without throwing", () => {
    const ic = normalizeICState({
      thesis: {
        summary: 42,
        assumptions: "wrong",
        thesisBreakers: [{ id: "breaker", text: "Funding breaks", severity: "material", createdAt: 1 }],
        watchItems: null,
        valuationAssumptions: undefined,
        catalysts: [{ id: "cat", text: "Catalyst", createdAt: 1 }],
        openQuestions: {},
        evidenceCandidates: [{ id: "source", title: "Source", createdAt: 1 }],
        conviction: "extreme",
      },
      review: {
        cadence: "daily",
        lastReviewedAt: "yesterday",
        nextReviewDue: "soon",
      },
    } as unknown as ICState, NOW);

    expect(ic.thesis.summary).toBe("");
    expect(ic.thesis.assumptions).toEqual([]);
    expect(ic.thesis.thesisBreakers).toHaveLength(1);
    expect(ic.thesis.watchItems).toEqual([]);
    expect(ic.thesis.catalysts).toHaveLength(1);
    expect(ic.thesis.openQuestions).toEqual([]);
    expect(ic.thesis.evidenceCandidates).toHaveLength(1);
    expect(ic.thesis.conviction).toBeNull();
    expect(ic.review.cadence).toBe("weekly");
    expect(ic.review.lastReviewedAt).toBeNull();
    expect(ic.review.nextReviewDue).toBe(NOW + 7 * DAY_MS);
  });

  it("keeps event-driven due dates manual when marking reviewed", () => {
    const review = {
      cadence: "event_driven" as const,
      lastReviewedAt: null,
      nextReviewDue: NOW + 12 * DAY_MS,
    };

    expect(nextReviewDueAfter(review, NOW)).toBe(NOW + 12 * DAY_MS);
  });

  it("advances recurring review cadences when marking reviewed", () => {
    const review = createDefaultICState(NOW).review;

    expect(nextReviewDueAfter(review, NOW + DAY_MS)).toBe(NOW + 8 * DAY_MS);
  });
});
