/**
 * The research state a briefing row carries, so the weekly review shows whether
 * a thesis actually stands rather than only its ticker. Mirrors what the
 * Research Panel derives; see `getThesisResearchSummaries` in `db/queries.ts`.
 */
export type ThesisResearchSummary = {
  verdictLevel: 'breached' | 'at_risk' | 'holding' | 'insufficient_evidence';
  supported: number;
  totalAssumptions: number;
  unevidenced: number;
  /**
   * Secondary passages retrieved by lexical overlap whose relevance to the
   * claim was never assessed (R-025). Counted separately from `supported`
   * precisely so the briefing cannot present them as corroboration.
   */
  relevanceUnassessedCount: number;
};

export type PortfolioHoldingQueueItem = {
  id: string;
  ticker: string;
  market: 'US' | 'ID';
  status: 'owned' | 'watchlist';
  thesisId: string | null;
  thesisTitle: string | null;
  conversationId: string | null;
  priorityScore: number;
  unreadAlertCount: number;
  daysSinceLastReview: number;
  hasChallengedAssumptions: boolean;
  lastOutcome: string | null;
  lastAction: string | null;
  research: ThesisResearchSummary | null;
};

/** Short, honest label for a verdict level in dense briefing surfaces. */
export const VERDICT_LABEL: Record<ThesisResearchSummary['verdictLevel'], string> = {
  breached: 'Breached',
  at_risk: 'At risk',
  holding: 'Holding',
  insufficient_evidence: 'Not enough evidence',
};

export const STALE_REVIEW_DAYS = 7;

export function calculatePriorityScore(
  unreadAlertCount: number,
  daysSinceLastReview: number,
  hasChallengedAssumptions: boolean
): number {
  let score = 0;

  // Unread alerts heavily increase priority
  score += unreadAlertCount * 50;

  // Staleness
  if (daysSinceLastReview > STALE_REVIEW_DAYS) {
    score += (daysSinceLastReview * 5);
  }

  // Challenged assumptions
  if (hasChallengedAssumptions) {
    score += 30;
  }

  return score;
}
