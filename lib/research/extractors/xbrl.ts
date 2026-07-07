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
