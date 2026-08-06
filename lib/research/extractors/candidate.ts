import type { MeasurementTimeBasis, MeasurementUnit } from '@/lib/domain/contracts';
import type { ExtractedDocument, ExtractedPage } from './document';

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
    /*
     * M011. The single scalar this candidate asserts, when it asserts one.
     *
     * Only structured-fact producers set these — XBRL retrieval and
     * deterministic calculation. Absent means "no machine-comparable value",
     * and `classifyPolarity` then answers `inconclusive` rather than falling
     * back to scraping a number out of the quote text. Carried in metadata
     * because `VerifiedEvidence.metadata` already flows to the database
     * unchanged, so no pipeline change is needed to move it.
     */
    observedValue?: number;
    observedUnit?: MeasurementUnit;
    observedTimeBasis?: MeasurementTimeBasis;
    /** Prior-period comparand, for directional (increases/decreases) claims. */
    priorValue?: number;
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

// M009 (R-025). Site-wide legal/cookie/navigation phrasing that DOM-level
// stripping in extractHtml can't reach (e.g. embedded inside a main-content
// <p>/<div> rather than a <nav>/<footer>). Checked case-insensitively as a
// substring against the raw sentence, before scoring, so a boilerplate
// sentence can't buy its way past the threshold via an incidental digit or
// ticker mention. Applies identically to both source tiers.
const BOILERPLATE_PHRASES = [
  'all rights reserved',
  'cookie policy',
  'cookie preferences',
  'manage your cookie',
  'privacy policy',
  'terms of use',
  'terms and conditions',
  'skip to content',
  'skip to main content',
  // Indonesian equivalents.
  'kebijakan privasi',
  'kebijakan cookie',
  'syarat dan ketentuan',
  'hak cipta dilindungi',
  'seluruh hak cipta',
  'lewati ke konten',
];

