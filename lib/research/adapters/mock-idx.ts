import type { SourceAdapter, SourceSnapshot } from './types';

const encoder = new TextEncoder();

export class MockIdxAdapter implements SourceAdapter {
  async fetchSnapshot(ticker: string): Promise<SourceSnapshot> {
    return {
      sourceUrl: 'https://www.idx.co.id/disclosures/BBRI-Q1-2026',
      sourceName: `IDX Financial Statement Q1 2026 (${ticker})`,
      sourceTier: 'official',
      publishDate: '2026-04-30',
      sourceFormat: 'html',
      retrievalTimestamp: new Date().toISOString(),
      parserVersion: 'mock-html-1.0.0',
      rawBytes: encoder.encode(`
        <html><body>
          <h1>Laporan Keuangan ${ticker}</h1>
          <p>PT Bank Rakyat Indonesia (Persero) Tbk melaporkan margin bunga bersih (NIM) sebesar 6,8% untuk kuartal pertama tahun 2026.</p>
        </body></html>
      `),
    };
  }
}
