import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

const encoder = new TextEncoder();

export class MockIssuerPressReleaseAdapter implements SourceAdapter {
  readonly mode = 'mock' as const;

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    return { kind: 'found', value: [{
      documentId: 'mock-issuer-press-2026-q1',
      market: query.market,
      ticker: query.ticker,
      sourceUrl: 'https://example.invalid/press/mock-press-release',
      sourceName: `Issuer press release (${query.ticker})`,
      sourceTier: 'secondary',
      publishDate: '2026-05-10',
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
          <h1>Press Release</h1>
          <p>${document.ticker} announced continued growth in commercial deployments during the quarter.</p>
        </body></html>
      `),
    } };
  }
}
