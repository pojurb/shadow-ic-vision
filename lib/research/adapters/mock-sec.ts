import type { SourceAdapter, SourceSnapshot } from './types';

const encoder = new TextEncoder();

export class MockSecAdapter implements SourceAdapter {
  async fetchSnapshot(ticker: string): Promise<SourceSnapshot> {
    return {
      sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1321655/PLTR-10Q-2026Q1',
      sourceName: `SEC Form 10-Q Q1 2026 (${ticker})`,
      sourceTier: 'official',
      publishDate: '2026-05-08',
      sourceFormat: 'html',
      retrievalTimestamp: new Date().toISOString(),
      parserVersion: 'mock-html-1.0.0',
      rawBytes: encoder.encode(`
        <html><body>
          <h1>Form 10-Q for ${ticker}</h1>
          <p>Palantir Technologies Inc. reported gross margin of 81.3% for the first quarter of 2026, driven by scaling commercial SaaS sales.</p>
        </body></html>
      `),
    };
  }
}
