import type { ExtractedDocument } from './document';

export type EvidenceCandidate = {
  quote: string;
  impactSummary: string;
  pageNumber: number | null;
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
      impactSummary: 'Exact source passage matched deterministically. Interpretation remains pending.',
    }));
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
