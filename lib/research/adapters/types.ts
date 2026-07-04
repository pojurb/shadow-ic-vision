export interface SourceSnapshot {
  sourceUrl: string;
  sourceName: string;
  sourceTier: 'official' | 'secondary';
  publishDate: string | null;
  sourceFormat: 'html' | 'pdf' | 'image' | 'xbrl';
  rawBytes: Uint8Array;
  retrievalTimestamp: string;
  parserVersion: string;
}

export interface SourceAdapter {
  /**
   * Fetches the raw snapshot from the underlying source.
   */
  fetchSnapshot(ticker: string, documentType: string): Promise<SourceSnapshot>;
}
