export interface SourceSnapshot {
  sourceUrl: string;
  sourceFormat: 'html' | 'text' | 'pdf' | 'xbrl';
  rawBytes: string; // The raw content string
  retrievalTimestamp: string;
}

export interface SourceAdapter {
  /**
   * Fetches the raw snapshot from the underlying source.
   */
  fetchSnapshot(ticker: string, documentType: string): Promise<SourceSnapshot>;
}
