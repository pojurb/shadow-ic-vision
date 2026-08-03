import {
  THRESHOLD_OPERATORS,
  type MeasurementContract,
  type MeasurementTimeBasis,
  type MeasurementUnit,
} from '@/lib/domain/contracts';

/**
 * M011 — evidence polarity.
 *
 * Before this module, evidence carried topical relevance and nothing else: a
 * retrieved fact that *falsifies* an assumption looked identical to one that
 * supports it, so a thesis whose own exhibits disproved it still read as
 * intact. Polarity is the missing direction.
 *
 * Deliberately pure and total. It performs no I/O, imports nothing from the
 * persistence or pipeline layers, and has no throw path — every branch returns
 * a value. That matters because the alternative to a verdict here is not an
 * error the user sees; it is `inconclusive`, which is the honest answer
 * whenever the comparison genuinely cannot be made.
 */

export type EvidencePolarity = 'supports' | 'contradicts' | 'inconclusive';

/**
 * Why the classifier reached its answer. Persisted alongside the polarity
 * because "inconclusive" has six materially different causes, and a coverage
 * ledger that cannot tell "we have no contract" from "the fact was for the
 * wrong period" cannot tell the user anything useful about what to fix.
 */
export type PolarityMethod =
  /** A real numeric comparison against a threshold happened. */
  | 'numeric_threshold'
  /** A directional claim compared against a prior-period value. */
  | 'directional'
  /** No contract row, or one that predates M011. */
  | 'no_contract'
  /** A genuinely qualitative assumption. Nothing to compare. */
  | 'not_measurable'
  /** The contract is fine; this evidence asserts no machine-readable value. */
  | 'no_observed_value'
  /** The observed value is in a different unit than the claim. */
  | 'unit_mismatch'
  /** An instant (balance) fact offered for a duration (flow) claim, or vice versa. */
  | 'time_basis_mismatch'
  /**
   * A direction supplied by the optional `PolarityClassifier`, never by
   * arithmetic. Kept a distinct value so a model judgment is never mistaken for
   * a measured one — the verdict block only ever escalates to `breached` on
   * `numeric_threshold`.
   */
  | 'model_classified';

export type PolarityResult = {
  polarity: EvidencePolarity;
  /**
   * Always `observed - threshold`, so its sign is independent of the operator's
   * direction. Read `polarity` for the verdict and this only for magnitude —
   * a negative delta on an `lte` claim means the claim is comfortably *met*.
   */
  deltaVsThreshold: number | null;
  method: PolarityMethod;
};

/**
 * The machine-readable assertion an evidence row makes, if it makes one.
 * Written into `metadata` by structured-fact producers (XBRL retrieval,
 * deterministic calculation) and absent from every text-derived candidate.
 */
export type ObservedMeasurement = {
  observedValue?: unknown;
  observedUnit?: unknown;
  observedTimeBasis?: unknown;
  /** Prior-period comparand for directional claims. */
  priorValue?: unknown;
};

/** Relative tolerance for `eq`, so float representation never flips a verdict. */
const EQ_RELATIVE_TOLERANCE = 1e-9;

