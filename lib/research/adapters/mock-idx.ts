import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

const encoder = new TextEncoder();

export class MockIdxAdapter implements SourceAdapter {
  readonly mode = 'mock' as const;

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    return { kind: 'found', value: [{
      documentId: 'mock-idx-bbri-2026-q1',
      market: 'ID',
      ticker: query.ticker,
      sourceUrl: 'https://www.idx.co.id/disclosures/BBRI-Q1-2026',
      sourceName: `IDX Financial Statement Q1 2026 (${query.ticker})`,
      sourceTier: 'official',
      publishDate: '2026-04-30',
      sourceFormat: 'html',
    }] };
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    return { kind: 'found', value: {
      ...document,
      retrievalTimestamp: new Date().toISOString(),
      contentType: 'text/html',
      httpStatus: 200,
      rawBytes: encoder.encode(`
        <html><body>
          <h1>Laporan Keuangan ${document.ticker}</h1>
          <p>PT Bank Rakyat Indonesia (Persero) Tbk melaporkan margin bunga bersih (NIM) sebesar 6,8% untuk kuartal pertama tahun 2026.</p>
        </body></html>
      `),
    } };
  }
}
