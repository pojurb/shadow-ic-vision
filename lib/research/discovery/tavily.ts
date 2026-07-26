import fs from 'node:fs';
import path from 'node:path';
import type {
  DiscoveryCandidateUrl,
  DiscoveryErrorCode,
  DiscoveryOutcome,
  DiscoveryQuery,
  SearchDiscoveryProvider,
} from './types';

const TAVILY_SEARCH_ENDPOINT = 'https://api.tavily.com/search';
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_TIMEOUT_MS = 15_000;

type TavilyProviderOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
  /**
   * Gap found in M008 packet review: this provider previously called `fetch`
   * directly with no outbound record, unlike every Class A/B/official fetch
   * (`OfficialHttpClient`'s private `log()`), which is a real ADR-0006
   * transparency miss, not a nit. When set, every attempted request (success
   * or failure — but not the `discovery_not_configured` short-circuit, which
   * never reaches the network) appends one line to this path. Optional so
   * existing unit tests that construct this provider directly, without a
   * log path, are unaffected; production wiring must always supply one.
   */
  logPath?: string;
};

/**
 * M008 candidate provider #1.
 *
 * Chosen for evaluation because it is the only surveyed search API with a
 * recurring no-credit-card free tier (1,000 credits/month) rather than a
 * one-time allocation that later requires payment details. See the M008
 * packet for the full vendor comparison.
 *
 * **Tavily returns pre-summarized page content by default** (`content`, and
 * `raw_content` when requested). That is precisely the R-013 hazard, so this
 * adapter never reads those fields — see `toDiscoveryCandidateUrls`. The
 * request also sets `include_raw_content: false` so the bytes are not even
 * transferred; the mapper is the guarantee, the request flag is the courtesy.
 */
export class TavilyDiscoveryProvider implements SearchDiscoveryProvider {
  readonly providerId = 'tavily';
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly endpoint: string;
  private readonly logPath: string | undefined;

  constructor(private readonly options: TavilyProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.endpoint = options.endpoint ?? TAVILY_SEARCH_ENDPOINT;
    this.logPath = options.logPath;
  }

  async search(query: DiscoveryQuery): Promise<DiscoveryOutcome> {
    if (!this.options.apiKey) {
      return { kind: 'unavailable', code: 'discovery_not_configured', message: 'No Tavily API key is configured.' };
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          query: query.query,
          max_results: query.maxResults ?? DEFAULT_MAX_RESULTS,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
        }),
      });

      if (response.status === 429) {
        this.log(response.status, startedAt, 'discovery_rate_limited');
        return { kind: 'unavailable', code: 'discovery_rate_limited', message: 'Tavily rate-limited the request.' };
      }
      if (response.status === 432 || response.status === 402) {
        this.log(response.status, startedAt, 'discovery_quota_exhausted');
        return { kind: 'unavailable', code: 'discovery_quota_exhausted', message: 'Tavily reported the monthly credit allowance is exhausted.' };
      }
      if (!response.ok) {
        this.log(response.status, startedAt, 'discovery_http_error');
        return { kind: 'unavailable', code: 'discovery_http_error', message: `Tavily returned HTTP ${response.status}.` };
      }

      const payload = (await response.json()) as unknown;
      this.log(response.status, startedAt);
      return { kind: 'found', value: toDiscoveryCandidateUrls(payload) };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      this.log(null, startedAt, timedOut ? 'discovery_timeout' : 'discovery_http_error');
      return timedOut
        ? { kind: 'unavailable', code: 'discovery_timeout', message: 'Tavily request timed out.' }
        : { kind: 'unavailable', code: 'discovery_http_error', message: 'Tavily request failed.' };
    } finally {
      clearTimeout(timeout);
    }
  }

  private log(status: number | null, startedAt: number, errorCode?: DiscoveryErrorCode) {
    if (!this.logPath) return;
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
    fs.appendFileSync(this.logPath, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      method: 'POST',
      url: this.endpoint,
      provider: this.providerId,
      status,
      durationMs: Math.max(0, Date.now() - startedAt),
      errorCode: errorCode ?? null,
    })}\n`, 'utf8');
  }
}

/**
 * The R-013 boundary, as a pure function so it can be tested adversarially.
 *
 * Reads `url` and nothing else. `title`, `content`, `raw_content`, and `score`
 * are dropped here and never reach a `DiscoveryCandidateUrl` — which has no
 * field capable of holding them. Exported so a test can feed it a response
 * dense with snippet text and assert none of that text survives.
 */
export function toDiscoveryCandidateUrls(payload: unknown): DiscoveryCandidateUrl[] {
  const rows = asRecord(payload).results;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const candidates: DiscoveryCandidateUrl[] = [];
  for (const row of rows) {
    const rawUrl = asRecord(row).url;
    if (typeof rawUrl !== 'string') continue;
    let normalized: string;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') continue;
      normalized = parsed.toString();
    } catch {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({ url: normalized });
  }
  return candidates;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
