import { load } from 'cheerio';
import type { OfficialHttpClient } from '../http';
import { unavailableOutcome } from './helpers';
import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

type FeedItem = { title: string; link: string; publishDate: string | null; description: string };

/**
 * M007 Class B. No existing precedent to mirror — this is the first
 * feed-based (rather than page-crawl-based) adapter. Unlike
 * `IssuerPressReleaseAdapter`/`IssuerAdapter`, feed URLs are keyed by
 * publisher name, not ticker: one feed typically covers many tickers, so
 * `discover` fetches every configured feed and filters items by ticker
 * after parsing, rather than looking up a single per-ticker URL.
 *
 * **Known limitation, deliberately not solved here**: article links are only
 * fetchable if they resolve to the same origin as the feed URL itself (the
 * only origin `this.clients` allowlists). A feed whose articles live on a
 * different domain than the feed endpoint will fail closed
 * (`source_access_denied`) rather than silently trusting an unconfigured
 * domain — consistent with this milestone's domain-allowlisting constraint.
 *
 * **Known limitation, deliberately not solved here**: filtering is by ticker
 * symbol only (word-boundary match against title/description), not also by
 * company legal name as DEC-0015 §4 describes. Legal-name matching would
 * need either a new field on `SourceQuery` (used by every adapter) or a
 * separate ticker->legal-name map threaded through this adapter's
 * constructor — a larger, cross-cutting change deferred as a follow-up
 * rather than silently skipped.
 */
export class NewsWireAdapter implements SourceAdapter {
  readonly mode = 'live' as const;
  constructor(private readonly feedUrls: Record<string, string>, private readonly clients: Record<string, OfficialHttpClient>) {}

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    if (Object.keys(this.feedUrls).length === 0) {
      return { kind: 'unavailable', code: 'source_configuration', message: 'No news wire feed is configured.' };
    }

    const matches: SourceDocumentRef[] = [];
    let anyFeedFetched = false;
    for (const [publisherName, feedUrl] of Object.entries(this.feedUrls)) {
      const client = this.clients[new URL(feedUrl).origin];
      if (!client) continue;
      try {
        const result = await client.get(feedUrl, 'application/rss+xml,application/atom+xml,application/json;q=0.9,text/xml;q=0.8');
        anyFeedFetched = true;
        const items = parseNewsFeedItems(new TextDecoder().decode(result.bytes), result.contentType);
        for (const item of items) {
          if (!matchesTicker(item, query.ticker)) continue;
          let url: URL;
          try { url = new URL(item.link); } catch { continue; }
          matches.push({
            documentId: url.toString(),
            market: query.market,
            ticker: query.ticker.toUpperCase(),
            sourceUrl: url.toString(),
            sourceName: publisherName,
            sourceTier: 'secondary',
            publishDate: normalizePublishDate(item.publishDate),
            sourceFormat: 'html',
            discoveryUrl: feedUrl,
          });
        }
      } catch {
        // A single broken/unreachable feed must never block the others, and
        // must never fail the parent research job — the soft-failure
        // posture this milestone deliberately chose for secondary sources.
        continue;
      }
    }

    if (matches.length) return { kind: 'found', value: matches.slice(0, 20) };
    return anyFeedFetched
      ? { kind: 'unavailable', code: 'news_wire_source_unavailable', message: 'No configured news wire mentioned this ticker.' }
      : { kind: 'unavailable', code: 'news_wire_source_unavailable', message: 'No configured news wire feed was reachable.' };
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    const client = this.clients[new URL(document.sourceUrl).origin];
    if (!client) return { kind: 'unavailable', code: 'source_access_denied', message: 'News wire article left the allowlisted feed domain.' };
    try {
      const result = await client.get(document.sourceUrl, 'text/html,application/xhtml+xml');
      return { kind: 'found', value: { ...document, sourceUrl: result.url, sourceFormat: result.contentType === 'application/pdf' ? 'pdf' : 'html', rawBytes: result.bytes, retrievalTimestamp: new Date().toISOString(), contentType: result.contentType, httpStatus: result.status } };
    } catch (error) { return unavailableOutcome(error, 'News wire article fetch failed.'); }
  }
}

export function parseNewsFeedItems(feedText: string, contentType: string): FeedItem[] {
  const trimmed = feedText.trim();
  const looksJson = contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksJson) return parseJsonFeed(trimmed);

  const $ = load(feedText, { xmlMode: true });
  const items: FeedItem[] = [];
  $('item').each((_, element) => {
    const node = $(element);
    items.push({
      title: node.find('title').first().text().trim(),
      link: node.find('link').first().text().trim(),
      publishDate: node.find('pubDate').first().text().trim() || null,
      description: node.find('description').first().text().trim(),
    });
  });
  $('entry').each((_, element) => {
    const node = $(element);
    items.push({
      title: node.find('title').first().text().trim(),
      link: node.find('link').first().attr('href')?.trim() || node.find('link').first().text().trim(),
      publishDate: node.find('updated').first().text().trim() || node.find('published').first().text().trim() || null,
      description: node.find('summary').first().text().trim() || node.find('content').first().text().trim(),
    });
  });
  return items.filter((item) => item.link);
}

function parseJsonFeed(text: string): FeedItem[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const rows: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).items))
        ? (parsed as Record<string, unknown>).items as unknown[]
        : [];
    return rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row) => ({
        title: typeof row.title === 'string' ? row.title : '',
        link: typeof row.link === 'string' ? row.link : (typeof row.url === 'string' ? row.url : ''),
        publishDate: typeof row.pubDate === 'string' ? row.pubDate : (typeof row.publishDate === 'string' ? row.publishDate : null),
        description: typeof row.description === 'string' ? row.description : (typeof row.summary === 'string' ? row.summary : ''),
      }))
      .filter((item) => item.link);
  } catch {
    return [];
  }
}

function matchesTicker(item: FeedItem, ticker: string): boolean {
  const haystack = `${item.title} ${item.description}`;
  const pattern = new RegExp(`(^|[^a-z0-9])\\$?${escapeRegExp(ticker)}([^a-z0-9]|$)`, 'i');
  return pattern.test(haystack);
}

function normalizePublishDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
