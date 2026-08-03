import { describe, expect, it, vi } from 'vitest';
import { LEGACY_MEASUREMENT_CONTRACT, type MeasurementContract } from '@/lib/domain/contracts';
import { classifyPolarity, readObservedMeasurement } from '@/lib/research/polarity';
import { resolvePolarity, resolvePolarityClassifier } from '@/lib/research/polarity-classifier';
import { getResearchSourceMode } from '@/lib/research/config';

/**
 * The contract from the audit that produced this milestone: "TSLA automotive
 * gross margin will remain above 20% through 2026."
 */
const ABOVE_20: MeasurementContract = {
  resolution: 'resolved',
  metric: 'automotive gross margin',
  definitionVariant: 'automotive segment, GAAP',
  operator: 'gte',
  threshold: 20,
  unit: 'percent',
  timeBasis: 'duration_quarter',
  sourceTags: ['GrossProfit'],
  clarifyingQuestion: null,
  ambiguityReason: 'none',
};

const observed = (observedValue: number, extra: Record<string, unknown> = {}) => ({
  observedValue, observedUnit: 'percent', observedTimeBasis: 'duration_quarter', ...extra,
});

describe('classifyPolarity — threshold comparison', () => {
  /**
   * The headline case. Before M011 this fact was retrieved, presented as the
   * fourth of five neutral bullets, and the thesis still read as intact.
   */
  it('marks a breached threshold as contradicting, with the signed delta', () => {
    const result = classifyPolarity({ contract: ABOVE_20, observed: observed(16.9) });
    expect(result.polarity).toBe('contradicts');
    expect(result.deltaVsThreshold).toBeCloseTo(-3.1, 10);
    expect(result.method).toBe('numeric_threshold');
  });

  it('marks a satisfied threshold as supporting', () => {
    const result = classifyPolarity({ contract: ABOVE_20, observed: observed(21.4) });
    expect(result).toMatchObject({ polarity: 'supports', method: 'numeric_threshold' });
    expect(result.deltaVsThreshold).toBeCloseTo(1.4, 10);
  });

  // The boundary is exactly where an off-by-one would hide, and `gte` versus
  // `gt` is the difference between "above 20%" and "at least 20%".
  it('treats a value exactly at the threshold as supporting under gte and contradicting under gt', () => {
    expect(classifyPolarity({ contract: ABOVE_20, observed: observed(20) }).polarity).toBe('supports');
    expect(classifyPolarity({ contract: { ...ABOVE_20, operator: 'gt' }, observed: observed(20) }).polarity).toBe('contradicts');
  });

  it('handles the lte and lt directions with the same observed-minus-threshold sign convention', () => {
    const costCap: MeasurementContract = { ...ABOVE_20, metric: 'cost ratio', operator: 'lte', threshold: 30 };
    const met = classifyPolarity({ contract: costCap, observed: observed(28) });
    // A negative delta means the claim is comfortably MET here — which is why
    // the delta must never be read as a verdict on its own.
    expect(met.polarity).toBe('supports');
    expect(met.deltaVsThreshold).toBeCloseTo(-2, 10);
    expect(classifyPolarity({ contract: costCap, observed: observed(31) }).polarity).toBe('contradicts');
    expect(classifyPolarity({ contract: { ...costCap, operator: 'lt' }, observed: observed(30) }).polarity).toBe('contradicts');
  });

  it('tolerates float representation error on eq rather than flipping the verdict', () => {
    const exact: MeasurementContract = { ...ABOVE_20, operator: 'eq', threshold: 0.3 };
    expect(classifyPolarity({ contract: exact, observed: observed(0.1 + 0.2) }).polarity).toBe('supports');
    expect(classifyPolarity({ contract: exact, observed: observed(0.31) }).polarity).toBe('contradicts');
  });
});

describe('classifyPolarity — directional claims', () => {
  const expands: MeasurementContract = {
    ...ABOVE_20, metric: 'energy storage gross margin', operator: 'increases', threshold: null,
  };

  /**
   * The second defect from the audit: energy-storage margin contracted from
   * 30.3% to 20.4%, which falsifies "margins expand as production scales" —
   * and was presented as neutral context.
   */
  it('marks a contraction as contradicting a claim that the metric increases', () => {
    const result = classifyPolarity({ contract: expands, observed: observed(20.4, { priorValue: 30.3 }) });
    expect(result.polarity).toBe('contradicts');
    expect(result.deltaVsThreshold).toBeCloseTo(-9.9, 10);
    expect(result.method).toBe('directional');
  });

  it('marks growth as supporting a claim that the metric increases', () => {
    expect(classifyPolarity({ contract: expands, observed: observed(31.1, { priorValue: 30.3 }) }).polarity).toBe('supports');
  });

  it('inverts correctly for a decreases claim', () => {
    const shrinks: MeasurementContract = { ...expands, operator: 'decreases' };
    expect(classifyPolarity({ contract: shrinks, observed: observed(20.4, { priorValue: 30.3 }) }).polarity).toBe('supports');
    expect(classifyPolarity({ contract: shrinks, observed: observed(31.1, { priorValue: 30.3 }) }).polarity).toBe('contradicts');
  });

  it('is inconclusive when a directional claim has no prior-period comparand', () => {
    expect(classifyPolarity({ contract: expands, observed: observed(20.4) }))
      .toMatchObject({ polarity: 'inconclusive', method: 'no_observed_value' });
  });
});

