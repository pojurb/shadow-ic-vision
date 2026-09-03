import { describe, expect, it } from 'vitest';
import { contextKindOf, factSatisfiesTimeBasis, selectFact, type XbrlConceptResponse, type XbrlUnitFact } from '@/lib/research/adapters/sec-xbrl';
import { createXbrlFactCandidate, normalizeToContractUnit } from '@/lib/research/extractors/xbrl';
import { classifyPolarity, readObservedMeasurement } from '@/lib/research/polarity';
import type { MeasurementContract } from '@/lib/domain/contracts';

/** A balance: a stock measured at a point in time. Carries `end` only. */
const DEFERRED_REVENUE_BALANCE: XbrlUnitFact = {
  end: '2026-06-30', val: 4_050_000_000, form: '10-Q', filed: '2026-07-23', accn: '0000-26-1',
};

/** A flow: measured across a period. Carries both `start` and `end`. */
const QUARTER_FLOW: XbrlUnitFact = {
  start: '2026-04-01', end: '2026-06-30', val: 20_006_000_000, form: '10-Q', filed: '2026-07-23', accn: '0000-26-1',
};

describe('contextKindOf', () => {
  it('reads an end-only fact as an instant and a start+end fact as a duration', () => {
    expect(contextKindOf(DEFERRED_REVENUE_BALANCE)).toBe('instant');
    expect(contextKindOf(QUARTER_FLOW)).toBe('duration');
  });

  it('treats an empty start string as an instant rather than a zero-length duration', () => {
    expect(contextKindOf({ ...DEFERRED_REVENUE_BALANCE, start: '' })).toBe('instant');
  });
});

describe('factSatisfiesTimeBasis', () => {
  /**
   * The named regression test for the defect this gate exists to close: FSD
   * deferred revenue ($4.05B) is a balance, and it was surfaced as support for
   * an assumption about *recognized revenue* growth, which is a flow. This
   * assertion is the mechanical refusal.
   */
  it('refuses a balance-sheet instant for a duration claim', () => {
    expect(factSatisfiesTimeBasis(DEFERRED_REVENUE_BALANCE, 'duration_quarter')).toBe(false);
    expect(factSatisfiesTimeBasis(DEFERRED_REVENUE_BALANCE, 'duration_ytd')).toBe(false);
    expect(factSatisfiesTimeBasis(DEFERRED_REVENUE_BALANCE, 'duration_annual')).toBe(false);
  });

  it('refuses a duration flow for an instant claim, the same refusal in reverse', () => {
    expect(factSatisfiesTimeBasis(QUARTER_FLOW, 'instant')).toBe(false);
    expect(factSatisfiesTimeBasis(DEFERRED_REVENUE_BALANCE, 'instant')).toBe(true);
  });

  // Bands, not exact day counts: real quarters run 89-92 days and 52/53-week
  // fiscal years land either side of 365.
  it('accepts a real quarter and rejects periods either side of the band', () => {
    expect(factSatisfiesTimeBasis({ start: '2026-04-01', end: '2026-06-30', val: 1 }, 'duration_quarter')).toBe(true);
    expect(factSatisfiesTimeBasis({ start: '2026-01-01', end: '2026-03-31', val: 1 }, 'duration_quarter')).toBe(true);
    // 30 days — a month, not a quarter.
    expect(factSatisfiesTimeBasis({ start: '2026-06-01', end: '2026-06-30', val: 1 }, 'duration_quarter')).toBe(false);
    // ~182 days — a half year.
    expect(factSatisfiesTimeBasis({ start: '2026-01-01', end: '2026-06-30', val: 1 }, 'duration_quarter')).toBe(false);
  });

  it('accepts a fiscal year and a year-to-date period in their own bands', () => {
    expect(factSatisfiesTimeBasis({ start: '2025-07-01', end: '2026-06-30', val: 1 }, 'duration_annual')).toBe(true);
    expect(factSatisfiesTimeBasis({ start: '2026-01-01', end: '2026-06-30', val: 1 }, 'duration_ytd')).toBe(true);
    expect(factSatisfiesTimeBasis({ start: '2026-01-01', end: '2026-06-30', val: 1 }, 'duration_annual')).toBe(false);
  });

  /**
   * Trailing twelve months is not expressible in company-concept's period
   * model — no filer tags a rolling window. Failing closed makes that a named
   * coverage gap rather than a silently substituted annual figure, which means
   * something materially different.
   */
  it('matches nothing for a trailing-twelve-month or unspecified basis', () => {
    expect(factSatisfiesTimeBasis({ start: '2025-07-01', end: '2026-06-30', val: 1 }, 'duration_ttm')).toBe(false);
    expect(factSatisfiesTimeBasis(QUARTER_FLOW, 'unspecified')).toBe(false);
    expect(factSatisfiesTimeBasis(DEFERRED_REVENUE_BALANCE, 'unspecified')).toBe(false);
  });

  it('rejects unparseable or inverted periods rather than computing a nonsense duration', () => {
    expect(factSatisfiesTimeBasis({ start: 'not-a-date', end: '2026-06-30', val: 1 }, 'duration_quarter')).toBe(false);
    expect(factSatisfiesTimeBasis({ start: '2026-06-30', end: '2026-04-01', val: 1 }, 'duration_quarter')).toBe(false);
  });
});

