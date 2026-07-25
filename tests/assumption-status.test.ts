import { describe, expect, it } from 'vitest';
import { deriveAssumptionStatus } from '@/lib/research/assumption-status';

describe('deriveAssumptionStatus (M007 confirmation gate)', () => {
  it('moves an untouched untested assumption to pending_confirmation on secondary-only evidence', () => {
    expect(deriveAssumptionStatus({
      currentStatus: 'untested',
      insertedVerificationStatuses: ['secondary_issuer'],
      hasOfficialEvidence: false,
    })).toBe('pending_confirmation');
  });

  it('does not move to pending_confirmation if official evidence already exists', () => {
    expect(deriveAssumptionStatus({
      currentStatus: 'untested',
      insertedVerificationStatuses: ['secondary_news'],
      hasOfficialEvidence: true,
    })).toBeNull();
  });

  it('does not touch a status other than untested when secondary evidence arrives', () => {
    for (const currentStatus of ['verified', 'challenged', 'held-belief', 'user_confirmed_secondary'] as const) {
      expect(deriveAssumptionStatus({
        currentStatus,
        insertedVerificationStatuses: ['secondary_issuer'],
        hasOfficialEvidence: false,
      })).toBeNull();
    }
  });

  it('reverts pending_confirmation to untested when official evidence arrives (clearing path 1)', () => {
    expect(deriveAssumptionStatus({
      currentStatus: 'pending_confirmation',
      insertedVerificationStatuses: ['exact_verified'],
      hasOfficialEvidence: true,
    })).toBe('untested');
    expect(deriveAssumptionStatus({
      currentStatus: 'pending_confirmation',
      insertedVerificationStatuses: ['ocr_matched'],
      hasOfficialEvidence: true,
    })).toBe('untested');
  });

  it('never promotes to verified — that is not this function\'s job', () => {
    // Even with official evidence and no prior pending state, this function
    // never returns 'verified': nothing in this app auto-marks an
    // assumption verified, and this gate only narrows what's shown.
    expect(deriveAssumptionStatus({
      currentStatus: 'untested',
      insertedVerificationStatuses: ['exact_verified'],
      hasOfficialEvidence: true,
    })).toBeNull();
  });

  it('is a no-op when only derived evidence is inserted', () => {
    expect(deriveAssumptionStatus({
      currentStatus: 'untested',
      insertedVerificationStatuses: ['derived'],
      hasOfficialEvidence: false,
    })).toBeNull();
  });
});
