import { load } from 'cheerio';
import type { SourceSnapshot } from '../adapters/types';
import { ResearchSourceError } from '../errors';
import { normalizeText } from '../verifier';
import { detectEmbeddedInstructions, type InstructionClassifier } from './safety';

export type ExtractedPage = {
  pageNumber: number | null;
  text: string;
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
};

export async function extractDocument(
  snapshot: SourceSnapshot,
  options: ExtractDocumentOptions = {},
): Promise<ExtractedDocument> {
  if (snapshot.rawBytes.byteLength > 10 * 1024 * 1024) {
    throw new ResearchSourceError('source_too_large', 'Source document is too large for first-slice multimodal processing.');
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

export async function extractHtml(
  rawBytes: Uint8Array,
  options: Pick<ExtractDocumentOptions, 'instructionClassifier'> = {},
): Promise<ExtractedDocument> {
  const html = new TextDecoder().decode(rawBytes);
  const $ = load(html);
  $('script, style, noscript, template, svg').remove();
  $('br').replaceWith(' ');
  $('p, div, section, article, tr, li, h1, h2, h3, h4, h5, h6').append(' ');
  const canonicalText = normalizeText($('body').text() || $.root().text());
  if (!canonicalText) throw new ResearchSourceError('unsupported_document', 'Official HTML document contained no extractable text.');
  const scan = await detectEmbeddedInstructions(canonicalText, options.instructionClassifier);
  return {
    canonicalText,
    pages: [{ pageNumber: null, text: canonicalText }],
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
    const task = pdfjs.getDocument({ data: rawBytes, useWorkerFetch: false });
    const document = await task.promise;
    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalizeText(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
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