describe('selectFact', () => {
  const response = (units: XbrlConceptResponse['units']): XbrlConceptResponse => ({
    cik: 1, taxonomy: 'us-gaap', tag: 'GrossProfit', units,
  });

  it('returns null when no fact survives the time-basis gate', () => {
    expect(selectFact(response({ USD: [DEFERRED_REVENUE_BALANCE] }), 'duration_quarter')).toBeNull();
  });

  it('prefers a periodic report over 8-K noise even when the 8-K is more recent', () => {
    const selected = selectFact(response({
      USD: [
        { start: '2026-04-01', end: '2026-06-30', val: 100, form: '10-Q', filed: '2026-07-23' },
        { start: '2026-07-01', end: '2026-09-30', val: 999, form: '8-K', filed: '2026-10-01' },
      ],
    }), 'duration_quarter');
    expect(selected?.fact.val).toBe(100);
  });

  it('takes the most recent period, then the most recent filing as a tiebreak', () => {
    const selected = selectFact(response({
      USD: [
        { start: '2026-01-01', end: '2026-03-31', val: 10, form: '10-Q', filed: '2026-05-05' },
        { start: '2026-04-01', end: '2026-06-30', val: 20, form: '10-Q', filed: '2026-07-23' },
        // A restatement of the same period, filed later — it should win.
        { start: '2026-04-01', end: '2026-06-30', val: 21, form: '10-Q', filed: '2026-08-14' },
      ],
    }), 'duration_quarter');
    expect(selected?.fact.val).toBe(21);
  });

  /*
   * `PREFERRED_FORMS` used to hold only `'10-Q'`/`'10-K'` and matched via
   * exact-string `.includes()`, so a real amendment (`10-Q/A`, `10-K/A`)
   * was silently dropped from the periodic pool whenever a base periodic
   * filing was also eligible for the same period — the opposite of what the
   * "restatement wins" comment above claims, since that test only ever used
   * two `10-Q` records, never an actual amendment form. This is the amendment
   * case the prior test's name promised but didn't cover.
   */
  it('prefers a real amendment over the base filing it corrects', () => {
    const selected = selectFact(response({
      USD: [
        { start: '2026-04-01', end: '2026-06-30', val: 20, form: '10-Q', filed: '2026-07-23' },
        { start: '2026-07-01', end: '2026-09-30', val: 999, form: '8-K', filed: '2026-10-01' },
        { start: '2026-04-01', end: '2026-06-30', val: 21, form: '10-Q/A', filed: '2026-08-14' },
      ],
    }), 'duration_quarter');
    expect(selected?.fact.val).toBe(21);
  });

  it('ignores facts whose value is not a finite number', () => {
    const selected = selectFact(response({
      USD: [
        { start: '2026-04-01', end: '2026-06-30', val: NaN as number, form: '10-Q', filed: '2026-08-01' },
        { start: '2026-01-01', end: '2026-03-31', val: 10, form: '10-Q', filed: '2026-05-05' },
      ],
    }), 'duration_quarter');
    expect(selected?.fact.val).toBe(10);
  });
});

