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

/**
 * M010 (R-026). Identity of a link for repeat-counting and dedupe: origin +
 * pathname + search, hash stripped, trailing slash normalized. The hash is
 * dropped deliberately — `#search` and `#` self-links are the exact shapes that
 * made the discovery page itself win the `[0]` slot.
 */
function normalizeCandidateUrl(url: URL): string {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return `${url.origin}${path}${url.search}`;
}

const MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
  january: '01', february: '02', march: '03', may: '05', june: '06',
  july: '07', august: '08', october: '10', december: '12',
};

/**
 * M010 (R-026). `publishDate` was always `null` in practice: the previous
 * regex only matched `2026-07-21`-shaped dates, while real issuer anchors read
 * "21 Juli 2026". Without a date there is no recency signal, so `discover()`
 * could not prefer the newest release.
 */
function parsePublishDate(context: string): string | null {
  const iso = context.match(/(20\d{2})[-_/](0[1-9]|1[0-2])[-_/]([0-2]\d|3[01])/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = context.match(/\b([0-2]?\d|3[01])\s+([a-z]+)\s+(20\d{2})\b/);
  if (named) {
    const month = MONTHS[named[2]];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * M010 (R-026). Rejects listing/index/nav pages so a real article wins the
 * `[0]` slot that `CitationPipeline.executeResearchJob` actually fetches.
 *
 * Before this, the only constraint was "same-origin link whose *enclosing
 * container's* 2 KB of text mentions a press-release term" — near-vacuous on
 * any page whose sidebar says "Berita". On the real TLKM newsroom that returned
 * 29 refs whose first 13 were junk, with `[0]` being the discovery page itself.
 * The official path never had this defect only because `discoverIssuerDocuments`
 * requires a `.pdf` extension, which a listing page can never satisfy; the
 * secondary path deliberately dropped that filter for HTML press releases and
 * had nothing in its place.
 */
export function discoverIssuerPressReleases(html: string, pageUrl: string, query: SourceQuery): SourceDocumentRef[] {
  const page = new URL(pageUrl);
  const discoveryKey = normalizeCandidateUrl(page);
  const discoveryPath = page.pathname.replace(/\/+$/, '');
  const $ = load(html);

  // Rule 5 pre-pass: count every link's occurrences across the whole document
  // BEFORE filtering. Site chrome (desktop + mobile menus, breadcrumbs) repeats;
  // on the real newsroom page every nav link appeared 2-5x and all 9 genuine
  // article links appeared exactly once. This is the only rule that reaches
  // chrome whose URL shape is indistinguishable from an article's.
  const occurrences = new Map<string, number>();
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    try {
      const key = normalizeCandidateUrl(new URL(href, pageUrl));
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    } catch { /* unparseable href, ignored the same way the main pass ignores it */ }
  });

  const found: SourceDocumentRef[] = [];
  const seen = new Set<string>();
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
    if (url.protocol !== 'https:' || normalizeHost(url.hostname) !== normalizeHost(page.hostname)) return;

    const key = normalizeCandidateUrl(url);
    const candidatePath = url.pathname.replace(/\/+$/, '');

    // Rule 2 — self-link. The single highest-value rule: `#search`, `#`, and
    // bare self-links are what put the listing page in the `[0]` slot.
    if (key === discoveryKey) return;
    // Rule 3 — query-variant of the listing page (`?page=2`, `?kategori=...`).
    if (candidatePath === discoveryPath) return;
    // Rule 4 — ancestor of the listing page (e.g. `/sites/berita/id_ID`).
    // Deliberately NOT a path-depth rule: real articles here are SHALLOWER
    // than the listing page, so depth-based filtering would delete them all.
    if (candidatePath && discoveryPath.startsWith(`${candidatePath}/`)) return;
    // Rule 5 — repeated link is site chrome.
    if ((occurrences.get(key) ?? 0) > 1) return;

    const container = $(element).closest('tr, article, li, section, [class*="press"], [class*="news"], [class*="announcement"]');
    const containerText = container.length ? container.first().text().slice(0, 2_000) : '';
    // Rule 1 — the press-release term must appear on the LINK ITSELF (its text,
    // title, image alt, or path), not merely somewhere in its container. The
    // container text remains in play for date extraction only.
    const linkContext = `${$(element).text()} ${$(element).attr('title') ?? ''} ${$(element).find('img').attr('alt') ?? ''} ${url.pathname}`.toLowerCase();
    // Deliberately no .pdf-only filter (unlike discoverIssuerDocuments) — press
    // releases are typically HTML, not PDF.
    if (!PRESS_RELEASE_TERMS.some((term) => linkContext.includes(term))) return;

    // Dedupe before the caller's 20-result cap, which previously filled with
    // repeats of the same URL (the R-013 crowding caveat).
    if (seen.has(key)) return;
    seen.add(key);

    found.push({
      documentId: url.pathname.split('/').at(-1) || url.toString(),
      market: query.market,
      ticker: query.ticker.toUpperCase(),
      sourceUrl: url.toString(),
      sourceName: `Issuer press release (${query.ticker.toUpperCase()})`,
      sourceTier: 'secondary',
      publishDate: parsePublishDate(`${linkContext} ${containerText}`.toLowerCase()),
      sourceFormat: 'html',
      discoveryUrl: pageUrl,
    });
  });

  // Newest first, DOM order preserved among undated/equal-dated refs, so the
  // `[0]` the pipeline fetches is the most recent real release.
  return found
    .map((ref, index) => ({ ref, index }))
    .sort((left, right) => (right.ref.publishDate ?? '').localeCompare(left.ref.publishDate ?? '') || left.index - right.index)
    .map((entry) => entry.ref);
}

function normalizeHost(host: string) { return host.toLowerCase().replace(/^www\./, ''); }
