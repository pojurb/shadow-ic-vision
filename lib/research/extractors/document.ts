import { load } from 'cheerio';
import { SOURCE_BYTE_LIMIT, type SourceSnapshot } from '../adapters/types';
import { ResearchSourceError } from '../errors';
import { normalizeText } from '../verifier';
import { detectEmbeddedInstructions, type InstructionClassifier } from './safety';

export type ExtractedPage = {
  pageNumber: number | null;
  text: string;
  /**
   * M010 (R-025/R-026). Block-level segmentation of `text`, in document order.
   *
   * INVARIANT, asserted by test rather than argued:
   *   (blocks ?? [text]).join(' ') === text
   *
   * That identity is the entire proof that a sentence ranked out of a block is
   * still a verbatim substring of `canonicalText` — which `verifyExactMatch`
   * (a plain `.includes()`) requires, and without which candidates would be
   * silently swallowed by the catch in `pipeline.ts`.
   *
   * Deliberately OPTIONAL. `undefined` means "no block structure known" (PDF,
   * vision transcription, hand-built fixtures) and every consumer falls back to
   * `[text]`, i.e. exactly the pre-M010 behavior. A required field would make a
   * site that forgot to populate it fail silently to zero candidates; optional
   * makes that failure mode unrepresentable.
   */
  blocks?: string[];
};

export type ExtractedDocument = {
  canonicalText: string;
  pages: ExtractedPage[];
  parserVersion: string;
  /**
   * `'vision'` marks a model transcription rather than a parsed text layer.
   * Kept assignable to `EvidenceExtractionMethod` so the pipeline can pass it
   * through without a cast.
   */
  extractionMethod: 'html_parser' | 'pdf_text' | 'vision';
  /**
   * `'scanned'` is the R-017 load-bearing signal: `extractDeterministicCandidates`
   * refuses to mint `exact_verified` candidates from a document carrying it.
   * Text-layer parsers must never set it.
   */
  sourceVariant: 'text_layer' | 'scanned';
  /**
   * R-018. True when the extracted text contains something shaped like an
   * instruction aimed at the model rather than source content. The flag is
   * recorded and propagated; `canonicalText` is deliberately NOT truncated —
   * see `scanEmbeddedInstructions`' call sites for where isolation is applied.
   */
  untrustedInstructionFlagged: boolean;
};

/**
 * Produces an `ExtractedDocument` from raw image bytes. Injected rather than
 * imported so `document.ts` stays free of provider dependencies and the vision
 * path remains opt-in — see `createVisionTranscriber` in `./ocr`.
 */
export type VisionTranscriber = (snapshot: SourceSnapshot) => Promise<ExtractedDocument>;

export type ExtractDocumentOptions = {
  visionTranscriber?: VisionTranscriber;
  /**
   * Optional second opinion beyond the regex, for languages it cannot match
   * (see `InstructionClassifier` in `./safety`). Off unless a caller
   * configures one — no extraction path calls a provider for this by
   * default.
   */
  instructionClassifier?: InstructionClassifier;
  /**
   * M013. Defaults to the shared `SOURCE_BYTE_LIMIT`. Overridable so the guard
   * stays testable without allocating a buffer past the real ceiling — a guard
   * that can only be exercised by allocating half a gigabyte stops being
   * exercised at all.
   */
  maxBytes?: number;
};

