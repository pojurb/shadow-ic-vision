import type { MeasurementContract, MeasurementOperator, MeasurementUnit } from '@/lib/domain/contracts';
import { isThresholdContract, type CoverageLedger } from './coverage';

/**
 * M011 — the deterministic thesis verdict.
 *
 * The audit's headline finding was not that the system retrieved the wrong
 * evidence. It retrieved the right evidence — an automotive gross margin of
 * 16.9% against a thesis requiring above 20% — and presented it as the fourth
 * of five neutral bullets. The user could read the whole answer and come away
 * more confident than when they started.
 *
 * The fix is not a better prompt. It is that this verdict is **not model
 * output at all**: a pure function over persisted polarity, rendered by a JSX
 * node that sits lexically outside the container everything else lives in. No
 * amount of model text can reorder it, because no model produces it.
 */

export type ThesisVerdictLevel = 'breached' | 'at_risk' | 'holding' | 'insufficient_evidence';

export type VerdictContradiction = {
  assumptionId: string;
  statement: string;
  metric: string;
  operator: MeasurementOperator;
  threshold: number;
  unit: MeasurementUnit;
  observedValue: number;
  deltaVsThreshold: number;
  evidenceId: string;
  sourceName: string;
  sourceUrl: string;
};

export type ThesisVerdict = {
  level: ThesisVerdictLevel;
  /** Assembled by template from numbers and enum lookups. Never model text. */
  headline: string;
  /** Threshold breaches, largest absolute delta first. */
  contradictions: VerdictContradiction[];
  /** Assumptions contradicted without an absolute threshold to quantify. */
  softContradictionCount: number;
  rule: 'M011-deterministic-verdict-v1';
};

export type VerdictAssumptionInput = {
  assumptionId: string;
  statement: string;
  contract: MeasurementContract | null;
  evidence: Array<{
    id: string;
    polarity: 'supports' | 'contradicts' | 'inconclusive';
    deltaVsThreshold: number | null;
    /** Present only on structured-fact evidence. */
    observedValue: number | null;
    sourceName: string;
    sourceUrl: string;
  }>;
};

const OPERATOR_WORD: Record<MeasurementOperator, string> = {
  gte: 'at least',
  gt: 'above',
  lte: 'at most',
  lt: 'below',
  eq: 'exactly',
  increases: 'an increase in',
  decreases: 'a decrease in',
  none: '',
};

export function formatValue(value: number, unit: MeasurementUnit): string {
  const rounded = Number(value.toFixed(2));
  if (unit === 'percent') return `${rounded}%`;
  if (unit === 'usd') return `$${rounded.toLocaleString('en-US')}`;
  if (unit === 'idr') return `Rp${rounded.toLocaleString('en-US')}`;
  return String(rounded);
}

/**
 * Percentage claims are conventionally discussed in basis points, and the
 * difference between "3.1 below" and "310bps below" is the difference between
 * a number a PM has to convert and one they can act on.
 */
export function formatDelta(delta: number, unit: MeasurementUnit): string {
  if (unit === 'percent') {
    const bps = Math.round(Math.abs(delta) * 100);
    return `${bps}bps ${delta < 0 ? 'below' : 'above'}`;
  }
  return `${formatValue(Math.abs(delta), unit)} ${delta < 0 ? 'below' : 'above'}`;
}

export function deriveThesisVerdict(input: {
  assumptions: readonly VerdictAssumptionInput[];
  coverage: CoverageLedger;
}): ThesisVerdict {
  const contradictions: VerdictContradiction[] = [];
  let softContradictionCount = 0;

  for (const assumption of input.assumptions) {
    const contradicting = assumption.evidence.filter((row) => row.polarity === 'contradicts');
    if (contradicting.length === 0) continue;

    const contract = assumption.contract;
    /*
     * Only a threshold contract can produce a quantified breach. A directional
     * or model-classified contradiction is real but has no absolute bar to
     * report a distance from, so it escalates the level to `at_risk` and is
     * counted — never dressed up with a number it does not have.
     */
    if (!isThresholdContract(contract) || !contract) {
      softContradictionCount += 1;
      continue;
    }

    const quantified = contradicting.filter((row) => row.deltaVsThreshold !== null && row.observedValue !== null);
    if (quantified.length === 0) {
      softContradictionCount += 1;
      continue;
    }

    // The worst breach for this assumption represents it.
    const worst = [...quantified].sort((left, right) => Math.abs(right.deltaVsThreshold!) - Math.abs(left.deltaVsThreshold!))[0];
    contradictions.push({
      assumptionId: assumption.assumptionId,
      statement: assumption.statement,
      metric: contract.metric,
      operator: contract.operator,
      threshold: contract.threshold as number,
      unit: contract.unit,
      observedValue: worst.observedValue as number,
      deltaVsThreshold: worst.deltaVsThreshold as number,
      evidenceId: worst.id,
      sourceName: worst.sourceName,
      sourceUrl: worst.sourceUrl,
    });
  }

  contradictions.sort((left, right) => Math.abs(right.deltaVsThreshold) - Math.abs(left.deltaVsThreshold));

  const level: ThesisVerdictLevel = contradictions.length > 0
    ? 'breached'
    : softContradictionCount > 0
      ? 'at_risk'
      : input.coverage.confidenceGate === 'suppressed'
        ? 'insufficient_evidence'
        : 'holding';

  return {
    level,
    headline: buildHeadline(level, contradictions, softContradictionCount, input.coverage),
    contradictions,
    softContradictionCount,
    rule: 'M011-deterministic-verdict-v1',
  };
}

function buildHeadline(
  level: ThesisVerdictLevel,
  contradictions: VerdictContradiction[],
  softContradictionCount: number,
  coverage: CoverageLedger,
): string {
  if (level === 'breached') {
    const worst = contradictions[0];
    return `THESIS BREACHED — ${worst.metric} is ${formatValue(worst.observedValue, worst.unit)} `
      + `versus the ${OPERATOR_WORD[worst.operator]} ${formatValue(worst.threshold, worst.unit)} this thesis requires `
      + `(${formatDelta(worst.deltaVsThreshold, worst.unit)}).`
      + (contradictions.length > 1 ? ` ${contradictions.length} assumptions are breached in total.` : '');
  }
  if (level === 'at_risk') {
    return `THESIS AT RISK — ${softContradictionCount} assumption${softContradictionCount === 1 ? ' is' : 's are'} `
      + 'contradicted by retrieved evidence, without an absolute threshold to quantify the gap.';
  }
  if (level === 'insufficient_evidence') {
    const parts: string[] = [];
    if (coverage.suppressionReasons.includes('low_coverage')) {
      parts.push(`only ${coverage.evidenced} of ${coverage.totalAssumptions} assumptions have any evidence`);
    }
    if (coverage.suppressionReasons.includes('unresolved_contracts')) {
      parts.push(`${coverage.unresolvedContracts} assumption${coverage.unresolvedContracts === 1 ? '' : 's'} cannot be measured as stated`);
    }
    return `INSUFFICIENT EVIDENCE — ${parts.join(', and ')}. No conclusion about this thesis is supported yet.`;
  }
  return `THESIS HOLDING — ${coverage.evidenced} of ${coverage.totalAssumptions} assumptions are evidenced `
    + 'and none is contradicted by the evidence retrieved so far.';
}
