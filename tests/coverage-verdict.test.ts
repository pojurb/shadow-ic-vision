import { describe, expect, it } from 'vitest';
import { LEGACY_MEASUREMENT_CONTRACT, type MeasurementContract } from '@/lib/domain/contracts';
import { deriveCoverageLedger, MIN_COVERAGE_RATIO, type CoverageAssumptionInput } from '@/lib/research/coverage';
import { deriveThesisVerdict, formatDelta, type VerdictAssumptionInput } from '@/lib/research/verdict';

const THRESHOLD_CONTRACT: MeasurementContract = {
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

const DIRECTIONAL_CONTRACT: MeasurementContract = {
  ...THRESHOLD_CONTRACT, metric: 'energy storage margin', operator: 'increases', threshold: null,
};

function assumption(overrides: Partial<CoverageAssumptionInput> = {}): CoverageAssumptionInput {
  return {
    assumptionId: 'a1',
    statement: 'Automotive gross margin stays above 20%.',
    market: 'US',
    contract: THRESHOLD_CONTRACT,
    jobStatus: 'succeeded',
    polarities: ['supports'],
    ...overrides,
  };
}

describe('deriveCoverageLedger', () => {
  /**
   * The audit's third finding, as a test: ten assumptions, five evidence items,
   * four assumptions with nothing at all, and no report of the gap anywhere.
   */
  it('reports the gap when most assumptions have no evidence', () => {
    const assumptions = Array.from({ length: 10 }, (_, index) => assumption({
      assumptionId: `a${index}`,
      statement: `Assumption ${index}.`,
      polarities: index < 4 ? ['supports'] : [],
    }));
    const ledger = deriveCoverageLedger(assumptions);
    expect(ledger).toMatchObject({
      totalAssumptions: 10, evidenced: 4, unevidenced: 6, coverageRatio: 0.4, confidenceGate: 'suppressed',
    });
    expect(ledger.suppressionReasons).toEqual(['low_coverage']);
    expect(ledger.unevidencedAssumptions).toHaveLength(6);
    // Named, not merely counted — a count alone tells the user nothing about
    // which part of their thesis is unsupported.
    expect(ledger.unevidencedAssumptions[0].statement).toBe('Assumption 4.');
  });

  it('opens the gate once coverage clears the threshold and every contract is resolved', () => {
    const assumptions = Array.from({ length: 10 }, (_, index) => assumption({
      assumptionId: `a${index}`, polarities: index < 7 ? ['supports'] : [],
    }));
    const ledger = deriveCoverageLedger(assumptions);
    expect(ledger.coverageRatio).toBeCloseTo(MIN_COVERAGE_RATIO, 10);
    expect(ledger.confidenceGate).toBe('open');
  });

  /**
   * A thesis whose claims cannot be measured as stated is not one the system
   * can check, regardless of how much evidence it retrieved. Every pre-M011
   * thesis lands here after the 0008 backfill, and saying so is the point.
   */
  it('suppresses on unresolved contracts even at full coverage', () => {
    const ledger = deriveCoverageLedger([
      assumption({ assumptionId: 'a1' }),
      assumption({ assumptionId: 'a2', contract: LEGACY_MEASUREMENT_CONTRACT }),
    ]);
    expect(ledger).toMatchObject({ evidenced: 2, coverageRatio: 1, unresolvedContracts: 1, confidenceGate: 'suppressed' });
    expect(ledger.suppressionReasons).toEqual(['unresolved_contracts']);
  });

  it('does not count a qualitative contract as unresolved', () => {
    // `not_measurable` is a settled answer, not an open question.
    const qualitative: MeasurementContract = { ...LEGACY_MEASUREMENT_CONTRACT, resolution: 'not_measurable', metric: 'commitment' };
    expect(deriveCoverageLedger([assumption({ contract: qualitative })]).unresolvedContracts).toBe(0);
  });

  it('counts a contradicted assumption independently of a supported one', () => {
    const ledger = deriveCoverageLedger([
      assumption({ assumptionId: 'a1', polarities: ['supports'] }),
      assumption({ assumptionId: 'a2', polarities: ['supports', 'contradicts'] }),
      assumption({ assumptionId: 'a3', polarities: ['inconclusive', 'inconclusive'] }),
    ]);
    // A contradiction outweighs co-occurring support: an assumption with both
    // is contradicted, not supported.
    expect(ledger).toMatchObject({ supported: 1, contradicted: 1, inconclusiveOnly: 1, evidenced: 3 });
  });

  describe('unevidenced reasons', () => {
    const reasonFor = (input: Partial<CoverageAssumptionInput>) =>
      deriveCoverageLedger([assumption({ polarities: [], ...input })]).unevidencedAssumptions[0].reason;

    it('distinguishes work still running from work that failed', () => {
      expect(reasonFor({ jobStatus: 'queued' })).toBe('job_pending');
      expect(reasonFor({ jobStatus: 'running' })).toBe('job_pending');
      expect(reasonFor({ jobStatus: 'failed' })).toBe('job_failed');
    });

    it('reports a retrieval that found nothing usable', () => {
      expect(reasonFor({ jobStatus: 'succeeded' })).toBe('no_candidate_passed_gate');
      expect(reasonFor({ jobStatus: 'degraded' })).toBe('no_candidate_passed_gate');
    });

    /**
     * The ID market publishes no XBRL company-concept equivalent, so a claim
     * naming XBRL tags was never answerable there. Naming that specifically is
     * the difference between a gap the user can act on and one that reads as a
     * malfunction.
     */
    it('names a market with no structured source as its own reason', () => {
      expect(reasonFor({ market: 'ID' })).toBe('no_source_for_market');
      // Only when the claim actually wanted structured facts.
      expect(reasonFor({ market: 'ID', contract: { ...THRESHOLD_CONTRACT, sourceTags: [] } })).toBe('no_candidate_passed_gate');
    });
  });

  it('handles a thesis with no assumptions without dividing by zero', () => {
    expect(deriveCoverageLedger([])).toMatchObject({ coverageRatio: 0, confidenceGate: 'suppressed', totalAssumptions: 0 });
  });
});

describe('deriveThesisVerdict', () => {
  const openCoverage = deriveCoverageLedger([assumption()]);

  function verdictInput(overrides: Partial<VerdictAssumptionInput> = {}): VerdictAssumptionInput {
    return {
      assumptionId: 'a1',
      statement: 'Automotive gross margin stays above 20%.',
      contract: THRESHOLD_CONTRACT,
      evidence: [],
      ...overrides,
    };
  }

  const contradictingFact = (observedValue: number, deltaVsThreshold: number, id = 'e1') => ({
    id, polarity: 'contradicts' as const, deltaVsThreshold, observedValue,
    sourceName: 'SEC Form 10-Q', sourceUrl: 'https://sec.gov/example',
  });

  /**
   * The headline case, end to end. Automotive gross margin of 16.9% against a
   * thesis requiring at least 20% — retrieved, presented neutrally, and buried.
   * This verdict cannot be buried because no model produces it.
   */
  it('reports a breach with the metric, both numbers, and the gap in basis points', () => {
    const verdict = deriveThesisVerdict({
      coverage: openCoverage,
      assumptions: [verdictInput({ evidence: [contradictingFact(16.9, -3.1)] })],
    });
    expect(verdict.level).toBe('breached');
    expect(verdict.headline).toContain('THESIS BREACHED');
    expect(verdict.headline).toContain('automotive gross margin is 16.9%');
    expect(verdict.headline).toContain('at least 20%');
    expect(verdict.headline).toContain('310bps below');
    expect(verdict.contradictions).toHaveLength(1);
    expect(verdict.contradictions[0]).toMatchObject({ observedValue: 16.9, threshold: 20, sourceName: 'SEC Form 10-Q' });
  });

  it('breaches regardless of coverage — a proven breach is not softened by a thin ledger', () => {
    const suppressed = deriveCoverageLedger([assumption({ polarities: [] }), assumption({ assumptionId: 'a2', polarities: [] })]);
    expect(suppressed.confidenceGate).toBe('suppressed');
    const verdict = deriveThesisVerdict({
      coverage: suppressed,
      assumptions: [verdictInput({ evidence: [contradictingFact(16.9, -3.1)] })],
    });
    expect(verdict.level).toBe('breached');
  });

  it('leads with the largest breach when several assumptions are broken', () => {
    const verdict = deriveThesisVerdict({
      coverage: openCoverage,
      assumptions: [
        verdictInput({ assumptionId: 'a1', evidence: [contradictingFact(19.5, -0.5, 'e1')] }),
        verdictInput({ assumptionId: 'a2', statement: 'Bigger miss.', evidence: [contradictingFact(12, -8, 'e2')] }),
      ],
    });
    expect(verdict.contradictions.map((c) => c.evidenceId)).toEqual(['e2', 'e1']);
    expect(verdict.headline).toContain('2 assumptions are breached in total');
  });

  /**
   * A directional or model-classified contradiction is real but has no absolute
   * bar to report a distance from. It escalates the level and is counted —
   * never dressed up with a number it does not have.
   */
  it('reports a contradiction with no threshold as at_risk, without inventing a delta', () => {
    const verdict = deriveThesisVerdict({
      coverage: openCoverage,
      assumptions: [verdictInput({
        contract: DIRECTIONAL_CONTRACT,
        evidence: [{ id: 'e1', polarity: 'contradicts', deltaVsThreshold: -9.9, observedValue: 20.4, sourceName: 's', sourceUrl: 'u' }],
      })],
    });
    expect(verdict.level).toBe('at_risk');
    expect(verdict.contradictions).toHaveLength(0);
    expect(verdict.softContradictionCount).toBe(1);
    expect(verdict.headline).toContain('THESIS AT RISK');
  });

  it('does not quantify a threshold breach whose evidence carries no observed value', () => {
    const verdict = deriveThesisVerdict({
      coverage: openCoverage,
      assumptions: [verdictInput({
        evidence: [{ id: 'e1', polarity: 'contradicts', deltaVsThreshold: null, observedValue: null, sourceName: 's', sourceUrl: 'u' }],
      })],
    });
    expect(verdict.level).toBe('at_risk');
    expect(verdict.softContradictionCount).toBe(1);
  });

  it('reports insufficient evidence when nothing is contradicted but the gate is suppressed', () => {
    const suppressed = deriveCoverageLedger([assumption({ polarities: [] }), assumption({ assumptionId: 'a2', polarities: ['supports'] })]);
    const verdict = deriveThesisVerdict({ coverage: suppressed, assumptions: [verdictInput()] });
    expect(verdict.level).toBe('insufficient_evidence');
    expect(verdict.headline).toContain('No conclusion about this thesis is supported yet');
  });

  it('reports holding only when coverage is open and nothing is contradicted', () => {
    const verdict = deriveThesisVerdict({
      coverage: openCoverage,
      assumptions: [verdictInput({
        evidence: [{ id: 'e1', polarity: 'supports', deltaVsThreshold: 1.4, observedValue: 21.4, sourceName: 's', sourceUrl: 'u' }],
      })],
    });
    expect(verdict.level).toBe('holding');
    expect(verdict.headline).toContain('THESIS HOLDING');
    expect(verdict.headline).toContain('1 of 1 assumption is supported');
    expect(verdict.headline).toContain('No assumption is contradicted');
  });

  /*
   * Regression for the real TLKM thesis (2026-08-05, strengthened 2026-08-06):
   * every evidence row was `inconclusive` with
   * `polarityMethod = no_observed_value`, so nothing could be marked
   * contradicting and the headline read as a confirmation when in fact zero
   * assumptions were supported and the system had simply been unable to
   * evaluate any of them.
   *
   * `DEC-0018`: the level itself — not only the wording — now refuses the
   * positive state here. Absence of contradiction is not evidence of support,
   * so a thesis with `supported = 0` is `insufficient_evidence` no matter how
   * many quotes it carries. Note the confidence gate is **open** (coverage is
   * 2/2), so this reaches that level by a path where `suppressionReasons` is
   * empty — the branch `buildHeadline` previously had no sentence for.
   */
  it('refuses the positive state for an all-inconclusive thesis, even with an open gate', () => {
    const allInconclusive = deriveCoverageLedger([
      assumption({ polarities: ['inconclusive'] }),
      assumption({ assumptionId: 'a2', polarities: ['inconclusive'] }),
    ]);
    expect(allInconclusive.supported).toBe(0);
    expect(allInconclusive.confidenceGate).toBe('open');
    expect(allInconclusive.suppressionReasons).toEqual([]);

    const verdict = deriveThesisVerdict({
      coverage: allInconclusive,
      assumptions: [verdictInput({
        evidence: [{ id: 'e1', polarity: 'inconclusive', deltaVsThreshold: null, observedValue: null, sourceName: 's', sourceUrl: 'u' }],
      })],
    });

    expect(verdict.level).toBe('insufficient_evidence');
    expect(verdict.headline).toContain('INSUFFICIENT EVIDENCE');
    expect(verdict.headline).toContain('no assumption is supported by evidence');
    expect(verdict.headline).toContain('2 have quotes verified verbatim from their source but never checked for relevance to the claim');
    // The sentence must be well-formed, not the empty-reasons artefact.
    expect(verdict.headline).not.toContain('— .');
    expect(verdict.headline).not.toContain('HOLDING');
    // The phrase that made the old wording misleading must not stand alone.
    expect(verdict.headline).not.toContain('are evidenced');
    /*
     * The copy must not swing to the opposite overclaim either: the pipeline
     * cannot tell an off-topic quote from an on-topic one with no extractable
     * figure, so it may not assert the material is irrelevant.
     */
    expect(verdict.headline).not.toMatch(/irrelevant|unrelated|off-topic/i);
  });

  it('names its own rule so a rendered verdict is traceable to the version that produced it', () => {
    expect(deriveThesisVerdict({ coverage: openCoverage, assumptions: [] }).rule).toBe('M011-deterministic-verdict-v1');
  });
});

describe('formatDelta', () => {
  // 3.1 percentage points is 310 basis points, which is how a PM reads it.
  it('renders a percentage gap in basis points with an explicit direction', () => {
    expect(formatDelta(-3.1, 'percent')).toBe('310bps below');
    expect(formatDelta(1.4, 'percent')).toBe('140bps above');
  });

  it('renders a currency gap in its own unit', () => {
    expect(formatDelta(-2_500, 'usd')).toBe('$2,500 below');
  });
});
