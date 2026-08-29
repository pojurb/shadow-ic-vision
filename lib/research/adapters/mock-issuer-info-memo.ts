import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

const encoder = new TextEncoder();

export class MockIssuerInfoMemoAdapter implements SourceAdapter {
  readonly mode = 'mock' as const;

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    return { kind: 'found', value: [{
      documentId: 'mock-issuer-info-memo-2026-q1',
      market: query.market,
      ticker: query.ticker,
      sourceUrl: 'https://example.invalid/reports/mock-info-memo.pdf',
      sourceName: `Issuer info memo (${query.ticker})`,
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
          <h1>Info Memo</h1>
          <p>${document.ticker} reported data-center capacity under management growing during the quarter.</p>
        </body></html>
      `),
    } };
  }
}
