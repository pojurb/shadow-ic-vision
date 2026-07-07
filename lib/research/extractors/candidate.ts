import type { ExtractedDocument } from './document';

export type EvidenceVerificationStatus = 'exact_verified' | 'ocr_matched' | 'derived';
export type EvidenceContentKind = 'text' | 'table' | 'chart' | 'screenshot' | 'structured_fact';
export type EvidenceExtractionMethod =
  | 'html_parser'
  | 'pdf_text'
  | 'ocr'
  | 'vision'
  | 'table_parser'
  | 'xbrl_parser'
  | 'deterministic_calculation';

export type EvidenceCandidate = {
  quote: string;
  impactSummary: string;
  verificationStatus: 'exact_verified';
  pageNumber: number | null;
  contentKind?: 'text';
  sourceVariant?: 'text_layer';
  boundingBox?: null;
  metadata?: Record<string, unknown>;
  extractionMethod?: never;
} | {
  quote: string;
  impactSummary: string;
  verificationStatus: 'ocr_matched';
  pageNumber: number | null;
  ocrText: string;
  extractionMethod?: 'ocr';
  contentKind?: 'text' | 'screenshot';
  sourceVariant?: 'scanned';
  boundingBox?: [number, number, number, number] | null;
  metadata?: Record<string, unknown>;
} | {
  quote: string;
  impactSummary: string;
  verificationStatus: 'derived';
  pageNumber: number | null;
  contentKind: 'table' | 'chart' | 'structured_fact';
  extractionMethod: 'table_parser' | 'xbrl_parser' | 'deterministic_calculation';
  sourceVariant?: 'text_layer' | 'scanned';
  boundingBox?: [number, number, number, number] | null;
  metadata: {
    method: string;
    inputs: unknown;
    units?: string;
    formula?: string;
    parserVersion?: string;
  };
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'believe', 'for', 'from', 'i', 'in', 'is', 'it', 'of', 'on', 'or',
  'remain', 'remains', 'that', 'the', 'this', 'to', 'will', 'with', 'akan', 'dan', 'dari', 'di', 'ini', 'itu',
  'saya', 'tetap', 'untuk', 'yang',
]);

export function extractDeterministicCandidates(
  document: ExtractedDocument,
  assumption: string,
  ticker: string,
  limit = 3,
): EvidenceCandidate[] {
  const assumptionTokens = significantTokens(`${ticker} ${assumption}`);
  const assumptionNumbers = numbers(assumption);
  const ranked = document.pages.flatMap((page) => splitSentences(page.text).map((quote) => {
    const quoteTokens = significantTokens(quote);
    const tokenMatches = [...assumptionTokens].filter((token) => quoteTokens.has(token)).length;
    const numberMatches = assumptionNumbers.filter((number) => quote.includes(number)).length;
    const hasNumericFact = /\d/.test(quote);
    return {
      quote,
      pageNumber: page.pageNumber,
      score: tokenMatches * 3 + numberMatches * 5 + (hasNumericFact ? 2 : 0),
      tokenMatches,
    };
  }));

  return ranked
    .filter((candidate) => candidate.tokenMatches >= 2 && candidate.score >= 8 && candidate.quote.length >= 20)
    .sort((left, right) => right.score - left.score || left.quote.length - right.quote.length)
    .slice(0, limit)
    .map(({ quote, pageNumber }) => ({
      quote,
      pageNumber,
      verificationStatus: 'exact_verified' as const,
      contentKind: 'text' as const,
      impactSummary: 'Exact source passage matched deterministically. Interpretation remains pending.',
    }));
}

export function createOcrCandidate(input: {
  quote: string;
  ocrText: string;
  impactSummary: string;
  pageNumber: number | null;
  contentKind?: 'text' | 'screenshot';
  boundingBox?: [number, number, number, number] | null;
  ocrVersion?: string;
}): EvidenceCandidate {
  return {
    quote: input.quote,
    ocrText: input.ocrText,
    impactSummary: input.impactSummary,
    verificationStatus: 'ocr_matched',
    extractionMethod: 'ocr',
    pageNumber: input.pageNumber,
    contentKind: input.contentKind ?? 'text',
    sourceVariant: 'scanned',
    boundingBox: input.boundingBox ?? null,
    metadata: { ocrVersion: input.ocrVersion ?? 'synthetic-ocr-1.0' },
  };
}

export function createDerivedCandidate(input: {
  content: string;
  impactSummary: string;
  pageNumber: number | null;
  contentKind: 'table' | 'chart' | 'structured_fact';
  extractionMethod: 'table_parser' | 'xbrl_parser' | 'deterministic_calculation';
  method: string;
  inputs: unknown;
  units?: string;
  formula?: string;
  parserVersion?: string;
  boundingBox?: [number, number, number, number] | null;
}): EvidenceCandidate {
  return {
    quote: input.content,
    impactSummary: input.impactSummary,
    verificationStatus: 'derived',
    pageNumber: input.pageNumber,
    contentKind: input.contentKind,
    extractionMethod: input.extractionMethod,
    boundingBox: input.boundingBox ?? null,
    metadata: {
      method: input.method,
      inputs: input.inputs,
      units: input.units,
      formula: input.formula,
      parserVersion: input.parserVersion ?? 'synthetic-derived-1.0',
    },
  };
}

function splitSentences(text: string): string[] {
  const segments = new Intl.Segmenter(['en', 'id'], { granularity: 'sentence' }).segment(text);
  return [...segments].map((entry) => entry.segment.trim()).filter(Boolean);
}

function significantTokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase().match(/[\p{L}\p{N}]+(?:[.,]\p{N}+)?%?/gu)
      ?.filter((token) => token.length >= 2 && !STOP_WORDS.has(token)) ?? [],
  );
}

function numbers(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
}
