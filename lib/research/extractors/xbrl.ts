import type { MeasurementContract, MeasurementUnit } from '@/lib/domain/contracts';
import { contextKindOf, type XbrlUnitFact } from '../adapters/sec-xbrl';
import { ResearchSourceError } from '../errors';
import { createDerivedCandidate, type EvidenceCandidate } from './candidate';

export type XbrlFact = {
  concept: string;
  value: number;
  unit: string;
  period: string;
};

export function calculateGrossMarginFromFacts(facts: XbrlFact[]): EvidenceCandidate {
  const revenue = fact(facts, 'Revenue');
  const costOfRevenue = fact(facts, 'CostOfRevenue');
  if (revenue.value === 0) {
    throw new ResearchSourceError('unsupported_document', 'Cannot calculate gross margin from zero revenue.');
  }

  const value = (revenue.value - costOfRevenue.value) / revenue.value;
  return createDerivedCandidate({
    content: `${(value * 100).toFixed(1)}%`,
    impactSummary: 'Gross margin calculated deterministically from retained XBRL facts.',
    pageNumber: null,
    contentKind: 'structured_fact',
    extractionMethod: 'deterministic_calculation',
    method: 'gross_margin',
    inputs: { Revenue: revenue, CostOfRevenue: costOfRevenue },
    units: 'ratio',
    formula: '(Revenue - CostOfRevenue) / Revenue',
    parserVersion: 'synthetic-xbrl-1.0',
  });
}

function fact(facts: XbrlFact[], concept: string) {
  const found = facts.find((item) => item.concept === concept);
  if (!found) throw new ResearchSourceError('unsupported_document', `Missing XBRL concept: ${concept}.`);
  return found;
}

/**
 * M011. Maps a retrieved XBRL unit to the measurement contract's unit.
 *
 * Returns `null` when the two are incommensurable — a USD amount cannot answer
 * a percentage claim. That `null` propagates as an absent `observedValue`, so
 * `classifyPolarity` answers `inconclusive` rather than comparing numbers that
 * mean different things.
 */
export function normalizeToContractUnit(
  value: number,
  xbrlUnit: string,
  contractUnit: MeasurementUnit,
): number | null {
  const unit = xbrlUnit.toUpperCase();
  if (contractUnit === 'usd') return unit === 'USD' ? value : null;
  if (contractUnit === 'idr') return unit === 'IDR' ? value : null;
  if (contractUnit === 'count') return unit === 'SHARES' || unit === 'PURE' ? value : null;
  // XBRL reports ratios as decimals ("pure"), while a thesis states them as
  // percentages. This is the one real conversion, and getting its direction
  // wrong would move every verdict by two orders of magnitude.
  if (contractUnit === 'percent') return unit === 'PURE' ? value * 100 : null;
  if (contractUnit === 'ratio') return unit === 'PURE' ? value : null;
  return null;
}

function formatPeriod(fact: XbrlUnitFact): string {
  return contextKindOf(fact) === 'instant' ? `as of ${fact.end}` : `${fact.start} to ${fact.end}`;
}

/**
 * M011. Turns one selected XBRL fact into a `derived` evidence candidate.
 *
 * `derived` rather than a new verification status: an XBRL fact is a structured
 * value read out of a filing, which is exactly what that class already means,
 * and it inherits the existing ceiling that keeps it from ever reading as
 * `exact_verified` source prose.
 *
 * The `observedValue`/`observedUnit`/`observedTimeBasis` triple is what makes
 * this candidate — unlike every text-derived one — capable of producing a real
 * polarity rather than `inconclusive`.
 */
export function createXbrlFactCandidate(input: {
  tag: string;
  unit: string;
  fact: XbrlUnitFact;
  contract: MeasurementContract;
  entityName?: string;
}): EvidenceCandidate {
  const observedValue = normalizeToContractUnit(input.fact.val, input.unit, input.contract.unit);
  const contextKind = contextKindOf(input.fact);
  return createDerivedCandidate({
    content: `us-gaap:${input.tag} = ${input.fact.val} ${input.unit} (${formatPeriod(input.fact)}${input.fact.form ? `, ${input.fact.form}` : ''})`,
    impactSummary:
      `Structured XBRL fact us-gaap:${input.tag} retrieved for "${input.contract.metric}". `
      + `Context: ${contextKind} (${formatPeriod(input.fact)}).`
      + (observedValue === null
        ? ` Reported in ${input.unit}, which is not commensurable with the claim's unit (${input.contract.unit}), so it asserts no comparable magnitude.`
        : ''),
    pageNumber: null,
    contentKind: 'structured_fact',
    extractionMethod: 'xbrl_parser',
    method: 'sec_company_concept',
    inputs: {
      tag: input.tag,
      unit: input.unit,
      start: input.fact.start ?? null,
      end: input.fact.end,
      val: input.fact.val,
      form: input.fact.form ?? null,
      accn: input.fact.accn ?? null,
      filed: input.fact.filed ?? null,
      entityName: input.entityName ?? null,
      contextKind,
    },
    units: input.unit,
    parserVersion: 'sec-xbrl-companyconcept-1.0',
    // Left undefined on an incommensurable unit, so polarity stays honest.
    observedValue: observedValue ?? undefined,
    observedUnit: observedValue === null ? undefined : input.contract.unit,
    // The fact already passed `factSatisfiesTimeBasis` before reaching here, so
    // stating the contract's basis is a restatement of a checked fact, not an
    // assumption.
    observedTimeBasis: observedValue === null ? undefined : input.contract.timeBasis,
  });
}
