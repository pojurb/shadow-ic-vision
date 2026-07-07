import { createDerivedCandidate, type EvidenceCandidate } from './candidate';
import { extractSyntheticOcrCandidate, type SyntheticOcrPage } from './ocr';

export type ChartPoint = {
  label: string;
  value: number;
};

export function calculateChartGrowthCandidate(input: {
  series: [ChartPoint, ChartPoint];
  pageNumber: number;
  boundingBox?: [number, number, number, number] | null;
  units?: string;
}): EvidenceCandidate {
  const [base, current] = input.series;
  const growth = (current.value - base.value) / base.value;
  return createDerivedCandidate({
    content: `${(growth * 100).toFixed(1)}%`,
    impactSummary: 'Chart growth calculated deterministically from retained visual data points.',
    pageNumber: input.pageNumber,
    contentKind: 'chart',
    extractionMethod: 'deterministic_calculation',
    method: 'chart_growth',
    inputs: { base, current },
    units: input.units ?? 'ratio',
    formula: `(${current.value} - ${base.value}) / ${base.value}`,
    boundingBox: input.boundingBox,
  });
}

export function extractScreenshotOcrCandidate(input: {
  pages: SyntheticOcrPage[];
  candidateQuote: string;
  impactSummary: string;
}): EvidenceCandidate {
  return extractSyntheticOcrCandidate({
    ...input,
    contentKind: 'screenshot',
    ocrVersion: 'synthetic-screenshot-ocr-1.0',
  });
}