describe('classifyPolarity — the refusals', () => {
  it('is inconclusive with no contract at all', () => {
    expect(classifyPolarity({ contract: null, observed: observed(16.9) }))
      .toMatchObject({ polarity: 'inconclusive', deltaVsThreshold: null, method: 'no_contract' });
  });

  it('is inconclusive for a legacy or still-ambiguous contract', () => {
    expect(classifyPolarity({ contract: LEGACY_MEASUREMENT_CONTRACT, observed: observed(16.9) }).method).toBe('no_contract');
    const ambiguous: MeasurementContract = {
      ...LEGACY_MEASUREMENT_CONTRACT,
      resolution: 'ambiguous', clarifyingQuestion: 'which margin?', ambiguityReason: 'definition_variant_ambiguous',
    };
    expect(classifyPolarity({ contract: ambiguous, observed: observed(16.9) }).method).toBe('no_contract');
  });

  it('is inconclusive for a genuinely qualitative assumption', () => {
    const qualitative: MeasurementContract = {
      ...LEGACY_MEASUREMENT_CONTRACT, resolution: 'not_measurable', metric: 'management commitment',
    };
    expect(classifyPolarity({ contract: qualitative, observed: observed(16.9) }).method).toBe('not_measurable');
  });

  /**
   * The anti-regex-scrape guard, and the most important refusal in this file.
   *
   * `numbers()` in the candidate extractor matches any digit run with no idea
   * what it denotes. If polarity fell back to scraping the quote, a figure
   * belonging to an entirely different line item would be compared against
   * this threshold and could manufacture a breach — or, worse, a false
   * "supports". Text-only evidence is honestly inconclusive instead.
   */
  it('refuses to parse a number out of quote text when no structured value exists', () => {
    const result = classifyPolarity({ contract: ABOVE_20, observed: null });
    expect(result).toMatchObject({ polarity: 'inconclusive', deltaVsThreshold: null, method: 'no_observed_value' });
  });

  it('is inconclusive when the observed unit differs from the claim unit', () => {
    // Comparing a currency amount against a percentage threshold is a category
    // error, not a near miss.
    expect(classifyPolarity({ contract: ABOVE_20, observed: observed(16.9, { observedUnit: 'usd' }) }))
      .toMatchObject({ polarity: 'inconclusive', method: 'unit_mismatch' });
  });

  /**
   * The third defect from the audit: FSD *deferred revenue* — a balance-sheet
   * instant — was surfaced as support for an assumption about *recognized
   * revenue* growth, a duration flow. This is the judgment-time layer of that
   * refusal; the XBRL fact source refuses it earlier too.
   */
  it('refuses an instant balance offered against a duration flow claim', () => {
    expect(classifyPolarity({ contract: ABOVE_20, observed: observed(4050, { observedTimeBasis: 'instant' }) }))
      .toMatchObject({ polarity: 'inconclusive', method: 'time_basis_mismatch' });
  });

  it('is inconclusive for a resolved contract that states no comparison', () => {
    const noComparison: MeasurementContract = {
      ...ABOVE_20, operator: 'none', threshold: null, unit: 'percent',
    };
    expect(classifyPolarity({ contract: noComparison, observed: observed(16.9) }).method).toBe('no_contract');
  });

  it('never throws on malformed observed values', () => {
    for (const bad of [NaN, Infinity, '16.9', null, undefined, {}]) {
      expect(classifyPolarity({ contract: ABOVE_20, observed: { observedValue: bad } }).polarity).toBe('inconclusive');
    }
  });
});

describe('readObservedMeasurement', () => {
  it('returns null for metadata that asserts no measurement', () => {
    expect(readObservedMeasurement(null)).toBeNull();
    expect(readObservedMeasurement('not an object')).toBeNull();
    // The R-018 flag rides in this same bag and must not be mistaken for one.
    expect(readObservedMeasurement({ untrustedInstructionFlagged: false })).toBeNull();
  });

  it('extracts a measurement when one is present', () => {
    expect(readObservedMeasurement({ observedValue: 16.9, observedUnit: 'percent', untrustedInstructionFlagged: false }))
      .toMatchObject({ observedValue: 16.9, observedUnit: 'percent' });
  });
});