function inconclusive(method: PolarityMethod): PolarityResult {
  return { polarity: 'inconclusive', deltaVsThreshold: null, method };
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function satisfies(operator: MeasurementContract['operator'], delta: number, threshold: number): boolean {
  switch (operator) {
    case 'gte': return delta >= 0;
    case 'gt': return delta > 0;
    case 'lte': return delta <= 0;
    case 'lt': return delta < 0;
    case 'eq': return Math.abs(delta) <= Math.max(Math.abs(threshold), 1) * EQ_RELATIVE_TOLERANCE;
    default: return false;
  }
}

export function classifyPolarity(input: {
  contract: MeasurementContract | null;
  observed: ObservedMeasurement | null;
}): PolarityResult {
  const { contract, observed } = input;

  // 1. No contract at all, or one carried over from before M011. Both mean the
  //    claim was never made checkable, which is a gap the coverage ledger
  //    reports — not something to paper over with a guessed verdict.
  if (!contract || contract.resolution === 'legacy_unspecified' || contract.resolution === 'ambiguous') {
    return inconclusive('no_contract');
  }

  // 2. A qualitative assumption. There is no number, and inventing one would be
  //    the exact failure `not_measurable` exists to prevent.
  if (contract.resolution === 'not_measurable') return inconclusive('not_measurable');

  const observedValue = readNumber(observed?.observedValue);

  /*
   * 3. The evidence asserts no machine-readable value.
   *
   * Deliberately does NOT fall back to scraping a number out of the quote text.
   * `numbers()` in `extractors/candidate.ts` matches any digit run and has no
   * idea what it denotes — letting it drive a breach verdict is precisely how
   * a figure belonging to a different line item gets compared against a
   * threshold it has nothing to do with. Only a value that arrived through a
   * structured path (XBRL retrieval, deterministic calculation) is trusted to
   * assert a magnitude. Text-only evidence is honestly inconclusive rather than
   * dishonestly supportive.
   */
  if (observedValue === null) return inconclusive('no_observed_value');

  // 4. Comparing a percentage against a currency amount is not a near-miss,
  //    it is a category error.
  const observedUnit = observed?.observedUnit as MeasurementUnit | undefined;
  if (observedUnit && observedUnit !== contract.unit) return inconclusive('unit_mismatch');

  /*
   * 5. The balance-versus-flow gate, second layer.
   *
   * The XBRL fact source already refuses to return an instant fact for a
   * duration claim (`factSatisfiesTimeBasis`). This repeats the check at the
   * point of judgment so that any *other* producer of `observedValue` — a
   * future table parser, a hand-built candidate — inherits the same refusal
   * without having to remember it.
   */
  const observedTimeBasis = observed?.observedTimeBasis as MeasurementTimeBasis | undefined;
  if (observedTimeBasis && observedTimeBasis !== contract.timeBasis) return inconclusive('time_basis_mismatch');

  // 6. The threshold comparison. This is the branch that catches a thesis
  //    breached at its own baseline.
  if (THRESHOLD_OPERATORS.has(contract.operator) && contract.threshold !== null) {
    const deltaVsThreshold = observedValue - contract.threshold;
    return {
      polarity: satisfies(contract.operator, deltaVsThreshold, contract.threshold) ? 'supports' : 'contradicts',
      deltaVsThreshold,
      method: 'numeric_threshold',
    };
  }

  // 7. Directional claims. No absolute threshold exists, so the comparand is
  //    the prior period — which is how a margin *contraction* registers as
  //    contradicting a claim that margins expand.
  if (contract.operator === 'increases' || contract.operator === 'decreases') {
    const priorValue = readNumber(observed?.priorValue);
    if (priorValue === null) return inconclusive('no_observed_value');
    const change = observedValue - priorValue;
    const improved = contract.operator === 'increases' ? change > 0 : change < 0;
    return { polarity: improved ? 'supports' : 'contradicts', deltaVsThreshold: change, method: 'directional' };
  }

  // 8. A resolved contract with `operator: 'none'` — measurable in principle,
  //    but this claim states no comparison to make.
  return inconclusive('no_contract');
}

/**
 * Reads the observed measurement out of an evidence row's `metadata` bag.
 * Total: a malformed or absent bag yields `null`, which classifies as
 * `no_observed_value` rather than throwing inside a persistence transaction.
 */
export function readObservedMeasurement(metadata: unknown): ObservedMeasurement | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const bag = metadata as Record<string, unknown>;
  if (
    bag.observedValue === undefined
    && bag.observedUnit === undefined
    && bag.observedTimeBasis === undefined
    && bag.priorValue === undefined
  ) return null;
  return {
    observedValue: bag.observedValue,
    observedUnit: bag.observedUnit,
    observedTimeBasis: bag.observedTimeBasis,
    priorValue: bag.priorValue,
  };
}
