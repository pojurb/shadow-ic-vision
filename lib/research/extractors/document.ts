import { load } from 'cheerio';
import type { SourceSnapshot } from '../adapters/types';
import { ResearchSourceError } from '../errors';
import { normalizeText } from '../verifier';

export type ExtractedPage = {
  pageNumber: number | null;
  text: string;
};

export type ExtractedDocument = {
  canonicalText: string;
  pages: ExtractedPage[];
  parserVersion: string;
  extractionMethod: 'html_parser' | 'pdf_text';
  sourceVariant: 'text_layer';
};

export async function extractDocument(snapshot: SourceSnapshot): Promise<ExtractedDocument> {
  if (snapshot.rawBytes.byteLength > 10 * 1024 * 1024) {
    throw new ResearchSourceError('source_too_large', 'Source document is too large for first-slice multimodal processing.');
  }
  if (snapshot.sourceFormat === 'html') return extractHtml(snapshot.rawBytes);
  if (snapshot.sourceFormat === 'pdf') return extractPdf(snapshot.rawBytes);
  if (snapshot.sourceFormat === 'image') {
    throw new ResearchSourceError('unsupported_visual', 'Image source requires a configured OCR or vision extractor.');
  }
  throw new ResearchSourceError('unsupported_document', `Unsupported source format: ${snapshot.sourceFormat}.`);
}

export function extractHtml(rawBytes: Uint8Array): ExtractedDocument {
  const html = new TextDecoder().decode(rawBytes);
  const $ = load(html);
  $('script, style, noscript, template, svg').remove();
  $('br').replaceWith(' ');
  $('p, div, section, article, tr, li, h1, h2, h3, h4, h5, h6').append(' ');
  const canonicalText = normalizeText($('body').text() || $.root().text());
  if (!canonicalText) throw new ResearchSourceError('unsupported_document', 'Official HTML document contained no extractable text.');
  return {
    canonicalText,
    pages: [{ pageNumber: null, text: canonicalText }],
    parserVersion: 'cheerio-1.1',
    extractionMethod: 'html_parser',
    sourceVariant: 'text_layer',
  };
}

export async function extractPdf(rawBytes: Uint8Array): Promise<ExtractedDocument> {
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
    return {
      canonicalText,
      pages,
      parserVersion: `pdfjs-${pdfjs.version}`,
      extractionMethod: 'pdf_text',
      sourceVariant: 'text_layer',
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
