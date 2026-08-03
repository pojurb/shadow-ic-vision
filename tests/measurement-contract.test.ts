import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  chatResponsePayloadSchema,
  draftClarificationBlock,
  LEGACY_MEASUREMENT_CONTRACT,
  measurementContractSchema,
  thesisDraftSchema,
  type MeasurementContract,
} from '@/lib/domain/contracts';

const RESOLVED: MeasurementContract = {
  resolution: 'resolved',
  metric: 'automotive gross margin',
  definitionVariant: 'automotive segment, GAAP, excluding regulatory credits',
  operator: 'gte',
  threshold: 20,
  unit: 'percent',
  timeBasis: 'duration_quarter',
  sourceTags: ['GrossProfit'],
  clarifyingQuestion: null,
  ambiguityReason: 'none',
};

function draftWith(measurement: MeasurementContract) {
  return {
    ticker: 'TSLA',
    companyName: 'Tesla, Inc.',
    market: 'US' as const,
    coreBelief: 'Automotive gross margin stays above 20% through 2026.',
    assumptions: [{ statement: 'Automotive gross margin stays above 20%.', status: 'untested' as const, measurement }],
  };
}

describe('M011 measurement contract schema', () => {
  it('accepts a fully resolved threshold contract', () => {
    expect(measurementContractSchema.safeParse(RESOLVED).success).toBe(true);
  });

  // Each of these is a way a claim could look measured while remaining
  // unfalsifiable — the failure the whole milestone exists to prevent.
  it('rejects a resolved contract whose threshold operator has no threshold', () => {
    const result = measurementContractSchema.safeParse({ ...RESOLVED, threshold: null });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('threshold operator requires a threshold');
  });

  it('rejects a resolved contract with an unspecified time basis', () => {
    // The balance-sheet/P&L conflation starts here: without a fixed time basis
    // nothing downstream can tell a stock from a flow.
    const result = measurementContractSchema.safeParse({ ...RESOLVED, timeBasis: 'unspecified' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('must fix a time basis');
  });

  it('rejects a resolved contract with an unspecified unit on a threshold claim', () => {
    const result = measurementContractSchema.safeParse({ ...RESOLVED, unit: 'unspecified' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('threshold requires a unit');
  });

  it('rejects a resolved contract that still carries a clarifying question or ambiguity reason', () => {
    expect(measurementContractSchema.safeParse({ ...RESOLVED, clarifyingQuestion: 'which margin?' }).success).toBe(false);
    expect(measurementContractSchema.safeParse({ ...RESOLVED, ambiguityReason: 'unit_ambiguous' }).success).toBe(false);
  });

  it('rejects an ambiguous contract that supplies no question or no reason', () => {
    const base = { ...RESOLVED, resolution: 'ambiguous' as const };
    expect(measurementContractSchema.safeParse({ ...base, clarifyingQuestion: null, ambiguityReason: 'unit_ambiguous' }).success).toBe(false);
    expect(measurementContractSchema.safeParse({ ...base, clarifyingQuestion: 'which?', ambiguityReason: 'none' }).success).toBe(false);
    expect(measurementContractSchema.safeParse({ ...base, clarifyingQuestion: 'which?', ambiguityReason: 'unit_ambiguous' }).success).toBe(true);
  });

  it('rejects a not_measurable contract that carries a comparison operator', () => {
    // A qualitative claim with an operator is a threshold invented by the
    // model rather than stated by the user.
    const result = measurementContractSchema.safeParse({ ...RESOLVED, resolution: 'not_measurable' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('cannot carry a comparison operator');
  });

  it('rejects a source tag that is not a bare XBRL element name', () => {
    expect(measurementContractSchema.safeParse({ ...RESOLVED, sourceTags: ['us-gaap:GrossProfit'] }).success).toBe(false);
    expect(measurementContractSchema.safeParse({ ...RESOLVED, sourceTags: ['GrossProfit'] }).success).toBe(true);
  });
});

describe('M011 thesis draft integration', () => {
  it('parses a legacy draft with no measurement block into the blocking sentinel', () => {
    const parsed = thesisDraftSchema.parse({
      ticker: 'PLTR',
      companyName: 'Palantir Technologies Inc.',
      market: 'US',
      coreBelief: 'Gross margin stays high.',
      assumptions: [{ statement: 'Gross margin remains above 80%.', status: 'untested' }],
    });
    expect(parsed.assumptions[0].measurement).toEqual(LEGACY_MEASUREMENT_CONTRACT);
    // Omission must not read as "measured" — it blocks, loudly.
    expect(draftClarificationBlock(parsed).blocked).toBe(true);
  });

  /**
   * Pins a Zod 4 implementation detail the whole `.default()` design rests on:
   * a defaulted field still appears in `toJSONSchema`'s `required` array, so
   * the model is instructed to produce `measurement` even though an older
   * persisted payload without it still parses. If a Zod upgrade changes this,
   * the model would silently stop emitting contracts and every draft would
   * block — a confusing failure this test turns into an obvious one.
   */
  it('tells the model measurement is required even though it is defaulted', () => {
    type JsonSchemaNode = { properties?: Record<string, JsonSchemaNode>; items?: JsonSchemaNode; required?: string[] };
    const json = z.toJSONSchema(chatResponsePayloadSchema) as JsonSchemaNode;
    const assumption = json.properties?.thesisDraft?.properties?.assumptions?.items;
    expect(assumption?.required).toContain('measurement');
  });
});

describe('M011 draftClarificationBlock', () => {
  it('does not block a resolved contract', () => {
    expect(draftClarificationBlock(thesisDraftSchema.parse(draftWith(RESOLVED))).blocked).toBe(false);
  });

  it('does not block a not_measurable contract', () => {
    // The escape hatch: without it, every qualitative assumption would block
    // its draft forever and the hard block would be unusable.
    const qualitative: MeasurementContract = {
      ...LEGACY_MEASUREMENT_CONTRACT,
      resolution: 'not_measurable',
      metric: 'management commitment to the programme',
    };
    expect(draftClarificationBlock(thesisDraftSchema.parse(draftWith(qualitative))).blocked).toBe(false);
  });

  it('blocks an ambiguous contract and surfaces its question verbatim', () => {
    const ambiguous: MeasurementContract = {
      ...LEGACY_MEASUREMENT_CONTRACT,
      resolution: 'ambiguous',
      metric: 'gross margin',
      clarifyingQuestion: 'Consolidated gross margin, or automotive segment excluding regulatory credits?',
      ambiguityReason: 'definition_variant_ambiguous',
    };
    const result = draftClarificationBlock(thesisDraftSchema.parse(draftWith(ambiguous)));
    expect(result.blocked).toBe(true);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toBe(ambiguous.clarifyingQuestion);
    expect(result.questions[0].reason).toBe('definition_variant_ambiguous');
  });

  it('falls back to a generated question when an ambiguous-shaped contract has none', () => {
    // Reachable only via the legacy sentinel, which cannot carry a question.
    const result = draftClarificationBlock(thesisDraftSchema.parse(draftWith(LEGACY_MEASUREMENT_CONTRACT)));
    expect(result.blocked).toBe(true);
    expect(result.questions[0].question).toContain('How should');
  });

  it('reports one question per unresolved assumption and none for resolved ones', () => {
    const draft = thesisDraftSchema.parse({
      ...draftWith(RESOLVED),
      assumptions: [
        { statement: 'Resolved claim.', status: 'untested', measurement: RESOLVED },
        { statement: 'Unresolved claim.', status: 'untested', measurement: LEGACY_MEASUREMENT_CONTRACT },
      ],
    });
    const result = draftClarificationBlock(draft);
    expect(result.blocked).toBe(true);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].statement).toBe('Unresolved claim.');
  });
});