export async function extractDocument(
  snapshot: SourceSnapshot,
  options: ExtractDocumentOptions = {},
): Promise<ExtractedDocument> {
  /*
   * M013. Reads the same `SOURCE_BYTE_LIMIT` the download path enforces. This
   * check was an independent 10 MB constant while downloads allowed 25 MB, so
   * documents between the two were fetched, hashed, stored — and then refused
   * here, unread. Sharing one constant is what stops the two from drifting.
   */
  const maxBytes = options.maxBytes ?? SOURCE_BYTE_LIMIT;
  if (snapshot.rawBytes.byteLength > maxBytes) {
    throw new ResearchSourceError(
      'source_too_large',
      `Source document is ${Math.round(snapshot.rawBytes.byteLength / (1024 * 1024))} MB, past the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    );
  }
  if (snapshot.sourceFormat === 'html') return extractHtml(snapshot.rawBytes, options);
  if (snapshot.sourceFormat === 'pdf') return extractPdf(snapshot.rawBytes, options);
  if (snapshot.sourceFormat === 'image') {
    // Fails closed: without a configured vision provider this stays the
    // pre-M006 error rather than degrading to unlabelled evidence.
    if (!options.visionTranscriber) {
      throw new ResearchSourceError('unsupported_visual', 'Image source requires a configured OCR or vision extractor.');
    }
    return options.visionTranscriber(snapshot);
  }
  throw new ResearchSourceError('unsupported_document', `Unsupported source format: ${snapshot.sourceFormat}.`);
}

/**
 * M010 (R-025). The marker appended after every block-level element so block
 * boundaries survive `normalizeText`'s whitespace collapse.
 *
 * U+FFFC OBJECT REPLACEMENT CHARACTER, chosen empirically over two rejected
 * alternatives: U+0000 does NOT survive cheerio's `.append()` (parse5 drops
 * it), and U+E000 is Private Use Area, which icon-font sites legitimately
 * emit. U+FFFC survives and does not appear in real prose.
 */
const BLOCK_SEPARATOR = '￼';

const BLOCK_ELEMENT_SELECTOR = 'p, div, section, article, tr, li, h1, h2, h3, h4, h5, h6';

export async function extractHtml(
  rawBytes: Uint8Array,
  options: Pick<ExtractDocumentOptions, 'instructionClassifier'> = {},
): Promise<ExtractedDocument> {
  const html = new TextDecoder().decode(rawBytes);
  const $ = load(html);
  // M009 (R-025). Structural chrome and common cookie/consent-vendor
  // containers never carry assumption-relevant content, for either official
  // or secondary-tier HTML (both can reach this function — see
  // adapters/sec.ts and adapters/issuer.ts, which fall back to 'html' when
  // the fetched document isn't a PDF). Attribute-selector matching is
  // case-insensitive (`i` flag) so `Cookie-Banner`-style class names match
  // too. Kept as a single `.remove()` call, same position as before.
  $([
    'script, style, noscript, template, svg',
    'nav, header, footer, aside',
    '[class*="cookie" i], [id*="cookie" i]',
    '[class*="consent" i], [id*="consent" i]',
    '[class*="onetrust" i], [id*="onetrust" i]',
    '[class*="gdpr" i], [id*="gdpr" i]',
    '[class*="legal-notice" i], [id*="legal-notice" i]',
  ].join(', ')).remove();
  $('br').replaceWith(' ');
  // M010 (R-025). Fails safe on sentinel collision: if the source document
  // already contains U+FFFC, splitting on it would corrupt `canonicalText`, so
  // that document takes the pre-M010 path — it merely loses block structure and
  // the ranker falls back to whole-page segmentation.
  const sentinelCollision = html.includes(BLOCK_SEPARATOR);
  $(BLOCK_ELEMENT_SELECTOR).append(sentinelCollision ? ' ' : BLOCK_SEPARATOR);
  const raw = $('body').text() || $.root().text();
  // `raw.split(SEP).join(' ')` is byte-identical to the pre-M010
  // `$('body').text()`, because the node appended then WAS ' '. This is what
  // keeps `canonicalText` — and therefore every `exact_verified` hash and every
  // `verifyExactMatch` call — unchanged for both tiers.
  const canonicalText = normalizeText(sentinelCollision ? raw : raw.split(BLOCK_SEPARATOR).join(' '));
  if (!canonicalText) throw new ResearchSourceError('unsupported_document', 'Official HTML document contained no extractable text.');
  const blocks = sentinelCollision
    ? undefined
    : raw.split(BLOCK_SEPARATOR).map(normalizeText).filter(Boolean);
  const scan = await detectEmbeddedInstructions(canonicalText, options.instructionClassifier);
  return {
    canonicalText,
    pages: [{ pageNumber: null, text: canonicalText, blocks }],
    parserVersion: 'cheerio-1.1',
    extractionMethod: 'html_parser',
    sourceVariant: 'text_layer',
    untrustedInstructionFlagged: scan.untrustedInstructionFlagged,
  };
}

export async function extractPdf(
  rawBytes: Uint8Array,
  options: Pick<ExtractDocumentOptions, 'instructionClassifier'> = {},
): Promise<ExtractedDocument> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    /*
     * M013. pdfjs is handed a **copy**, never the caller's buffer.
     *
     * `getDocument` transfers the ArrayBuffer it receives, which detaches the
     * caller's view — measured on a real 10,972,090-byte document, `byteLength`
     * became 0 the moment this call was awaited. Every `persistSourceSnapshot`
     * call site runs *after* extraction and writes `snapshot.rawBytes`, so the
     * snapshot store filled with empty files while the evidence drawn from
     * those documents was still stored `exact_verified` — quotes that could no
     * longer be re-verified against a source that was, on disk, nothing.
     *
     * The copy costs one extra buffer for the duration of extraction. The
     * alternative — persisting before extraction — was not chosen because the
     * outcome (`verified`/`rejected`) is only known afterwards, and splitting
     * the write from its audit row would put the two out of step.
     */
    const task = pdfjs.getDocument({ data: new Uint8Array(rawBytes), useWorkerFetch: false });
    const document = await task.promise;
    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalizeText(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      // M010: `blocks` deliberately left undefined. pdfjs text items carry no
      // reliable block structure (`hasEOL` is a line marker, not a block
      // marker), so official PDFs keep the pre-M010 whole-page segmentation.
      // Recorded as an explicit deferral in the M010 packet, not as fixed.
      pages.push({ pageNumber, text });
    }
    const canonicalText = normalizeText(pages.map((page) => page.text).join(' '));
    if (!canonicalText) throw new ResearchSourceError('scanned_document', 'PDF has no text layer; OCR is not implemented in this phase.');
    const scan = await detectEmbeddedInstructions(canonicalText, options.instructionClassifier);
    return {
      canonicalText,
      pages,
      parserVersion: `pdfjs-${pdfjs.version}`,
      extractionMethod: 'pdf_text',
      sourceVariant: 'text_layer',
      untrustedInstructionFlagged: scan.untrustedInstructionFlagged,
    };
  } catch (error) {
    if (error instanceof ResearchSourceError) throw error;
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (name === 'PasswordException' || message.includes('password')) {
      throw new ResearchSourceError('encrypted_document', 'Encrypted PDF cannot be processed without a password.');
    }
    throw new ResearchSourceError('corrupt_document', 'PDF is corrupt or unreadable.');
  }
}
