export type ResearchMarket = 'US' | 'ID';
export type SourceFormat = 'html' | 'pdf' | 'image' | 'xbrl';
export type ResearchSourceMode = 'mock' | 'live';

export type SourceErrorCode =
  | 'source_configuration'
  | 'source_not_found'
  | 'source_timeout'
  | 'source_rate_limited'
  | 'source_http_error'
  | 'source_too_large'
  | 'source_redirect_blocked'
  | 'source_access_denied'
  | 'issuer_source_unavailable'
  | 'crawl_limit_exceeded'
  | 'already_running'
  | 'citation_not_found'
  | 'idx_source_unavailable'
  | 'unsupported_document'
  | 'encrypted_document'
  | 'corrupt_document'
  | 'scanned_document';

export type SourceQuery = {
  market: ResearchMarket;
  ticker: string;
  documentTypes: string[];
};

export interface SourceDocumentRef {
  documentId: string;
  market: ResearchMarket;
  ticker: string;
  sourceUrl: string;
  sourceName: string;
  sourceTier: 'official' | 'secondary';
  publishDate: string | null;
  sourceFormat: SourceFormat;
  discoveryUrl?: string;
}

export interface SourceSnapshot extends SourceDocumentRef {
  rawBytes: Uint8Array;
  retrievalTimestamp: string;
  contentType: string;
  httpStatus: number;
}

export type SourceOutcome<T> =
  | { kind: 'found'; value: T }
  | { kind: 'not_found'; code: 'source_not_found'; message: string }
  | { kind: 'unavailable'; code: SourceErrorCode; message: string };

export interface SourceAdapter {
  readonly mode: ResearchSourceMode;
  discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>>;
  fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>>;
}
