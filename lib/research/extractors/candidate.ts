import type { ExtractedDocument } from './document';

export type EvidenceVerificationStatus = 'exact_verified' | 'ocr_matched' | 'derived' | 'secondary_issuer' | 'secondary_news';
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
  extractionMethod?: 'ocr' | 'vision';
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
} | {
  // M007. Publisher/wire-service identity is already carried by
  // `VerifiedEvidence.sourceName` (set from `SourceSnapshot.sourceName` at
  // the pipeline level) — duplicating it into `metadata` would be
  // redundant, so `metadata` stays optional/freeform here, matching
  // `exact_verified`/`ocr_matched` rather than `derived`'s required shape.
  quote: string;
  impactSummary: string;
  verificationStatus: 'secondary_issuer';
  pageNumber: number | null;
  contentKind?: 'text';
  extractionMethod?: 'html_parser';
  sourceVariant?: 'text_layer';
  boundingBox?: [number, number, number, number] | null;
  metadata?: Record<string, unknown>;
} | {
  quote: string;
  impactSummary: string;
  verificationStatus: 'secondary_news';
  pageNumber: number | null;
  contentKind?: 'text';
  extractionMethod?: 'html_parser';
  sourceVariant?: 'text_layer';
  boundingBox?: [number, number, number, number] | null;
  metadata?: Record<string, unknown>;
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'believe', 'for', 'from', 'i', 'in', 'is', 'it', 'of', 'on', 'or',
  'remain', 'remains', 'that', 'the', 'this', 'to', 'will', 'with', 'akan', 'dan', 'dari', 'di', 'ini', 'itu',
  'saya', 'tetap', 'untuk', 'yang',
]);

function rankSentenceCandidates(
  document: ExtractedDocument,
  assumption: string,
  ticker: string,
  limit: number,
): Array<{ quote: string; pageNumber: number | null }> {
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
    .map(({ quote, pageNumber }) => ({ quote, pageNumber }));
}

export function extractDeterministicCandidates(
  document: ExtractedDocument,
  assumption: string,
  ticker: string,
  limit = 3,
): EvidenceCandidate[] {
  const selected = rankSentenceCandidates(document, assumption, ticker, limit);

  // R-017 invariant. A quote drawn from a model transcription is only ever
  // exact with respect to that transcription, never to the source document —
  // so a `'scanned'` document can never mint `exact_verified` here. This is the
  // single site that produces exact-verified candidates from an
  // `ExtractedDocument`; the check belongs here rather than at each call site.
  if (document.sourceVariant === 'scanned') {
    return selected.map(({ quote, pageNumber }) => createOcrCandidate({
      quote,
      ocrText: document.pages.find((page) => page.pageNumber === pageNumber)?.text ?? document.canonicalText,
      pageNumber,
      impactSummary: 'Passage matched against retained transcription of a visual source. Not source-exact; interpretation remains pending.',
      ocrVersion: document.parserVersion,
      extractionMethod: document.extractionMethod === 'vision' ? 'vision' : 'ocr',
    }));
  }

  return selected.map(({ quote, pageNumber }) => ({
    quote,
    pageNumber,
    verificationStatus: 'exact_verified' as const,
    contentKind: 'text' as const,
    impactSummary: 'Exact source passage matched deterministically. Interpretation remains pending.',
  }));
}

/**
 * M007. A sibling to `extractDeterministicCandidates`, not a branch inside
 * it. Its only return paths call `createSecondaryIssuerCandidate`/
 * `createSecondaryNewsCandidate`, so it has no code path capable of
 * constructing `exact_verified`/`ocr_matched` — the R-010 structural gate
 * lives in which function was called, not in a runtime check on the
 * document's shape. (Branching inside `extractDeterministicCandidates`
 * instead, mirroring its `sourceVariant === 'scanned'` gate, was considered
 * and rejected: that function's exact-verified branch already constructs
 * evidence inline rather than via a factory, so a third inline branch would
 * let one function's source construct all five verification statuses — a
 * weaker invariant than a dedicated function whose only exits are dedicated
 * factories. See the M007 packet's "Options Considered" #2.)
 */
export function extractSecondaryCandidates(
  document: ExtractedDocument,
  assumption: string,
  ticker: string,
  sourceClass: 'issuer' | 'news',
  limit = 3,
): EvidenceCandidate[] {
  const selected = rankSentenceCandidates(document, assumption, ticker, limit);
  const impactSummary = sourceClass === 'issuer'
    ? 'Passage matched against a company investor-relations release. Secondary source; official confirmation remains pending.'
    : 'Passage matched against a curated news-wire article. Secondary source; official confirmation remains pending.';

  if (sourceClass === 'issuer') {
    return selected.map(({ quote, pageNumber }) => createSecondaryIssuerCandidate({ quote, pageNumber, impactSummary }));
  }
  return selected.map(({ quote, pageNumber }) => createSecondaryNewsCandidate({ quote, pageNumber, impactSummary }));
}

export function createOcrCandidate(input: {
  quote: string;
  ocrText: string;
  impactSummary: string;
  pageNumber: number | null;
  contentKind?: 'text' | 'screenshot';
  boundingBox?: [number, number, number, number] | null;
  ocrVersion?: string;
  extractionMethod?: 'ocr' | 'vision';
}): EvidenceCandidate {
  return {
    quote: input.quote,
    ocrText: input.ocrText,
    impactSummary: input.impactSummary,
    verificationStatus: 'ocr_matched',
    extractionMethod: input.extractionMethod ?? 'ocr',
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

export function createSecondaryIssuerCandidate(input: {
  quote: string;
  impactSummary: string;
  pageNumber: number | null;
  boundingBox?: [number, number, number, number] | null;
  metadata?: Record<string, unknown>;
}): EvidenceCandidate {
  return {
    quote: input.quote,
    impactSummary: input.impactSummary,
    verificationStatus: 'secondary_issuer',
    pageNumber: input.pageNumber,
    contentKind: 'text',
    extractionMethod: 'html_parser',
    sourceVariant: 'text_layer',
    boundingBox: input.boundingBox ?? null,
    metadata: input.metadata,
  };
}

export function createSecondaryNewsCandidate(input: {
  quote: string;
  impactSummary: string;
  pageNumber: number | null;
  boundingBox?: [number, number, number, number] | null;
  metadata?: Record<string, unknown>;
}): EvidenceCandidate {
  return {
    quote: input.quote,
    impactSummary: input.impactSummary,
    verificationStatus: 'secondary_news',
    pageNumber: input.pageNumber,
    contentKind: 'text',
    extractionMethod: 'html_parser',
    sourceVariant: 'text_layer',
    boundingBox: input.boundingBox ?? null,
    metadata: input.metadata,
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
