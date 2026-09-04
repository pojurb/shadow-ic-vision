import type { AssuranceLevel } from '../assurance';

export type ResearchMarket = 'US' | 'ID';
export type SourceFormat = 'html' | 'pdf' | 'image' | 'xbrl';
export type ResearchSourceMode = 'mock' | 'live';

/**
 * M013 — the single byte ceiling for a source document, shared by the download
 * path (`lib/research/http.ts`) and the extraction path
 * (`lib/research/extractors/document.ts`).
 *
 * It lives here, in the module both already import, because the defect this
 * milestone opened on was the two limits **disagreeing**. Download allowed
 * 25 MB; extraction refused anything past 10 MB. Real issuer documents were
 * therefore fetched over the network, hashed, written to the snapshot store —
 * and then discarded unread. On the live TLKM thesis that meant a 24.3 MB
 * annual report and a 10.5 MB climate report (0.5 MB past the old limit) were
 * both retained and refused, leaving a small sustainability report as the only
 * official document the thesis ever produced evidence from. All six official
 * jobs reported `source_too_large` while the error text named the 25 MB limit
 * that had not actually been the one to reject them.
 *
 * Two constants can drift; one cannot. If a future change genuinely needs the
 * download and extraction ceilings to differ, that difference should be
 * deliberate and named — not the accident of two hardcoded numbers edited in
 * different milestones.
 *
 * The value is the user's calibration decision (2026-08-08): deliberately
 * generous, so that document size stops silently deciding what the product can
 * read. Extraction still holds the whole document in memory, so this ceiling is
 * a real resource commitment, not a formality — `extractPdf` cost against a
 * genuinely large document is measured in M013 Slice 3 rather than assumed.
 */
export const SOURCE_BYTE_LIMIT = 500 * 1024 * 1024;

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
  | 'news_wire_source_unavailable'
  | 'crawl_limit_exceeded'
  | 'already_running'
  | 'citation_not_found'
  | 'idx_source_unavailable'
  | 'unsupported_document'
  | 'unsupported_visual'
  | 'encrypted_document'
  | 'corrupt_document'
  | 'scanned_document'
  | 'corrupt_office_file'
  | 'ocr_handoff_invalid'
  | 'ocr_handoff_mismatch'
  /*
   * Every discovered document had already been retrieved, and none of them
   * produced evidence for this assumption. Distinct from `citation_not_found`
   * (documents were processed this run and nothing cleared verification) and
   * from `source_not_found` (discovery returned nothing at all): here the
   * sweep had nowhere left to advance to.
   */
  | 'no_new_documents';

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
  /**
   * M013 follow-on step 6. Whether this document carries an auditor's
   * opinion. Optional because each adapter has a different signal to derive
   * it from (an IDX announcement title, a SEC form code, a filename) and an
   * adapter with none should leave it absent rather than guess — `undefined`
   * and `'unknown'` both mean "not established", never "audited".
   */
  assuranceLevel?: AssuranceLevel;
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
