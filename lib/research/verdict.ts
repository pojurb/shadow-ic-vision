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

  /*
   * `DEC-0018`. The positive state additionally requires that something is
   * actually supported. It previously followed from the absence of a
   * contradiction alone, which meant a thesis whose every quote was
   * `inconclusive` — the real TLKM thesis, 42 rows of it — still read
   * `THESIS HOLDING`. Absence of contradiction is not evidence of support,
   * least of all when the system could not evaluate direction at all.
   *
   * The positive state is kept rather than deleted: "evidence supports a
   * measurable claim", "no contradiction found", and "not enough evidence" are
   * three different things, and collapsing the first into the third would lose
   * a distinction the product needs. It is gated, not removed.
   */
  const level: ThesisVerdictLevel = contradictions.length > 0
    ? 'breached'
    : softContradictionCount > 0
      ? 'at_risk'
      : input.coverage.confidenceGate === 'suppressed' || input.coverage.supported === 0
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
    /*
     * `DEC-0018` opened a route to this level that the two suppression reasons
     * below do not describe: coverage can be complete and the gate open while
     * nothing is supported. Stated first because it is the strongest reason
     * present when it applies — and because without it `parts` could be empty,
     * which rendered as the malformed "INSUFFICIENT EVIDENCE — . No
     * conclusion...".
     */
    if (coverage.supported === 0) {
      parts.push('no assumption is supported by evidence');
      if (coverage.inconclusiveOnly > 0) {
        parts.push(`${coverage.inconclusiveOnly} ${coverage.inconclusiveOnly === 1 ? 'has a quote' : 'have quotes'} `
          + 'verified verbatim from their source but never checked for relevance to the claim');
      }
    }
    if (coverage.suppressionReasons.includes('low_coverage')) {
      parts.push(`only ${coverage.evidenced} of ${coverage.totalAssumptions} assumptions have any evidence`);
    }
    if (coverage.suppressionReasons.includes('unresolved_contracts')) {
      parts.push(`${coverage.unresolvedContracts} assumption${coverage.unresolvedContracts === 1 ? '' : 's'} cannot be measured as stated`);
    }
    return `INSUFFICIENT EVIDENCE — ${parts.join('; ')}. No conclusion about this thesis is supported yet.`;
  }
  return buildHoldingHeadline(coverage);
}

/**
 * Found 2026-08-05 against the real TLKM thesis. The previous wording —
 * "N of M assumptions are evidenced and none is contradicted" — was true and
 * badly misleading at the same time.
 *
 * All 23 of that thesis's evidence rows were `inconclusive` with
 * `polarityMethod = no_observed_value`: the contracts stated thresholds
 * (`gte 30 percent`, `gte 1200 count`) but the retrieved evidence was prose
 * with no extractable figure, so no row *could* be marked as contradicting.
 * "None is contradicted" was therefore vacuously true, and `evidenced` counted
 * those rows because it counts evidence of any polarity — so the headline
 * reported reassurance derived from the system's own inability to measure.
 *
 * That is the same failure shape M011 exists to prevent, one level subtler
 * than the one `coverage.ts` documents: not "absence of evidence read as
 * absence of concern", but *inability to evaluate* read as absence of concern.
 *
 * This reports `supported` and `inconclusiveOnly` — both already computed by
 * `deriveCoverageLedger`, and until now never read by anything — so the
 * distinction is visible in the one line that is hardest to skip. It
 * deliberately changes **wording only**: whether an all-inconclusive thesis
 * should still qualify as `holding` at all is a product calibration for the
 * user to decide, not a threshold to slip in here.
 *
 * Wording chosen by the user (2026-08-05) from four drafted options: state
 * what the pipeline *does* guarantee and what it does not, rather than
 * characterising the material itself. That choice is forced by what the code
 * can actually know. `rankSentenceCandidates` selects secondary candidates on
 * lexical overlap — two significant shared tokens, a score floor, one
 * qualifying token outside the ticker and bare years — so a market-wrap
 * sentence that merely mentions the issuer and carries any figure can qualify.
 * Nothing downstream ever checks topical relevance, and `no_observed_value`
 * cannot distinguish "off-topic" from "on-topic but unquantified". Copy
 * asserting the quotes are irrelevant would therefore overclaim exactly as
 * badly as the old copy did, in the opposite direction. What *is* guaranteed
 * is provenance: `CitationPipeline` verified the quote appears verbatim in the
 * cited document.
 */
function buildHoldingHeadline(coverage: CoverageLedger): string {
  const { supported, totalAssumptions, inconclusiveOnly, unevidenced } = coverage;
  const lead = `${supported} of ${totalAssumptions} assumption${totalAssumptions === 1 ? '' : 's'} `
    + `${supported === 1 ? 'is' : 'are'} supported`;

  const clauses: string[] = [];
  if (inconclusiveOnly > 0) {
    clauses.push(inconclusiveOnly === 1
      ? '1 has a quote verified verbatim from its source but never checked for relevance to the claim'
      : `${inconclusiveOnly} have quotes verified verbatim from their source but never checked for relevance to the claim`);
  }
  if (unevidenced > 0) {
    clauses.push(`${unevidenced} ${unevidenced === 1 ? 'has' : 'have'} nothing`);
  }

  /*
   * With nothing positively supported, "nothing is contradicted" is a
   * statement about what the system could not check, not about the thesis.
   * Say so in the same breath rather than letting it read as confirmation.
   */
  const tail = supported === 0
    ? 'Nothing is contradicted, but nothing is confirmed either.'
    : 'No assumption is contradicted by the evidence retrieved so far.';

  return clauses.length > 0
    ? `THESIS HOLDING — ${lead}. ${clauses.join('; ')}. ${tail}`
    : `THESIS HOLDING — ${lead}. ${tail}`;
}
