import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

const encoder = new TextEncoder();

export class MockNewsWireAdapter implements SourceAdapter {
  readonly mode = 'mock' as const;

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    return { kind: 'found', value: [{
      documentId: 'mock-news-wire-2026-q1',
      market: query.market,
      ticker: query.ticker,
      sourceUrl: 'https://example.invalid/news/mock-news-article',
      sourceName: 'Mock News Wire',
      sourceTier: 'secondary',
      publishDate: '2026-05-12',
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
          <h1>Market News</h1>
          <p>${document.ticker} shares were mentioned in a curated financial news wire report this quarter.</p>
        </body></html>
      `),
    } };
  }
}
