import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

const encoder = new TextEncoder();

export class MockSecAdapter implements SourceAdapter {
  readonly mode = 'mock' as const;

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    return { kind: 'found', value: [{
      documentId: 'mock-sec-pltr-2026-q1',
      market: 'US',
      ticker: query.ticker,
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1321655/PLTR-10Q-2026Q1',
      sourceName: `SEC Form 10-Q Q1 2026 (${query.ticker})`,
      sourceTier: 'official',
      publishDate: '2026-05-08',
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
          <h1>Form 10-Q for ${document.ticker}</h1>
          <p>Palantir Technologies Inc. reported gross margin of 81.3% for the first quarter of 2026, driven by scaling commercial SaaS sales.</p>
        </body></html>
      `),
    } };
  }
}
