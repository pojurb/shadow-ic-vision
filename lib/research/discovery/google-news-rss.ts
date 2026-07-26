import type {
  DiscoveryCandidateUrl,
  DiscoveryOutcome,
  DiscoveryQuery,
  SearchDiscoveryProvider,
} from './types';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESULTS = 10;

type GoogleNewsRssProviderOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  resolveRedirects?: boolean;
};

/**
 * M008 candidate provider: Google News RSS Search Endpoint.
 *
 * Unauthenticated XML feed search query (`news.google.com/rss/search`).
 *
 * **R-013 & Terms Governance Note:**
 * This feed carries an explicit copyright notice in XML:
 * "This XML feed is made available solely for the purpose of rendering Google News
 * results within a personal feed reader for personal, non-commercial use."
 *
 * The adapter plucks `<link>` strings from items and discards all title,
 * snippet, description, and publication date elements at the boundary.
 *
 * Google News RSS links point to redirect wrappers (`https://news.google.com/rss/articles/...`).
 * When `resolveRedirects` is true (default), the adapter follows 302 redirects
 * via HTTP HEAD requests to extract canonical publisher URLs.
 */
export class GoogleNewsRssDiscoveryProvider implements SearchDiscoveryProvider {
  readonly providerId = 'google_news_rss';
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly resolveRedirects: boolean;

  constructor(options: GoogleNewsRssProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.resolveRedirects = options.resolveRedirects ?? true;
  }

  async search(query: DiscoveryQuery): Promise<DiscoveryOutcome> {
    const langParam = query.market === 'ID'
      ? 'hl=id&gl=ID&ceid=ID:id'
      : 'hl=en-US&gl=US&ceid=US:en';
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query.query)}&${langParam}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(rssUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) jp-invest/1.0',
        },
      });

      if (!response.ok) {
        return {
          kind: 'unavailable',
          code: 'discovery_http_error',
          message: `Google News RSS returned HTTP ${response.status}.`,
        };
      }

      const xmlText = await response.text();
      const rawUrls = extractRssItemLinks(xmlText, query.maxResults ?? DEFAULT_MAX_RESULTS);

      if (!this.resolveRedirects) {
        return { kind: 'found', value: rawUrls.map((url) => ({ url })) };
      }

      // Resolve 302 redirect wrappers to canonical publisher URLs
      const resolvedCandidates: DiscoveryCandidateUrl[] = [];
      const seen = new Set<string>();

      for (const rawUrl of rawUrls) {
        let targetUrl = rawUrl;
        try {
          const headRes = await this.fetchImpl(rawUrl, {
            method: 'HEAD',
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) jp-invest/1.0',
            },
          });
          if (headRes.url && !headRes.url.includes('news.google.com/rss/articles')) {
            targetUrl = headRes.url;
          }
        } catch {
          // If HEAD request fails, retain raw URL as candidate pointer
        }

        try {
          const parsed = new URL(targetUrl);
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            const normalized = parsed.toString();
            if (!seen.has(normalized)) {
              seen.add(normalized);
              resolvedCandidates.push({ url: normalized });
            }
          }
        } catch {
          continue;
        }
      }

      return { kind: 'found', value: resolvedCandidates };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      return timedOut
        ? { kind: 'unavailable', code: 'discovery_timeout', message: 'Google News RSS request timed out.' }
        : { kind: 'unavailable', code: 'discovery_http_error', message: 'Google News RSS request failed.' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Pure helper function to extract item link strings from Google News RSS XML.
 * Discards title, description, pubDate, and source metadata (R-013).
 */
export function extractRssItemLinks(xmlText: string, maxResults: number): string[] {
  const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const itemXml of itemMatches) {
    if (urls.length >= maxResults) break;
    // Extract the specific per-article link from <link>.
    // Discard bare domain roots from <source url="..."> (R-013 & accurate article candidate discovery).
    const linkMatch = itemXml.match(/<link>(https?:\/\/[^<]+)<\/link>/);
    const url = linkMatch?.[1]?.trim();

    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}