describe('normalizeToContractUnit', () => {
  // XBRL reports ratios as decimals in the "pure" unit; a thesis states them as
  // percentages. Getting this direction wrong would move every verdict by two
  // orders of magnitude.
  it('converts a pure decimal into a percentage', () => {
    expect(normalizeToContractUnit(0.169, 'pure', 'percent')).toBeCloseTo(16.9, 10);
    expect(normalizeToContractUnit(0.169, 'pure', 'ratio')).toBeCloseTo(0.169, 10);
  });

  it('passes currency through only when the currencies match', () => {
    expect(normalizeToContractUnit(20_006_000_000, 'USD', 'usd')).toBe(20_006_000_000);
    expect(normalizeToContractUnit(20_006_000_000, 'IDR', 'usd')).toBeNull();
  });

  it('returns null for incommensurable units rather than a plausible wrong number', () => {
    expect(normalizeToContractUnit(20_006_000_000, 'USD', 'percent')).toBeNull();
    expect(normalizeToContractUnit(0.169, 'pure', 'usd')).toBeNull();
  });
});

describe('createXbrlFactCandidate', () => {
  const contract: MeasurementContract = {
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

  it('produces a derived candidate carrying full provenance and a comparable value', () => {
    const candidate = createXbrlFactCandidate({
      tag: 'GrossProfit',
      unit: 'pure',
      fact: { start: '2026-04-01', end: '2026-06-30', val: 0.169, form: '10-Q', filed: '2026-07-23', accn: '0000-26-1' },
      contract,
    });
    // `derived`, never a new trust class: it inherits the existing ceiling that
    // keeps a structured value from ever reading as exact source prose.
    expect(candidate.verificationStatus).toBe('derived');
    expect(candidate.metadata).toMatchObject({
      method: 'sec_company_concept',
      observedValue: 16.900000000000002,
      observedUnit: 'percent',
      observedTimeBasis: 'duration_quarter',
    });
    expect(candidate.metadata?.inputs).toMatchObject({ contextKind: 'duration', accn: '0000-26-1', form: '10-Q' });

    // The whole point: this candidate can produce a real verdict, and the
    // audit's headline case comes out as a breach.
    const result = classifyPolarity({ contract, observed: readObservedMeasurement(candidate.metadata) });
    expect(result.polarity).toBe('contradicts');
    expect(result.deltaVsThreshold).toBeCloseTo(-3.1, 10);
  });

  it('omits the observed value entirely when the unit is incommensurable', () => {
    const candidate = createXbrlFactCandidate({
      tag: 'GrossProfit', unit: 'USD', fact: QUARTER_FLOW, contract,
    });
    expect(candidate.metadata?.observedValue).toBeUndefined();
    expect(candidate.impactSummary).toContain('not commensurable');
    // And so it stays honestly inconclusive rather than comparing a dollar
    // amount against a percentage threshold.
    expect(classifyPolarity({ contract, observed: readObservedMeasurement(candidate.metadata) }))
      .toMatchObject({ polarity: 'inconclusive', method: 'no_observed_value' });
  });

  it('records the context kind in the quote and impact summary so it is visible to a reader', () => {
    const candidate = createXbrlFactCandidate({
      tag: 'DeferredRevenueCurrent', unit: 'USD', fact: DEFERRED_REVENUE_BALANCE,
      contract: { ...contract, unit: 'usd', timeBasis: 'instant' },
    });
    expect(candidate.quote).toContain('as of 2026-06-30');
    expect(candidate.impactSummary).toContain('instant');
  });
});