describe('resolvePolarity — the optional classifier seam', () => {
  const qualitative: MeasurementContract = {
    ...LEGACY_MEASUREMENT_CONTRACT,
    resolution: 'not_measurable',
    metric: 'regulatory approval timeline',
  };
  const base = { assumption: 'Regulatory costs do not materially delay monetization.', quote: 'The agency extended its review by two years.' };

  /**
   * The suite runs with `RESEARCH_SOURCE_MODE=mock` (forced by
   * `vitest.config.ts`), where the gate drops every classifier — which would
   * make each assertion below pass vacuously. These cases are about what the
   * seam does once it is genuinely reachable, so they run under live mode.
   */
  async function inLiveMode<T>(body: () => Promise<T>): Promise<T> {
    const previous = process.env.RESEARCH_SOURCE_MODE;
    process.env.RESEARCH_SOURCE_MODE = 'live';
    try {
      return await body();
    } finally {
      process.env.RESEARCH_SOURCE_MODE = previous;
    }
  }

  it('returns the deterministic answer untouched when no classifier is configured', async () => {
    const result = await inLiveMode(() => resolvePolarity({ contract: qualitative, observed: null, ...base }));
    expect(result).toMatchObject({ polarity: 'inconclusive', method: 'not_measurable' });
  });

  it('never consults the classifier once arithmetic has already answered', async () => {
    // A measured breach is a fact. A model opinion could only degrade it.
    const spy = vi.fn();
    const result = await inLiveMode(() => resolvePolarity({
      contract: ABOVE_20, observed: observed(16.9), ...base, classifier: spy,
    }));
    expect(result.method).toBe('numeric_threshold');
    expect(spy).not.toHaveBeenCalled();
  });

  it('never consults the classifier on a structural refusal', async () => {
    // Letting a model talk the system out of the balance-versus-flow refusal
    // would reopen the exact defect that gate closes.
    const spy = vi.fn();
    await inLiveMode(async () => {
      await resolvePolarity({
        contract: ABOVE_20, observed: observed(4050, { observedTimeBasis: 'instant' }), ...base, classifier: spy,
      });
      await resolvePolarity({
        contract: ABOVE_20, observed: observed(16.9, { observedUnit: 'usd' }), ...base, classifier: spy,
      });
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('consults the classifier for a qualitative claim and records the answer as model_classified', async () => {
    const classifier = vi.fn().mockResolvedValue({ polarity: 'contradicts' });
    const result = await inLiveMode(() => resolvePolarity({ contract: qualitative, observed: null, ...base, classifier }));
    expect(classifier).toHaveBeenCalledOnce();
    // A model judgment carries no magnitude, and must stay distinguishable
    // from a measured one — the verdict only escalates on numeric_threshold.
    expect(result).toMatchObject({ polarity: 'contradicts', deltaVsThreshold: null, method: 'model_classified' });
  });

  it('keeps the deterministic answer when the classifier declines to judge', async () => {
    const classifier = vi.fn().mockResolvedValue({ polarity: 'inconclusive' });
    const result = await inLiveMode(() => resolvePolarity({ contract: qualitative, observed: null, ...base, classifier }));
    expect(result.method).toBe('not_measurable');
  });

  // The whole point of the gate: the same call that consults a classifier in
  // live mode must not make one in mock mode.
  it('does not consult the classifier at all while research is in mock mode', async () => {
    expect(getResearchSourceMode()).toBe('mock');
    const classifier = vi.fn().mockResolvedValue({ polarity: 'contradicts' });
    const result = await resolvePolarity({ contract: qualitative, observed: null, ...base, classifier });
    expect(classifier).not.toHaveBeenCalled();
    expect(result.method).toBe('not_measurable');
  });
});

describe('resolvePolarityClassifier — the source-mode gate', () => {
  /**
   * This is the test the 2026-07-29 default-wiring of `InstructionClassifier`
   * did not have, and whose absence is why that change was reverted: without
   * the `getResearchSourceMode()` gate, deterministic mock research would make
   * live provider calls wherever `LLM_PROVIDER_TYPE=ollama` is configured.
   * `vitest.config.ts` forces `RESEARCH_SOURCE_MODE=mock`, so this asserts the
   * gate under exactly the conditions the whole test suite runs in.
   */
  it('drops a configured classifier entirely while research is in mock mode', () => {
    expect(getResearchSourceMode()).toBe('mock');
    const classifier = vi.fn();
    expect(resolvePolarityClassifier(classifier)).toBeUndefined();
  });

  it('passes the classifier through when research is live', () => {
    const previous = process.env.RESEARCH_SOURCE_MODE;
    process.env.RESEARCH_SOURCE_MODE = 'live';
    try {
      const classifier = vi.fn();
      expect(resolvePolarityClassifier(classifier)).toBe(classifier);
    } finally {
      process.env.RESEARCH_SOURCE_MODE = previous;
    }
  });

  it('is a no-op when nothing was configured, which is the default', () => {
    expect(resolvePolarityClassifier(undefined)).toBeUndefined();
  });
});
