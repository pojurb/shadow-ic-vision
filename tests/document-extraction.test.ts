import { describe, expect, it } from 'vitest';
import { extractDeterministicCandidates } from '@/lib/research/extractors/candidate';
import { extractDocument, extractHtml, extractPdf } from '@/lib/research/extractors/document';

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
    })).rejects.toMatchObject({ code: 'unsupported_document' });
  });

  it('extracts text-layer PDFs with one-based page provenance', async () => {
    const extracted = await extractPdf(createPdf('Gross margin was 81.3% in Q1.'));
    expect(extracted).toMatchObject({ extractionMethod: 'pdf_text' });
    expect(extracted.pages[0]).toMatchObject({ pageNumber: 1, text: 'Gross margin was 81.3% in Q1.' });
  });

  it('classifies empty-text and corrupt PDFs as degraded document states', async () => {
    await expect(extractPdf(createPdf(''))).rejects.toMatchObject({ code: 'scanned_document' });
    await expect(extractPdf(new TextEncoder().encode('%PDF-not-valid'))).rejects.toMatchObject({ code: 'corrupt_document' });
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