function isBoilerplatePhrase(quote: string): boolean {
  const lower = quote.toLowerCase();
  return BOILERPLATE_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * M010 (R-025). Shape-level backstops for the secondary tier, sitting behind
 * block segmentation rather than replacing it.
 *
 * M009's three mechanisms all filter on *vocabulary*; the 2026-07-27 live
 * failure was a *shape* — a category-filter widget that reached the ranker as
 * one punctuation-free run-on and outscored real prose purely on token surface
 * area. Segmentation splits most of those apart; these two catch what it can't.
 *
 * `MAX_SECONDARY_QUOTE_LENGTH`: widgets built entirely from `<span>`/`<option>`
 * inside a single block element cannot be split by segmentation. Calibrated on
 * the four retained TLKM snapshots: the largest genuine article block measured
 * 298 chars, while everything above ~310 was legal boilerplate (privacy policy
 * and T&C prose, including a 908-char intellectual-property clause that M009's
 * phrase denylist does NOT catch — it reads "dilindungi oleh hak cipta", not
 * the denylisted "hak cipta dilindungi").
 *
 * `MIN_FRAGMENT_WORDS`/`MAX_UNPUNCTUATED_WORDS`: text carrying no
 * sentence-terminal punctuation is only plausible as a *headline*, and a
 * headline is bounded on both sides — long enough to assert something, short
 * enough to still be a headline. Outside that band, unpunctuated text is a
 * label or a list of labels rather than a claim. Anything ending in terminal
 * punctuation skips this rule entirely, so ordinary prose is never affected.
 *
 * Both bounds come from measured real examples rather than intuition:
 *   - below: the chart label "Group Revenue 1Q 2026" (4 words) on snapshot
 *     `7768e9c4`, which scores 18 and clears every M009 gate;
 *   - above: the nav run-on "Solusi Overview Business Enterprise Wholesale …
 *     ESG Karir" (18 words, zero punctuation, zero digits);
 *   - and the genuine headline that must survive between them, "Telkom
 *     Tuntaskan Streamlining 10 Entitas, Percepat Transformasi Menuju
 *     Strategic Holding" (10 words), which the live 2026-07-27 run confirmed
 *     is real, on-topic secondary evidence.
 *
 * The band is therefore calibrated on a small number of real observations, not
 * a corpus — recorded as residual risk rather than presented as general.
 */
const MAX_SECONDARY_QUOTE_LENGTH = 400;
const MIN_FRAGMENT_WORDS = 8;
const MAX_UNPUNCTUATED_WORDS = 14;
const TERMINAL_PUNCTUATION = /[.!?][")'\]]?$/;

function isNonProseFragment(quote: string): boolean {
  if (TERMINAL_PUNCTUATION.test(quote)) return false;
  const words = quote.split(/\s+/).filter(Boolean).length;
  return words < MIN_FRAGMENT_WORDS || words > MAX_UNPUNCTUATED_WORDS;
}

/**
 * M010 (R-025). Tier-gated, mirroring M009 Slice 3's precedent exactly.
 *
 * For `'official'` this reduces to `[page.text]` — literally the pre-M010
 * expression — so the official path's segmentation, filtering, ordering, and
 * output are unchanged *structurally*, not merely observed-to-be-unchanged.
 * `extractDeterministicCandidates` always passes `'official'`, which is what
 * makes that airtight.
 *
 * Consequence recorded honestly rather than glossed: official-tier HTML (the
 * `adapters/sec.ts` HTML branch and `adapters/issuer.ts`'s non-PDF fallback)
 * keeps the pre-M010 run-on shape. See the M010 packet's deferrals.
 */
function segmentationUnits(page: ExtractedPage, sourceTier: 'official' | 'secondary'): string[] {
  if (sourceTier === 'official') return [page.text];
  return page.blocks ?? [page.text];
}

function rankSentenceCandidates(
  document: ExtractedDocument,
  assumption: string,
  ticker: string,
  limit: number,
  sourceTier: 'official' | 'secondary' = 'official',
  identity = '',
): Array<{ quote: string; pageNumber: number | null }> {
  const assumptionTokens = significantTokens(`${ticker} ${assumption}`);
  const assumptionNumbers = numbers(assumption);
  const lowerTicker = ticker.toLowerCase();
  const identityTokens = significantTokens(identity);
  const ranked = document.pages.flatMap((page) => segmentationUnits(page, sourceTier)
    .flatMap(splitSentences)
    .filter((quote) => !isBoilerplatePhrase(quote))
    .map((quote) => {
      const quoteTokens = significantTokens(quote);
      const matchedTokens = [...assumptionTokens].filter((token) => quoteTokens.has(token));
      const tokenMatches = matchedTokens.length;
      const numberMatches = assumptionNumbers.filter((number) => matchesNumberExactly(quote, number)).length;
      /*
       * Left as "any digit". Restricting this bonus to numbers the assumption
       * names was tried and reverted: it rejected "Palantir reported gross
       * margin of 81.3%" for an assumption requiring gross margin above 80%,
       * where the figure is the whole point but is not the same number. The
       * relevance problem is handled by `qualifyingTokenMatches` below, which
       * refuses the passage outright when nothing but the company's identity
       * matched — a topical gate, not a scoring tweak.
       */
      const hasNumericFact = /\d/.test(quote);
      // M009 (R-025). A token equal to the ticker itself or a bare four-digit
      // year (a copyright year, a filing year mentioned in passing) is common
      // to nearly every page on an issuer's own domain and carries no
      // assumption-specific relevance on its own. Counted toward
      // `tokenMatches`/`score` as before (official-path behavior unaffected);
      // excluded only from `qualifyingTokenMatches`, which gates
      // secondary-tier candidates below.
      /*
       * Generalized 2026-08-06 from "the ticker and bare years" to "everything
       * that merely identifies the company". `identityTokens` carries the
       * company name and market from the thesis, because those words are given
       * by *which thesis this is* and so cannot also be evidence that a passage
       * concerns a *particular assumption* of it.
       *
       * The case that forced it: an assumption about NeutraDC's data-centre
       * market share was "evidenced" by "Pergerakan indeks ditopang penguatan
       * saham PT Telkom Indonesia Tbk (TLKM) yang melonjak 4,18%" — an index
       * round-up. Its entire overlap was the ticker plus `indonesia`, which
       * cleared a floor of one qualifying token. Nothing in it mentions
       * NeutraDC, market share, or data centres.
       */
      const qualifyingTokenMatches = matchedTokens.filter(
        (token) => token !== lowerTicker && !/^\d{4}$/.test(token) && !identityTokens.has(token),
      ).length;
      return {
        quote,
        pageNumber: page.pageNumber,
        score: tokenMatches * 3 + numberMatches * 5 + (hasNumericFact ? 2 : 0),
        tokenMatches,
        qualifyingTokenMatches,
      };
    }));

  return ranked
    .filter((candidate) => {
      if (candidate.tokenMatches < 2 || candidate.score < 8 || candidate.quote.length < 20) return false;
      // M009 (R-025). Secondary-tier only: a candidate whose only qualifying
      // matches are the ticker/a bare year (e.g. a genuine but topically
      // unrelated press release that merely mentions the issuer and the
      // current year) is rejected. The official path never applies this —
      // its output is byte-for-byte unchanged from before M009.
      if (sourceTier === 'secondary' && candidate.qualifyingTokenMatches < 1) return false;
      // M010 (R-025). Shape guards, secondary tier only — see the constants'
      // doc comment for the calibration data behind each threshold.
      if (sourceTier === 'secondary' && candidate.quote.length > MAX_SECONDARY_QUOTE_LENGTH) return false;
      if (sourceTier === 'secondary' && isNonProseFragment(candidate.quote)) return false;
      return true;
    })
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
  const selected = rankSentenceCandidates(document, assumption, ticker, limit, 'official');

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
  /**
   * Company name and market, from the thesis. Their tokens are excluded from
   * the qualifying-match count — see `rankSentenceCandidates`. Optional and
   * empty by default so a caller without thesis context behaves exactly as
   * before rather than silently losing the guard.
   */
  identity = '',
): EvidenceCandidate[] {
  const selected = rankSentenceCandidates(document, assumption, ticker, limit, 'secondary', identity);
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
  // M011. Optional, so every existing caller is unaffected; a caller that can
  // assert a machine-comparable magnitude opts in by supplying them.
  observedValue?: number;
  observedUnit?: MeasurementUnit;
  observedTimeBasis?: MeasurementTimeBasis;
  priorValue?: number;
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
      observedValue: input.observedValue,
      observedUnit: input.observedUnit,
      observedTimeBasis: input.observedTimeBasis,
      priorValue: input.priorValue,
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

/**
 * Substring matching treated an assumption's `30` as satisfied by `130`,
 * `2030`, or `3.05`, so a threshold could be "matched" by a number that has
 * nothing to do with it — and each such match was worth 5 points, the largest
 * single term in the score. Boundaries are digits and decimal separators
 * rather than `\b`, because `\b` sits happily between `1` and `30`.
 */
function matchesNumberExactly(text: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.,])${escaped}(?![\\d.,])`).test(text);
}
