import {
  THRESHOLD_OPERATORS,
  type EvidencePolarity,
  type MeasurementContract,
} from '@/lib/domain/contracts';

/**
 * M011 — the coverage ledger.
 *
 * The audit that produced this milestone found ten assumptions backed by five
 * pieces of evidence, four assumptions with *no* evidence at all, and no report
 * of that gap anywhere. Absence of evidence had been silently converted into
 * absence of concern.
 *
 * This module makes the gap a first-class output. Pure and dependency-free: it
 * takes rows and returns counts, so it is fully testable without a database and
 * produces the identical object for the panel and for the model prompt.
 */

export type UnevidencedReason =
  /** The job has not finished yet. Nothing is wrong. */
  | 'job_pending'
  /** The job failed outright. */
  | 'job_failed'
  /** Retrieval succeeded but nothing cleared the verification gate. */
  | 'no_candidate_passed_gate'
  /** No structured fact source exists for this market — a permanent gap. */
  | 'no_source_for_market'
  /**
   * M013 Q6. The user classified this assumption's *current* contract as
   * class (C): no public source identified, after actually looking — a
   * durable judgment (`source_adequacy_assessments`), not a computed
   * inference like `no_source_for_market`. Distinct because the reasoning
   * behind it is per-assumption and evidence-based (competitor data no peer
   * discloses; a bilateral contract that's trade-secret), where
   * `no_source_for_market` is a blanket system-capability fact true for
   * every ID-market assumption alike.
   */
  | 'no_source_identified';

export type CoverageLedger = {
  totalAssumptions: number;
  /** At least one evidence row, of any polarity. */
  evidenced: number;
  /** At least one supporting row and no contradicting one. */
  supported: number;
  /** At least one contradicting row. Counted independently of `supported`. */
  contradicted: number;
  /** Has evidence, but none of it points either way. */
  inconclusiveOnly: number;
  unevidenced: number;
  /** Contracts that are neither `resolved` nor `not_measurable`. */
  unresolvedContracts: number;
  coverageRatio: number;
  confidenceGate: 'open' | 'suppressed';
  suppressionReasons: Array<'low_coverage' | 'unresolved_contracts'>;
  unevidencedAssumptions: Array<{ assumptionId: string; statement: string; reason: UnevidencedReason }>;
};

/**
 * A product judgment, stated as one rather than presented as measured — the
 * same honesty the M010 shape thresholds are recorded with. 0.7 means "three in
 * ten assumptions may lack evidence before the system stops sounding
 * confident." No data supports 0.7 over 0.6 or 0.8.
 */
export const MIN_COVERAGE_RATIO = 0.7;

export type CoverageAssumptionInput = {
  assumptionId: string;
  statement: string;
  market: 'US' | 'ID';
  contract: MeasurementContract | null;
  jobStatus: 'queued' | 'running' | 'succeeded' | 'degraded' | 'failed';
  /**
   * The live (fingerprint-matched) `source_adequacy_assessments`
   * classification. Optional so the six pre-M013-Q6 call sites in
   * `coverage-verdict.test.ts` — none of which exercise this axis — don't
   * need a mechanical `sourceAdequacy: null` added to stay green; a caller
   * that omits it is treated identically to one passing `null`.
   */
  sourceAdequacy?: 'A' | 'B' | 'C' | null;
  polarities: EvidencePolarity[];
};

function unevidencedReason(input: CoverageAssumptionInput): UnevidencedReason {
  /*
   * Checked first, ahead of job status: a recorded (C) is the answer, not a
   * transient state the job happens to be in underneath it. The job may sit
   * at `degraded`, `queued`, or anything else once closed (`ingestion.ts`
   * simply stops requeuing it) — none of that is what the user should read.
   */
  if (input.sourceAdequacy === 'C') return 'no_source_identified';
  if (input.jobStatus === 'queued' || input.jobStatus === 'running') return 'job_pending';
  if (input.jobStatus === 'failed') return 'job_failed';
  /*
   * A resolved claim that names XBRL tags but sits in a market with no
   * company-concept API was never going to be answerable by structured
   * retrieval. Naming that specifically — rather than lumping it in with "the
   * ranker found nothing" — is the difference between a gap the user can act on
   * and one that reads as a malfunction.
   */
  if (
    input.market === 'ID'
    && input.contract?.resolution === 'resolved'
    && input.contract.sourceTags.length > 0
  ) return 'no_source_for_market';
  return 'no_candidate_passed_gate';
}

export function deriveCoverageLedger(assumptions: readonly CoverageAssumptionInput[]): CoverageLedger {
  const total = assumptions.length;
  let evidenced = 0;
  let supported = 0;
  let contradicted = 0;
  let inconclusiveOnly = 0;
  let unresolvedContracts = 0;
  const unevidencedAssumptions: CoverageLedger['unevidencedAssumptions'] = [];

  for (const assumption of assumptions) {
    const resolution = assumption.contract?.resolution;
    if (resolution !== 'resolved' && resolution !== 'not_measurable') unresolvedContracts += 1;

    if (assumption.polarities.length === 0) {
      unevidencedAssumptions.push({
        assumptionId: assumption.assumptionId,
        statement: assumption.statement,
        reason: unevidencedReason(assumption),
      });
      continue;
    }

    evidenced += 1;
    const hasContradiction = assumption.polarities.includes('contradicts');
    const hasSupport = assumption.polarities.includes('supports');
    if (hasContradiction) contradicted += 1;
    else if (hasSupport) supported += 1;
    else inconclusiveOnly += 1;
  }

  const coverageRatio = total === 0 ? 0 : evidenced / total;
  const suppressionReasons: CoverageLedger['suppressionReasons'] = [];
  if (coverageRatio < MIN_COVERAGE_RATIO) suppressionReasons.push('low_coverage');
  if (unresolvedContracts > 0) suppressionReasons.push('unresolved_contracts');

  return {
    totalAssumptions: total,
    evidenced,
    supported,
    contradicted,
    inconclusiveOnly,
    unevidenced: unevidencedAssumptions.length,
    unresolvedContracts,
    coverageRatio,
    confidenceGate: suppressionReasons.length > 0 ? 'suppressed' : 'open',
    suppressionReasons,
    unevidencedAssumptions,
  };
}

/** True when the contract states an absolute threshold a fact can breach. */
export function isThresholdContract(contract: MeasurementContract | null): boolean {
  return Boolean(
    contract
    && contract.resolution === 'resolved'
    && THRESHOLD_OPERATORS.has(contract.operator)
    && contract.threshold !== null,
  );
}
