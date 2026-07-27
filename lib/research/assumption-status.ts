import type { EvidenceVerificationStatus } from './extractors/candidate';

export type AssumptionStatus = 'untested' | 'verified' | 'challenged' | 'held-belief' | 'pending_confirmation' | 'user_confirmed_secondary';

const OFFICIAL_STATUSES: ReadonlySet<EvidenceVerificationStatus> = new Set(['exact_verified', 'ocr_matched']);
const SECONDARY_STATUSES: ReadonlySet<EvidenceVerificationStatus> = new Set(['secondary_issuer', 'secondary_news']);

/**
 * M007 Workflow 3 — the assumption confirmation gate. A pure decision
 * function: callers query current state and apply the returned status
 * themselves (see `lib/research/service.ts`'s two evidence-insert
 * transactions). This is the first place application logic mutates
 * `assumptions.status` after creation — confirmed by code review at
 * scoping time that nothing else does. It only ever narrows what's shown;
 * it never marks anything `'verified'` on its own.
 */
export function deriveAssumptionStatus(input: {
  currentStatus: AssumptionStatus;
  insertedVerificationStatuses: EvidenceVerificationStatus[];
  hasOfficialEvidence: boolean;
}): AssumptionStatus | null {
  const insertedOfficial = input.insertedVerificationStatuses.some((status) => OFFICIAL_STATUSES.has(status));
  const insertedSecondary = input.insertedVerificationStatuses.some((status) => SECONDARY_STATUSES.has(status));

  // Clearing path 1: official evidence arriving reverts a pending
  // secondary-only assumption back to untested — never promotes to
  // 'verified', since nothing in this app auto-marks an assumption verified.
  if (insertedOfficial && input.currentStatus === 'pending_confirmation') {
    return 'untested';
  }

  // Only ever moves an untouched 'untested' assumption into
  // 'pending_confirmation', and only when it has no official support at all.
  if (insertedSecondary && input.currentStatus === 'untested' && !input.hasOfficialEvidence) {
    return 'pending_confirmation';
  }

  return null;
}

/**
 * M010 Slice 4. The removal-shaped sibling of `deriveAssumptionStatus`, which
 * is insert-shaped and has no transition for evidence going away.
 *
 * Needed because the M010 cleanup deletes secondary evidence rows that the
 * fixed extractor would no longer produce. An assumption left at
 * `pending_confirmation` after its only supporting evidence is removed would
 * be asserting a confirmation gate over nothing.
 *
 * Lives here rather than as inline SQL in the cleanup script so the transition
 * is unit-testable and discoverable next to the rule it mirrors.
 *
 * Returns `'needs_manual_review'` rather than a status for
 * `user_confirmed_secondary`: that value records an explicit human decision to
 * accept secondary evidence, so no automated sweep may silently undo it.
 */
export function deriveAssumptionStatusAfterEvidenceRemoval(input: {
  currentStatus: AssumptionStatus;
  hasRemainingSecondaryEvidence: boolean;
  hasOfficialEvidence: boolean;
}): AssumptionStatus | 'needs_manual_review' | null {
  if (input.currentStatus === 'user_confirmed_secondary') return 'needs_manual_review';

  if (
    input.currentStatus === 'pending_confirmation'
    && !input.hasRemainingSecondaryEvidence
    && !input.hasOfficialEvidence
  ) {
    return 'untested';
  }

  return null;
}
