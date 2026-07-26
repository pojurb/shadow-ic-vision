import type {
  DiscoveryCandidateUrl,
  DiscoveryOutcome,
  DiscoveryQuery,
  SearchDiscoveryProvider,
} from './types';

const SERPER_SEARCH_ENDPOINT = 'https://google.serper.dev/search';
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_TIMEOUT_MS = 15_000;

type SerperProviderOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
};

/**
 * M008 candidate provider: Serper.dev Google SERP API.
 *
 * Provides raw Google SERP access. Free signup issues 2,500 queries without
 * requiring a credit card.
 *
 * **R-013 Boundary Enforcement:**
 * Serper responses return `title`, `snippet`, `position`, and `attributes`.
 * This adapter plucks `link` from `organic` results and discards every text field
 * at the adapter boundary (see `toSerperCandidateUrls`). Snippet text never enters
 * the discovery candidate type system.
 */
export class SerperDiscoveryProvider implements SearchDiscoveryProvider {
  readonly providerId = 'serper';
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(options: SerperProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.SERPER_API_KEY ?? process.env.SEARCH_DISCOVERY_API_KEY ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.endpoint = options.endpoint ?? SERPER_SEARCH_ENDPOINT;
  }

  async search(query: DiscoveryQuery): Promise<DiscoveryOutcome> {
    if (!this.apiKey) {
      return { kind: 'unavailable', code: 'discovery_not_configured', message: 'No Serper API key is configured.' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          q: query.query,
          num: query.maxResults ?? DEFAULT_MAX_RESULTS,
          gl: query.market === 'ID' ? 'id' : 'us',
          hl: query.market === 'ID' ? 'id' : 'en',
        }),
      });

      if (response.status === 429) {
        return { kind: 'unavailable', code: 'discovery_rate_limited', message: 'Serper rate-limited the request.' };
      }
      if (response.status === 403 || response.status === 400) {
        return { kind: 'unavailable', code: 'discovery_quota_exhausted', message: 'Serper reported invalid API key or quota exhausted.' };
      }
      if (!response.ok) {
        return { kind: 'unavailable', code: 'discovery_http_error', message: `Serper returned HTTP ${response.status}.` };
      }

      const payload = (await response.json()) as unknown;
      return { kind: 'found', value: toSerperCandidateUrls(payload) };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      return timedOut
        ? { kind: 'unavailable', code: 'discovery_timeout', message: 'Serper request timed out.' }
        : { kind: 'unavailable', code: 'discovery_http_error', message: 'Serper request failed.' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Pure function enforcing R-013 boundary for Serper payloads.
 * Plucks `link` from `organic` results; discards `title`, `snippet`, `position`.
 */
export function toSerperCandidateUrls(payload: unknown): DiscoveryCandidateUrl[] {
  const root = asRecord(payload);
  const organic = root.organic;
  if (!Array.isArray(organic)) return [];

  const seen = new Set<string>();
  const candidates: DiscoveryCandidateUrl[] = [];

  for (const item of organic) {
    const rawUrl = asRecord(item).link;
    if (typeof rawUrl !== 'string') continue;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      const normalized = parsed.toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        candidates.push({ url: normalized });
      }
    } catch {
      continue;
    }
  }

  return candidates;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
