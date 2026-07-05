import type { OfficialHttpClient } from '../http';
import { unavailableOutcome } from './helpers';
import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

const IDX_API = 'https://www.idx.id/primary/ListedCompany/GetAnnouncement';
const REPORT_TERMS = ['laporan keuangan', 'financial statement', 'annual report', 'laporan tahunan', 'audited'];

type IdxAttachment = { PDFFilename?: string; FullSavePath?: string; OriginalFilename?: string };
type IdxAnnouncement = {
  pengumuman?: { Id2?: string | number; NoPengumuman?: string; TglPengumuman?: string; JudulPengumuman?: string; Kode_Emiten?: string };
  attachments?: IdxAttachment[];
};

export class IdxAdapter implements SourceAdapter {
  readonly mode = 'live' as const;

  constructor(private readonly http: OfficialHttpClient, private readonly fallback?: SourceAdapter) {}

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    try {
      const url = buildIdxAnnouncementUrl(query.ticker);
      const result = await this.http.get(url, 'application/json');
      const documents = parseIdxAnnouncements(new TextDecoder().decode(result.bytes), query.ticker, url);
      if (documents.length) return { kind: 'found', value: documents };
      if (this.fallback) return this.fallback.discover(query);
      return { kind: 'unavailable', code: 'idx_source_unavailable', message: 'IDX returned no eligible official financial-report attachment.' };
    } catch (error) {
      if (this.fallback) {
        const fallback = await this.fallback.discover(query);
        if (fallback.kind === 'found') return fallback;
      }
      const outcome = unavailableOutcome<SourceDocumentRef[]>(error, 'IDX official disclosure access failed.');
      return { kind: 'unavailable', code: 'idx_source_unavailable', message: outcome.kind === 'found' ? 'IDX official disclosure access failed.' : outcome.message };
    }
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    if (document.sourceName.startsWith('Issuer official')) return this.fallback?.fetchSnapshot(document) ?? {
      kind: 'unavailable', code: 'issuer_source_unavailable', message: 'Issuer fallback is not configured.',
    };
    try {
      const result = await this.http.get(document.sourceUrl, 'application/pdf,text/html;q=0.9');
      const sourceFormat = result.contentType === 'application/pdf' || result.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html';
      return { kind: 'found', value: { ...document, sourceUrl: result.url, sourceFormat, rawBytes: result.bytes, retrievalTimestamp: new Date().toISOString(), contentType: result.contentType, httpStatus: result.status } };
    } catch (error) {
      const outcome = unavailableOutcome<SourceSnapshot>(error, 'IDX official document fetch failed.');
      return outcome.kind === 'not_found' ? outcome : { kind: 'unavailable', code: 'idx_source_unavailable', message: outcome.kind === 'found' ? 'IDX official document fetch failed.' : outcome.message };
    }
  }
}

export function buildIdxAnnouncementUrl(ticker: string, now = new Date()): string {
  const end = compactDate(now);
  const startDate = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()));
  const params = new URLSearchParams({ kodeEmiten: ticker.toUpperCase(), emitenType: 's', indexFrom: '0', pageSize: '100', dateFrom: compactDate(startDate), dateTo: end, lang: 'id', keyword: '' });
  return `${IDX_API}?${params}`;
}

export function parseIdxAnnouncements(json: string, ticker: string, discoveryUrl = IDX_API): SourceDocumentRef[] {
  const payload = JSON.parse(json) as { Results?: IdxAnnouncement[]; Replies?: IdxAnnouncement[] } | IdxAnnouncement[];
  const rows = Array.isArray(payload) ? payload : payload.Results ?? payload.Replies ?? [];
  const upperTicker = ticker.toUpperCase();
  return rows.flatMap((row) => {
    const announcement = row.pengumuman ?? {};
    const title = announcement.JudulPengumuman?.toLowerCase() ?? '';
    if (announcement.Kode_Emiten?.toUpperCase() !== upperTicker || !REPORT_TERMS.some((term) => title.includes(term))) return [];
    const publishDate = normalizeIdxDate(announcement.TglPengumuman);
    if (!publishDate) return [];
    return (row.attachments ?? []).flatMap((attachment) => {
      const rawUrl = attachment.FullSavePath || attachment.PDFFilename;
      const sourceUrl = rawUrl ? normalizeIdxAttachmentUrl(rawUrl) : null;
      if (!sourceUrl) return [];
      return [{ documentId: String(announcement.Id2 ?? announcement.NoPengumuman ?? attachment.OriginalFilename ?? sourceUrl), market: 'ID' as const, ticker: upperTicker, sourceUrl, sourceName: `IDX official disclosure (${upperTicker})`, sourceTier: 'official' as const, publishDate, sourceFormat: 'pdf' as const, discoveryUrl }];
    });
  }).sort((a, b) => (b.publishDate ?? '').localeCompare(a.publishDate ?? ''));
}

export function normalizeIdxAttachmentUrl(input: string): string | null {
  let url: URL;
  try { url = new URL(input, 'https://www.idx.id'); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !['idx.co.id', 'www.idx.co.id', 'idx.id', 'www.idx.id'].includes(host)) return null;
  if (!url.pathname.toLowerCase().startsWith('/staticdata/') || !url.pathname.toLowerCase().endsWith('.pdf')) return null;
  url.hostname = 'www.idx.id';
  url.port = '';
  url.username = '';
  url.password = '';
  return url.toString();
}

function normalizeIdxDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

function compactDate(date: Date) { return date.toISOString().slice(0, 10).replaceAll('-', ''); }
