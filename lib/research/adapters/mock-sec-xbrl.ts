import type { SourceOutcome } from './types';
import type { XbrlConceptFetch, XbrlFactSource } from './sec-xbrl';

/**
 * M011 Slice 4. Deterministic XBRL facts for `RESEARCH_SOURCE_MODE=mock`,
 * mirroring `mock-sec.ts`'s shape.
 *
 * The fixtures are chosen to exercise both halves of the balance-versus-flow
 * gate against a single ticker:
 *
 * - `GrossProfit` and the revenue tag are duration facts spanning a real
 *   quarter, so a `duration_quarter` claim can actually be answered.
 * - `DeferredRevenueCurrent` is an instant — a balance — so a duration claim
 *   pointed at it must come back empty. That is the deferred-revenue defect
 *   reproduced as a fixture rather than described in a comment.
 */
const FIXTURES: Record<string, Record<string, XbrlConceptFetch['response']['units']>> = {
  PLTR: {
    GrossProfit: {
      USD: [
        { start: '2025-10-01', end: '2025-12-31', val: 700_000_000, form: '10-K', filed: '2026-02-17', accn: '0001321655-26-000010', fy: 2025, fp: 'Q4' },
        { start: '2026-01-01', end: '2026-03-31', val: 813_000_000, form: '10-Q', filed: '2026-05-05', accn: '0001321655-26-000031', fy: 2026, fp: 'Q1' },
      ],
    },
    // The one tag whose only facts are instants. A `duration_*` contract
    // pointed here must yield nothing.
    DeferredRevenueCurrent: {
      USD: [
        { end: '2026-03-31', val: 4_050_000_000, form: '10-Q', filed: '2026-05-05', accn: '0001321655-26-000031' },
      ],
    },
    // A ratio, reported the way XBRL reports ratios: as a decimal in the
    // "pure" unit, which the contract-unit conversion turns into a percentage.
    GrossMarginRatio: {
      pure: [
        { start: '2026-01-01', end: '2026-03-31', val: 0.813, form: '10-Q', filed: '2026-05-05', accn: '0001321655-26-000031' },
      ],
    },
  },
};

export class MockSecXbrlFactSource implements XbrlFactSource {
  readonly mode = 'mock' as const;

  async fetchConcept(input: { ticker: string; tag: string }): Promise<SourceOutcome<XbrlConceptFetch>> {
    const units = FIXTURES[input.ticker.toUpperCase()]?.[input.tag];
    if (!units) {
      return { kind: 'not_found', code: 'source_not_found', message: `No mock XBRL fixture for ${input.ticker} us-gaap:${input.tag}.` };
    }

    const response = {
      cik: 1_321_655,
      taxonomy: 'us-gaap',
      tag: input.tag,
      entityName: `${input.ticker.toUpperCase()} (deterministic fixture)`,
      units,
    };
    return {
      kind: 'found',
      value: {
        response,
        // Serialized so the fixture is content-addressed exactly like a live
        // response — the snapshot chain of custody is identical in both modes.
        rawBytes: new TextEncoder().encode(JSON.stringify(response)),
        sourceUrl: `https://data.sec.gov/api/xbrl/companyconcept/CIK0001321655/us-gaap/${input.tag}.json`,
      },
    };
  }
}
