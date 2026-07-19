import { describe, expect, it } from 'vitest';
import type { ChatResult, LLMProvider, ProjectMessage, ProviderCallContext, ProviderCapabilities, ProviderMetadata, StructuredExtractResult } from '@/lib/ai/provider';
import { createDerivedCandidate, createOcrCandidate, extractDeterministicCandidates } from '@/lib/research/extractors/candidate';
import { extractDocument, extractHtml, extractPdf } from '@/lib/research/extractors/document';
import { extractSyntheticOcrCandidate, extractVisionOcrCandidate } from '@/lib/research/extractors/ocr';
import { calculateGrossMarginFromFacts } from '@/lib/research/extractors/xbrl';
import { verifyExactMatch, verifyPageExactMatch } from '@/lib/research/verifier';

const stubContext: ProviderCallContext = {
  route: 'tests.document-extraction',
  dataClass: 'synthetic_fixture',
  runtime: { deployment: 'local' },
};

class StubVisionProvider implements LLMProvider {
  constructor(private readonly recognizedText: string) {}

  getMetadata(): ProviderMetadata {
    return { provider: 'stub-vision', modelId: 'stub-vision-1', promptVersion: '1.0.0', settings: {} };
  }

  getCapabilities(): ProviderCapabilities {
    return { streaming: false, structuredOutput: false, vision: true, contextLimit: 8_192, languages: ['en'] };
  }

  async chat(messages: ProjectMessage[]): Promise<ChatResult> {
    expect(messages.at(-1)?.attachments?.[0]?.type).toBe('image');
    return { text: this.recognizedText, metadata: this.getMetadata() };
  }

  async *streamCompletion(): AsyncIterable<string> {
    yield this.recognizedText;
  }

  async structuredExtract<T>(): Promise<StructuredExtractResult<T>> {
    return { data: null, success: false, error: 'not_implemented', metadata: this.getMetadata() };
  }
}

