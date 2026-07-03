import { SourceAdapter, SourceSnapshot } from './types';

export class SecEdgarAdapter implements SourceAdapter {
  async fetchSnapshot(ticker: string, documentType: string): Promise<SourceSnapshot> {
    // Stub implementation returning a deterministic snapshot
    return {
      sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}`,
      sourceFormat: 'html',
      retrievalTimestamp: new Date().toISOString(),
      rawBytes: `
        <html>
          <body>
            <h1>Form 10-Q for ${ticker}</h1>
            <p>Management's Discussion and Analysis of Financial Condition</p>
            <p>The company experienced a 15% increase in gross margins during the third quarter compared to the prior year, primarily driven by improved pricing leverage and reduced logistics costs.</p>
            <p>We face significant risks related to supply chain constraints which could materially affect our operations.</p>
          </body>
        </html>
      `
    };
  }
}
