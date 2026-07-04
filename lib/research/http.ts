import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { SourceErrorCode } from './adapters/types';
import { ResearchSourceError } from './errors';

export type HttpResult = {
  url: string;
  status: number;
  contentType: string;
  bytes: Uint8Array;
};

type HttpClientOptions = {
  allowedHosts: string[];
  userAgent: string;
  logPath: string;
  timeoutMs?: number;
  maxAttempts?: number;
  maxBytes?: number;
  requestsPerSecond?: number;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
};

const hostLastRequestAt = new Map<string, number>();
const responseCache = new Map<string, { expiresAt: number; result: HttpResult }>();

export class OfficialHttpClient {
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly maxBytes: number;
  private readonly minimumIntervalMs: number;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly allowedHosts: Set<string>;

  constructor(private readonly options: HttpClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
    this.minimumIntervalMs = Math.ceil(1000 / (options.requestsPerSecond ?? 8));
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.allowedHosts = new Set(options.allowedHosts.map((host) => host.toLowerCase()));
  }

  async get(inputUrl: string, accept: string): Promise<HttpResult> {
    const cached = responseCache.get(inputUrl);
    if (cached && cached.expiresAt > this.now()) return cached.result;

    let url = this.validateUrl(inputUrl);
    let redirects = 0;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.limit(url.hostname);
      const startedAt = this.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          redirect: 'manual',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: accept,
            'Accept-Encoding': 'gzip, deflate',
            'User-Agent': this.options.userAgent,
          },
        });
        clearTimeout(timeout);

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) throw new ResearchSourceError('source_http_error', `Official source returned redirect ${response.status} without a location.`);
          redirects += 1;
          if (redirects > 5) throw new ResearchSourceError('source_redirect_blocked', 'Official source exceeded the five-redirect limit.');
          url = this.validateUrl(new URL(location, url).toString());
          this.log(url.toString(), response.status, attempt, startedAt);
          attempt -= 1;
          continue;
        }

        if (response.status === 404) {
          this.log(url.toString(), response.status, attempt, startedAt, 'source_not_found');
          throw new ResearchSourceError('source_not_found', 'The official source did not contain the requested document.');
        }

        if (response.status === 429 || response.status >= 500) {
          const code: SourceErrorCode = response.status === 429 ? 'source_rate_limited' : 'source_http_error';
          this.log(url.toString(), response.status, attempt, startedAt, code);
          if (attempt < this.maxAttempts) {
            await this.sleep(this.retryDelay(response.headers.get('retry-after'), attempt));
            continue;
          }
          throw new ResearchSourceError(code, `Official source remained unavailable after ${this.maxAttempts} attempts (HTTP ${response.status}).`);
        }

        if (!response.ok) {
          this.log(url.toString(), response.status, attempt, startedAt, 'source_http_error');
          throw new ResearchSourceError('source_http_error', `Official source returned HTTP ${response.status}.`);
        }

        const declaredSize = Number(response.headers.get('content-length') || 0);
        if (declaredSize > this.maxBytes) throw new ResearchSourceError('source_too_large', 'Official document exceeds the 25 MB M001 limit.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > this.maxBytes) throw new ResearchSourceError('source_too_large', 'Official document exceeds the 25 MB M001 limit.');

        const result: HttpResult = {
          url: url.toString(),
          status: response.status,
          contentType: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || 'application/octet-stream',
          bytes,
        };
        responseCache.set(inputUrl, { expiresAt: this.now() + this.cacheTtlMs, result });
        this.log(url.toString(), response.status, attempt, startedAt);
        return result;
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof ResearchSourceError) throw error;
        const timedOut = error instanceof Error && error.name === 'AbortError';
        const code: SourceErrorCode = timedOut ? 'source_timeout' : 'source_http_error';
        this.log(url.toString(), null, attempt, startedAt, code);
        if (attempt < this.maxAttempts) {
          await this.sleep(this.retryDelay(null, attempt));
          continue;
        }
        throw new ResearchSourceError(code, timedOut ? 'Official source timed out after 15 seconds.' : 'Official source request failed.');
      }
    }
    throw new ResearchSourceError('source_http_error', 'Official source request failed.');
  }

  private validateUrl(input: string): URL {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !this.allowedHosts.has(url.hostname.toLowerCase())) {
      throw new ResearchSourceError('source_redirect_blocked', `Blocked outbound source URL: ${url.hostname}`);
    }
    return url;
  }

  private async limit(host: string) {
    const last = hostLastRequestAt.get(host) ?? 0;
    const wait = this.minimumIntervalMs - (this.now() - last);
    if (wait > 0) await this.sleep(wait);
    hostLastRequestAt.set(host, this.now());
  }

  private retryDelay(retryAfter: string | null, attempt: number) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    return 250 * 2 ** (attempt - 1) + Math.floor(this.random() * 100);
  }

  private log(url: string, status: number | null, attempt: number, startedAt: number, errorCode?: SourceErrorCode) {
    fs.mkdirSync(path.dirname(this.options.logPath), { recursive: true });
    fs.appendFileSync(this.options.logPath, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      method: 'GET',
      url,
      status,
      attempt,
      durationMs: Math.max(0, this.now() - startedAt),
      errorCode: errorCode ?? null,
    })}\n`, 'utf8');
  }
}

export function resetHttpStateForTests() {
  hostLastRequestAt.clear();
  responseCache.clear();
}