describe('deterministic document extraction', () => {
  it('removes executable markup and preserves canonical source text', () => {
    const extracted = extractHtml(new TextEncoder().encode('<html><body><script>ignore()</script><p>Gross margin was 81.3% in Q1.</p></body></html>'));
    expect(extracted.canonicalText).toBe('Gross margin was 81.3% in Q1.');
  });

  it('ranks exact numeric sentences using assumption terms', () => {
    const document = {
      canonicalText: 'Revenue increased 10%. Palantir reported gross margin of 81.3% in the quarter.',
      pages: [{ pageNumber: null, text: 'Revenue increased 10%. Palantir reported gross margin of 81.3% in the quarter.' }],
      parserVersion: 'test',
      extractionMethod: 'html_parser' as const,
      sourceVariant: 'text_layer' as const,
    };
    const candidates = extractDeterministicCandidates(document, 'PLTR gross margin remains above 80%.', 'PLTR');
    expect(candidates[0]).toMatchObject({
      quote: 'Palantir reported gross margin of 81.3% in the quarter.',
      pageNumber: null,
    });
    expect(document.canonicalText).toContain(candidates[0].quote);
  });

  it('returns no candidate for unrelated source text', () => {
    const document = {
      canonicalText: 'The company appointed a new director.',
      pages: [{ pageNumber: null, text: 'The company appointed a new director.' }],
      parserVersion: 'test',
      extractionMethod: 'html_parser' as const,
      sourceVariant: 'text_layer' as const,
    };
    expect(extractDeterministicCandidates(document, 'Gross margin remains above 80%.', 'PLTR')).toEqual([]);
  });

  it('degrades unsupported document formats explicitly', async () => {
    await expect(extractDocument({
      documentId: 'image-1',
      market: 'ID',
      ticker: 'BBRI',
      sourceUrl: 'https://www.idx.co.id/image.png',
      sourceName: 'IDX image',
      sourceTier: 'official',
      publishDate: '2026-04-30',
      sourceFormat: 'image',
      rawBytes: new Uint8Array([1, 2, 3]),
      retrievalTimestamp: '2026-07-04T00:00:00.000Z',
      contentType: 'image/png',
      httpStatus: 200,
    })).rejects.toMatchObject({ code: 'unsupported_visual' });
  });

  it('degrades oversized documents before extraction', async () => {
    await expect(extractDocument({
      documentId: 'large-1',
      market: 'US',
      ticker: 'PLTR',
      sourceUrl: 'https://www.sec.gov/large.pdf',
      sourceName: 'SEC large filing',
      sourceTier: 'official',
      publishDate: '2026-04-30',
      sourceFormat: 'pdf',
      rawBytes: new Uint8Array(10 * 1024 * 1024 + 1),
      retrievalTimestamp: '2026-07-04T00:00:00.000Z',
      contentType: 'application/pdf',
      httpStatus: 200,
    })).rejects.toMatchObject({ code: 'source_too_large' });
  });

  it('extracts text-layer PDFs with one-based page provenance', async () => {
    const extracted = await extractPdf(createPdf('Gross margin was 81.3% in Q1.'));
    expect(extracted).toMatchObject({ extractionMethod: 'pdf_text' });
    expect(extracted.pages[0]).toMatchObject({ pageNumber: 1, text: 'Gross margin was 81.3% in Q1.' });
  }, 15_000);

  it('classifies empty-text and corrupt PDFs as degraded document states', async () => {
    await expect(extractPdf(createPdf(''))).rejects.toMatchObject({ code: 'scanned_document' });
    await expect(extractPdf(new TextEncoder().encode('%PDF-not-valid'))).rejects.toMatchObject({ code: 'corrupt_document' });
  });

  it('matches OCR text without promoting it to exact evidence', () => {
    const candidate = extractSyntheticOcrCandidate({
      pages: [{ pageNumber: 1, text: 'Pendapatan bersih meningkat 12,4% dibandingkan periode yang sama tahun lalu.' }],
      candidateQuote: 'Pendapatan bersih meningkat 12,4%',
      impactSummary: 'OCR matched retained text.',
    });
    expect(candidate).toMatchObject({ verificationStatus: 'ocr_matched', pageNumber: 1 });
    expect(candidate.verificationStatus).not.toBe('exact_verified');
  });

  it('wraps real provider vision transcription as ocr_matched, never exact_verified', async () => {
    const provider = new StubVisionProvider('Pendapatan bersih meningkat 12,4% dibandingkan periode yang sama tahun lalu.');
    const candidate = await extractVisionOcrCandidate({
      rawBytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      candidateQuote: 'Pendapatan bersih meningkat 12,4%',
      impactSummary: 'Real provider vision transcription matched.',
      provider,
      context: stubContext,
    });
    expect(candidate).toMatchObject({ verificationStatus: 'ocr_matched', pageNumber: null });
    expect(candidate.verificationStatus).not.toBe('exact_verified');
  });

  it('blocks a vision candidate whose quote is absent from the real transcription', async () => {
    const provider = new StubVisionProvider('An unrelated transcription with no matching figures.');
    await expect(extractVisionOcrCandidate({
      rawBytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      candidateQuote: 'Pendapatan bersih meningkat 12,4%',
      impactSummary: 'Should not match.',
      provider,
      context: stubContext,
    })).rejects.toMatchObject({ code: 'citation_not_found' });
  });

  it('blocks OCR single-character corruption against retained OCR output', () => {
    const candidate = createOcrCandidate({
      quote: 'Pendapatan bersih meningkat 12,5%',
      ocrText: 'Pendapatan bersih meningkat 12,4% dibandingkan periode yang sama tahun lalu.',
      impactSummary: 'Corrupt OCR candidate.',
      pageNumber: 1,
    });
    expect(candidate.verificationStatus).toBe('ocr_matched');
    if (candidate.verificationStatus === 'ocr_matched') {
      expect(() => verifyExactMatch(candidate.quote, candidate.ocrText)).toThrow();
    }
  });

  it('keeps table and XBRL calculations derived with method metadata', () => {
    const table = createDerivedCandidate({
      content: 'Rp 9,2 triliun',
      impactSummary: 'Derived table value.',
      pageNumber: 3,
      contentKind: 'table',
      extractionMethod: 'table_parser',
      method: 'table_cell_lookup',
      inputs: { row: 'Pendapatan', column: '2026' },
      units: 'Rp triliun',
    });
    const xbrl = calculateGrossMarginFromFacts([
      { concept: 'Revenue', value: 1000, unit: 'USD millions', period: '2026-Q1' },
      { concept: 'CostOfRevenue', value: 187, unit: 'USD millions', period: '2026-Q1' },
    ]);
    expect(table).toMatchObject({ verificationStatus: 'derived', extractionMethod: 'table_parser' });
    expect(xbrl).toMatchObject({ verificationStatus: 'derived', quote: '81.3%' });
    expect(table.verificationStatus).not.toBe('exact_verified');
    expect(xbrl.verificationStatus).not.toBe('exact_verified');
  });

  it('blocks a correct quote claimed on the wrong page', () => {
    const pages = [
      { pageNumber: 6, text: 'Gross margin was 81.3% for the quarter.' },
      { pageNumber: 7, text: 'Operating expenses increased during the quarter.' },
    ];
    expect(() => verifyPageExactMatch('Gross margin was 81.3%', pages, 7)).toThrow();
    expect(verifyPageExactMatch('Gross margin was 81.3%', pages, 6)).toBe(true);
  });
});

function createPdf(text: string): Uint8Array {
  const escaped = text.replace(/([\\()])/g, '\\$1');
  const stream = text ? `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET` : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).byteLength);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
