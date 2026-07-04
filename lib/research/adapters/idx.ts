import { load } from 'cheerio';
import type { OfficialHttpClient } from '../http';
import { unavailableOutcome } from './helpers';
import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

const IDX_REPORTS_PAGE = 'https://www.idx.co.id/id/perusahaan-tercatat/laporan-keuangan-dan-tahunan/';

export class IdxAdapter implements SourceAdapter {
  readonly mode = 'live' as const;

  constructor(private readonly http: OfficialHttpClient) {}

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    try {
      const result = await this.http.get(IDX_REPORTS_PAGE, 'text/html');
      const html = new TextDecoder().decode(result.bytes);
      const document = findOfficialIdxDocument(html, query.ticker);
      if (!document) {
        return {
          kind: 'unavailable',
          code: 'idx_source_unavailable',
          message: 'IDX did not expose a stable anonymous disclosure link with ticker, publication date, and document URL.',
        };
      }
      return { kind: 'found', value: [document] };
    } catch (error) {
      const outcome = unavailableOutcome<SourceDocumentRef[]>(error, 'IDX official disclosure access failed.');
      return {
        kind: 'unavailable',
        code: 'idx_source_unavailable',
        message: outcome.kind === 'found' ? 'IDX official disclosure access failed.' : outcome.message,
      };
    }
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    try {
      const result = await this.http.get(document.sourceUrl, 'application/pdf,text/html;q=0.9');
      const sourceFormat = result.contentType === 'application/pdf' || result.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html';
      return { kind: 'found', value: {
        ...document,
        sourceUrl: result.url,
        sourceFormat,
        rawBytes: result.bytes,
        retrievalTimestamp: new Date().toISOString(),
        contentType: result.contentType,
        httpStatus: result.status,
      } };
    } catch (error) {
      const outcome = unavailableOutcome<SourceSnapshot>(error, 'IDX official document fetch failed.');
      return outcome.kind === 'not_found'
        ? outcome
        : { kind: 'unavailable', code: 'idx_source_unavailable', message: outcome.kind === 'found' ? 'IDX official document fetch failed.' : outcome.message };
    }
  }
}

export function findOfficialIdxDocument(html: string, ticker: string): SourceDocumentRef | null {
  const $ = load(html);
  const upperTicker = ticker.toUpperCase();
  let result: SourceDocumentRef | null = null;
  $('a[href]').each((_, element) => {
    if (result) return;
    const href = $(element).attr('href');
    const context = normalize(`${$(element).text()} ${$(element).parent().text()}`);
    if (!href || !context.toUpperCase().includes(upperTicker)) return;
    const url = new URL(href, IDX_REPORTS_PAGE);
    if (url.protocol !== 'https:' || !url.hostname.toLowerCase().endsWith('idx.co.id')) return;
    const date = extractDate(context);
    if (!date) return;
    result = {
      documentId: url.pathname.split('/').filter(Boolean).at(-1) || `${upperTicker}-${date}`,
      market: 'ID',
      ticker: upperTicker,
      sourceUrl: url.toString(),
      sourceName: `IDX official disclosure (${upperTicker})`,
      sourceTier: 'official',
      publishDate: date,
      sourceFormat: url.pathname.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
    };
  });
  return result;
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function extractDate(value: string): string | null {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const local = value.match(/\b(\d{2})[/-](\d{2})[/-](20\d{2})\b/);
  return local ? `${local[3]}-${local[2]}-${local[1]}` : null;
}
