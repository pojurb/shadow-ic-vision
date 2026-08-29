import { load } from 'cheerio';
import type { OfficialHttpClient } from '../http';
import { unavailableOutcome } from './helpers';
import { classifyIssuerDocument } from './issuer';
import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

/**
 * A sibling to `IssuerAdapter` (`./issuer.ts`), not a parameterization of it
 * — the same convention `IssuerPressReleaseAdapter` already establishes, for
 * the same reason: reusing `IssuerAdapter` in place here would mean an
 * `evidenceClass: 'official'` pipeline extracts Info Memo content through
 * the lenient, `exact_verified`-eligible path, defeating DEC-0015 §2.2's
 * structural promotion barrier (R-010). This adapter is wired to the
 * existing `evidenceClass: 'secondary_issuer'` pipeline instance instead —
 * the exact machinery `IssuerPressReleaseAdapter` already uses.
 *
 * Reuses `IssuerAdapter`'s own source URLs (`ISSUER_SOURCE_URLS`) rather
 * than a new env var: Info Memo PDFs live on the same report-listing page as
 * the statutory filings, not on a separate press-release page. The page is
 * therefore fetched twice per research run — once per adapter — which
 * mirrors the existing, already-accepted cost of `issuerPr`/`newsWire` being
 * independent fetches, not a new pattern.
 */
/**
 * The `sourceName` prefix every Info Memo document carries, and the single
 * definition both the adapter and the decision-eligibility predicate below
 * read. Exported from the adapter that owns the definition so the two cannot
 * drift apart — the same reason `isIssuerReleaseUrl` lives in
 * `issuer-press.ts` rather than being reimplemented at its call site.
 */
export const INFO_MEMO_SOURCE_PREFIX = 'Issuer info memo';

/**
 * User decision, 2026-08-29: an Info Memo is **supplemental / display-only**.
 * It is shown in the research drawer as secondary evidence with its amber
 * badge, and it is excluded from the coverage ledger and from the thesis
 * verdict — it can never count toward `supports` or `contradicts`.
 *
 * The reasoning behind the choice: an Info Memo is IR-authored and
 * unaudited, and `DEC-0018` does not permit a silent change to what counts
 * as support. Admitting a new document class into the verdict's inputs
 * without an explicit decision is exactly that kind of silent change.
 *
 * Deliberately narrow. It excludes Info Memo rows ONLY — issuer press
 * releases and news-wire rows keep the decision-eligibility they already
 * had, because changing THEIR treatment would itself be the silent change
 * this guards against. It is also scoped to coverage and verdict alone:
 * `assumption-status.ts` is untouched, so the existing
 * `pending_confirmation` gate behaves exactly as before, and whether an
 * Info Memo should move an assumption's status is a separate question the
 * user has not been asked.
 */
export function isDecisionEligibleEvidence(row: { sourceName: string }): boolean {
  return !row.sourceName.startsWith(INFO_MEMO_SOURCE_PREFIX);
}

export class IssuerInfoMemoAdapter implements SourceAdapter {
  readonly mode = 'live' as const;
  constructor(private readonly sourceUrls: Record<string, string>, private readonly clients: Record<string, OfficialHttpClient>) {}

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    const startUrl = this.sourceUrls[query.ticker.toUpperCase()];
    if (!startUrl) return { kind: 'unavailable', code: 'issuer_source_unavailable', message: `No trusted issuer source is configured for ${query.ticker}.` };
    const origin = new URL(startUrl).origin;
    const client = this.clients[origin];
    if (!client) return { kind: 'unavailable', code: 'issuer_source_unavailable', message: 'Issuer domain is not allowlisted.' };
    try {
      const first = await client.get(startUrl, 'text/html,application/xhtml+xml');
      const documents = discoverIssuerInfoMemos(new TextDecoder().decode(first.bytes), first.url, query);
      return documents.length ? { kind: 'found', value: documents.slice(0, 20) } : { kind: 'unavailable', code: 'issuer_source_unavailable', message: 'The official issuer page exposed no eligible Info Memo document.' };
    } catch (error) {
      const outcome = unavailableOutcome<SourceDocumentRef[]>(error, 'Issuer Info Memo source failed.');
      return { kind: 'unavailable', code: outcome.kind === 'unavailable' && outcome.code === 'source_too_large' ? 'crawl_limit_exceeded' : 'issuer_source_unavailable', message: outcome.kind === 'found' ? 'Issuer Info Memo source failed.' : outcome.message };
    }
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    const client = this.clients[new URL(document.sourceUrl).origin];
    if (!client) return { kind: 'unavailable', code: 'source_access_denied', message: 'Issuer document left the trusted issuer domain.' };
    try {
      const result = await client.get(document.sourceUrl, 'application/pdf,text/html;q=0.9');
      return { kind: 'found', value: { ...document, sourceUrl: result.url, sourceFormat: result.contentType === 'application/pdf' || result.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html', rawBytes: result.bytes, retrievalTimestamp: new Date().toISOString(), contentType: result.contentType, httpStatus: result.status } };
    } catch (error) { return unavailableOutcome(error, 'Issuer Info Memo document fetch failed.'); }
  }
}

export function discoverIssuerInfoMemos(html: string, pageUrl: string, query: SourceQuery): SourceDocumentRef[] {
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
    if (url.protocol !== 'https:' || normalizeHost(url.hostname) !== normalizeHost(page.hostname) || !url.pathname.toLowerCase().endsWith('.pdf')) return;
    const container = $(element).closest('tr, article, li, section, [class*="report"], [class*="financial"]');
    const containerText = container.length ? container.first().text().slice(0, 2_000) : '';
    // Link-only classification, container for dates only — the identical rule
    // `discoverIssuerDocuments` applies, and it has to be identical: the two
    // lanes partition the same page, so a container leak in either one moves
    // documents across the tier boundary.
    const basename = url.pathname.split('/').at(-1) ?? '';
    const linkContext = `${$(element).text()} ${$(element).attr('title') ?? ''} ${$(element).find('img').attr('alt') ?? ''} ${basename}`.toLowerCase();
    if (classifyIssuerDocument(linkContext) !== 'tier2') return;
    const date = `${linkContext} ${containerText.toLowerCase()}`.match(/(20\d{2})[-_/]?(0[1-9]|1[0-2])[-_/]?([0-2]\d|3[01])/);
    found.push({ documentId: url.pathname.split('/').at(-1) || url.toString(), market: query.market, ticker: query.ticker.toUpperCase(), sourceUrl: url.toString(), sourceName: `${INFO_MEMO_SOURCE_PREFIX} (${query.ticker.toUpperCase()})`, sourceTier: 'secondary', publishDate: date ? `${date[1]}-${date[2]}-${date[3]}` : null, sourceFormat: 'pdf', discoveryUrl: pageUrl });
  });
  return found;
}

function normalizeHost(host: string) { return host.toLowerCase().replace(/^www\./, ''); }
