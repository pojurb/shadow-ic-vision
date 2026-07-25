import { load } from 'cheerio';
import type { OfficialHttpClient } from '../http';
import { unavailableOutcome } from './helpers';
import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

// Includes both hyphenated/underscored forms (typical in URL paths) and
// space-separated forms (typical in rendered link text) — a link whose
// visible text reads "press release" but whose href is "/press-release/..."
// must match on either.
const PRESS_RELEASE_TERMS = [
  'press release', 'press-release', 'press_release',
  'siaran pers', 'siaran-pers', 'siaran_pers',
  'announcement', 'pengumuman', 'berita',
];

/**
 * M007 Class A. A sibling to `IssuerAdapter` (`./issuer.ts`), not a
 * parameterization of it: `IssuerAdapter` hardcodes `sourceTier: 'official'`
 * for its actual role as `idx.ts`'s official-filing fallback, so reusing it
 * in place for press releases would mislabel secondary content as official,
 * defeating the R-010 structural intent. This adapter always sets
 * `sourceTier: 'secondary'` and, unlike `IssuerAdapter`, does not require a
 * `.pdf` extension — press releases are typically HTML pages.
 */
export class IssuerPressReleaseAdapter implements SourceAdapter {
  readonly mode = 'live' as const;
  constructor(private readonly sourceUrls: Record<string, string>, private readonly clients: Record<string, OfficialHttpClient>) {}

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    const startUrl = this.sourceUrls[query.ticker.toUpperCase()];
    if (!startUrl) return { kind: 'unavailable', code: 'issuer_source_unavailable', message: `No press-release source is configured for ${query.ticker}.` };
    const origin = new URL(startUrl).origin;
    const client = this.clients[origin];
    if (!client) return { kind: 'unavailable', code: 'issuer_source_unavailable', message: 'Issuer press-release domain is not allowlisted.' };
    try {
      const first = await client.get(startUrl, 'text/html,application/xhtml+xml');
      const documents = discoverIssuerPressReleases(new TextDecoder().decode(first.bytes), first.url, query);
      return documents.length ? { kind: 'found', value: documents.slice(0, 20) } : { kind: 'unavailable', code: 'issuer_source_unavailable', message: 'The issuer press-release page exposed no eligible release.' };
    } catch (error) {
      const outcome = unavailableOutcome<SourceDocumentRef[]>(error, 'Issuer press-release source failed.');
      return { kind: 'unavailable', code: outcome.kind === 'unavailable' && outcome.code === 'source_too_large' ? 'crawl_limit_exceeded' : 'issuer_source_unavailable', message: outcome.kind === 'found' ? 'Issuer press-release source failed.' : outcome.message };
    }
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    const client = this.clients[new URL(document.sourceUrl).origin];
    if (!client) return { kind: 'unavailable', code: 'source_access_denied', message: 'Press-release document left the trusted issuer domain.' };
    try {
      const result = await client.get(document.sourceUrl, 'text/html,application/xhtml+xml;q=0.9,application/pdf;q=0.8');
      return { kind: 'found', value: { ...document, sourceUrl: result.url, sourceFormat: result.contentType === 'application/pdf' || result.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html', rawBytes: result.bytes, retrievalTimestamp: new Date().toISOString(), contentType: result.contentType, httpStatus: result.status } };
    } catch (error) { return unavailableOutcome(error, 'Issuer press-release document fetch failed.'); }
  }
}

export function discoverIssuerPressReleases(html: string, pageUrl: string, query: SourceQuery): SourceDocumentRef[] {
  const page = new URL(pageUrl);
  const $ = load(html);
  const found: SourceDocumentRef[] = [];
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    let url: URL;
    try { url = new URL(href, pageUrl); } catch { return; }
    const redirected = url.searchParams.get('redirect');
    if (redirected) {
      try {
        const target = new URL(redirected);
        if (normalizeHost(target.hostname) === normalizeHost(page.hostname)) url = target;
      } catch { return; }
    }
    const container = $(element).closest('tr, article, li, section, [class*="press"], [class*="news"], [class*="announcement"]');
    const context = `${$(element).text()} ${$(element).attr('title') ?? ''} ${$(element).find('img').attr('alt') ?? ''} ${container.length ? container.first().text().slice(0, 2_000) : ''} ${url.pathname}`.toLowerCase();
    // Deliberately no .pdf-only filter (unlike discoverIssuerDocuments) — press
    // releases are typically HTML, not PDF.
    if (url.protocol !== 'https:' || normalizeHost(url.hostname) !== normalizeHost(page.hostname) || !PRESS_RELEASE_TERMS.some((term) => context.includes(term))) return;
    const date = context.match(/(20\d{2})[-_/]?(0[1-9]|1[0-2])[-_/]?([0-2]\d|3[01])/);
    found.push({
      documentId: url.pathname.split('/').at(-1) || url.toString(),
      market: query.market,
      ticker: query.ticker.toUpperCase(),
      sourceUrl: url.toString(),
      sourceName: `Issuer press release (${query.ticker.toUpperCase()})`,
      sourceTier: 'secondary',
      publishDate: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
      sourceFormat: 'html',
      discoveryUrl: pageUrl,
    });
  });
  return found;
}

function normalizeHost(host: string) { return host.toLowerCase().replace(/^www\./, ''); }
