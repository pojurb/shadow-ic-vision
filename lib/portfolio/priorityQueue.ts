export type PortfolioHoldingQueueItem = {
  id: string;
  ticker: string;
  market: 'US' | 'ID';
  shares: number;
  averageBuyPrice: number;
  thesisId: string | null;
  thesisTitle: string | null;
  priorityScore: number;
  unreadAlertCount: number;
  daysSinceLastReview: number;
  hasChallengedAssumptions: boolean;
};

export function calculatePriorityScore(
  unreadAlertCount: number,
  daysSinceLastReview: number,
  hasChallengedAssumptions: boolean
): number {
  let score = 0;

  // Unread alerts heavily increase priority
  score += unreadAlertCount * 50;

  // Staleness
  if (daysSinceLastReview > 7) {
    score += (daysSinceLastReview * 5);
  }

  // Challenged assumptions
  if (hasChallengedAssumptions) {
    score += 30;
  }

  return score;
}
