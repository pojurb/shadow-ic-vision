import type { MeasurementTimeBasis } from '@/lib/domain/contracts';
import type { OfficialHttpClient } from '../http';
import { unavailableOutcome } from './helpers';
import { resolveSecCik } from './sec';
import type { ResearchSourceMode, SourceOutcome } from './types';

/**
 * M011 — structured XBRL facts from SEC company-concept.
 *
 * Deliberately **not** a `SourceAdapter`. That interface exists to produce raw
 * document bytes which `extractDocument` turns into text and which
 * `verifyExactMatch` checks a quote against; the whole verification chain
 * presumes prose. A company-concept response is a keyed numeric fact series
 * with no prose to quote, so forcing it through `SourceAdapter` would make
 * `extractDocument` learn a fourth format and would blur what `exact_verified`
 * means. It is a fact source instead, and its output becomes `derived`
 * evidence — which already carries the correct trust ceiling for free.
 */

/** One reported value for one concept, in one unit, over one period. */
export type XbrlUnitFact = {
  /** Present only for duration facts (income statement, cash flow). */
  start?: string;
  /** Always present. Alone, it means an instant — a balance-sheet stock. */
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  accn?: string;
  frame?: string;
};

export type XbrlConceptResponse = {
  cik: number;
  taxonomy: string;
  tag: string;
  label?: string;
  description?: string;
  entityName?: string;
  units: Record<string, XbrlUnitFact[]>;
};

export type XbrlConceptFetch = {
  response: XbrlConceptResponse;
  rawBytes: Uint8Array;
  sourceUrl: string;
};

export type XbrlFactSource = {
  readonly mode: ResearchSourceMode;
  fetchConcept(input: { ticker: string; tag: string }): Promise<SourceOutcome<XbrlConceptFetch>>;
};

export type XbrlContextKind = 'instant' | 'duration';

/**
 * The structural fix for the balance-versus-flow defect.
 *
 * A `DeferredRevenue*` fact carries `end` only — it is an instant, a stock
 * measured at a point in time. An assumption about *recognized revenue growth*
 * is a flow measured across a period. Presenting the former as evidence for the
 * latter is the conflation that let a $4.05B deferred-revenue balance read as
 * support for a claim about revenue scaling.
 *
 * Pure, network-free, and unit-tested, so the refusal is a property of the data
 * model rather than a judgment call made at retrieval time.
 */
export function contextKindOf(fact: XbrlUnitFact): XbrlContextKind {
  return typeof fact.start === 'string' && fact.start.length > 0 ? 'duration' : 'instant';
}

function daysBetween(start: string, end: string): number {
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (Number.isNaN(from) || Number.isNaN(to)) return NaN;
  return (to - from) / 86_400_000;
}

/**
 * Bands rather than exact day counts because real filing periods vary: a
 * "quarter" runs 89-92 days depending on the calendar, and 52/53-week fiscal
 * years land either side of 365.
 */
export function factSatisfiesTimeBasis(fact: XbrlUnitFact, timeBasis: MeasurementTimeBasis): boolean {
  const kind = contextKindOf(fact);
  if (timeBasis === 'instant') return kind === 'instant';
  // The refusal itself: no duration claim may ever be answered by a balance.
  if (kind === 'instant') return false;

  const days = daysBetween(fact.start as string, fact.end);
  if (Number.isNaN(days) || days <= 0) return false;
  if (timeBasis === 'duration_quarter') return days >= 80 && days <= 100;
  if (timeBasis === 'duration_annual') return days >= 350 && days <= 380;
  if (timeBasis === 'duration_ytd') return days > 100 && days < 350;
  /*
   * Trailing twelve months is not expressible in company-concept's period
   * model — the API reports the periods a filer actually tagged, and no filer
   * tags a rolling TTM window. Failing closed to "no fact" makes that a named
   * coverage gap the ledger can report, rather than silently substituting an
   * annual figure that means something different.
   */
  if (timeBasis === 'duration_ttm') return false;
  // 'unspecified' matches nothing. The measurement contract's hard block should
  // have stopped this reaching retrieval; this is the second layer.
  return false;
}

const PREFERRED_FORMS = ['10-Q', '10-K'];

/**
 * Picks the fact to report, among those the time-basis gate admits.
 *
 * Prefers periodic reports over 8-K and amendment noise, then the most recent
 * period, then the most recently filed — so a restatement wins over the
 * original it replaces.
 */
export function selectFact(
  response: XbrlConceptResponse,
  timeBasis: MeasurementTimeBasis,
  preferredUnits: readonly string[] = [],
): { unit: string; fact: XbrlUnitFact } | null {
  const unitNames = Object.keys(response.units ?? {});
  const ordered = [
    ...preferredUnits.filter((unit) => unitNames.includes(unit)),
    ...unitNames.filter((unit) => !preferredUnits.includes(unit)),
  ];

  const eligible = ordered.flatMap((unit) => (response.units[unit] ?? [])
    .filter((fact) => typeof fact.val === 'number' && Number.isFinite(fact.val))
    .filter((fact) => factSatisfiesTimeBasis(fact, timeBasis))
    .map((fact) => ({ unit, fact })));
  if (eligible.length === 0) return null;

  const periodic = eligible.filter((entry) => PREFERRED_FORMS.includes(entry.fact.form ?? ''));
  const pool = periodic.length ? periodic : eligible;
  return [...pool].sort((left, right) => {
    const byEnd = right.fact.end.localeCompare(left.fact.end);
    if (byEnd !== 0) return byEnd;
    return (right.fact.filed ?? '').localeCompare(left.fact.filed ?? '');
  })[0];
}

export class SecCompanyConceptSource implements XbrlFactSource {
  readonly mode = 'live' as const;

  constructor(private readonly http: OfficialHttpClient, private readonly userAgent: string) {}

  async fetchConcept(input: { ticker: string; tag: string }): Promise<SourceOutcome<XbrlConceptFetch>> {
    if (!this.userAgent.trim() || !this.userAgent.includes('@')) {
      return { kind: 'unavailable', code: 'source_configuration', message: 'Live SEC XBRL retrieval requires SEC_USER_AGENT with an application name and contact email.' };
    }

    try {
      const resolved = await resolveSecCik(this.http, input.ticker);
      if (!resolved) return { kind: 'not_found', code: 'source_not_found', message: `SEC ticker mapping did not contain ${input.ticker}.` };

      const sourceUrl = `https://data.sec.gov/api/xbrl/companyconcept/CIK${resolved.cik}/us-gaap/${encodeURIComponent(input.tag)}.json`;
      const result = await this.http.get(sourceUrl, 'application/json');
      const response = JSON.parse(new TextDecoder().decode(result.bytes)) as XbrlConceptResponse;
      if (!response || typeof response !== 'object' || !response.units) {
        return { kind: 'not_found', code: 'source_not_found', message: `SEC reported no facts for us-gaap:${input.tag}.` };
      }
      return { kind: 'found', value: { response, rawBytes: result.bytes, sourceUrl: result.url } };
    } catch (error) {
      // A tag a company never reports returns 404, which the client throws on.
      // That is a normal, expected outcome, not a failure — it is exactly the
      // "no structured source for this claim" case the ledger names.
      return unavailableOutcome(error, `SEC XBRL retrieval failed for us-gaap:${input.tag}.`);
    }
  }
}
