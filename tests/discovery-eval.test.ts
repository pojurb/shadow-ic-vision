import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GoogleNewsRssDiscoveryProvider } from '@/lib/research/discovery/google-news-rss';
import { SerperDiscoveryProvider } from '@/lib/research/discovery/serper';
import { TavilyDiscoveryProvider, toDiscoveryCandidateUrls } from '@/lib/research/discovery/tavily';
import type { DiscoveryOutcome, SearchDiscoveryProvider } from '@/lib/research/discovery/types';
import {
  evaluateM008Discovery,
  matchExpectedDomains,
  parseDiscoveryEvalArgs,
  type DiscoveryCase,
  type DiscoverySuite,
} from '@/scripts/eval-m008-discovery';

const CASES_PATH = path.join('docs', 'evals', 'M008', 'discovery-cases.json');

function readSuite(): DiscoverySuite {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), CASES_PATH), 'utf8')) as DiscoverySuite;
}

function stubProvider(urlsByTicker: Record<string, string[]>): SearchDiscoveryProvider {
  return {
    providerId: 'stub',
    async search(query): Promise<DiscoveryOutcome> {
      const urls = urlsByTicker[query.ticker.toUpperCase()];
      if (!urls) return { kind: 'unavailable', code: 'discovery_http_error', message: 'stub miss' };
      return { kind: 'found', value: urls.map((url) => ({ url })) };
    },
  };
}

describe('R-013 structural gate: snippet text cannot survive discovery', () => {
  it('drops every text field a search provider returns, keeping only the URL', () => {
    const snippet = 'Revenue grew 42% year over year, according to the filing.';
    const candidates = toDiscoveryCandidateUrls({
      results: [
        {
          url: 'https://www.bri.co.id/investor-relations',
          title: 'BRI reports record quarterly profit',
          content: snippet,
          raw_content: `${snippet} Full page body follows...`,
          score: 0.98,
        },
      ],
    });

    expect(candidates).toEqual([{ url: 'https://www.bri.co.id/investor-relations' }]);
    // The invariant that matters: no snippet text anywhere in the output, and
    // no field capable of holding it.
    expect(Object.keys(candidates[0])).toEqual(['url']);
    expect(JSON.stringify(candidates)).not.toContain('Revenue grew');
    expect(JSON.stringify(candidates)).not.toContain('record quarterly profit');
  });

  it('holds even when the provider returns nothing but text and a URL is the only usable field', () => {
    const candidates = toDiscoveryCandidateUrls({
      results: [
        { title: 'No URL here', content: 'ignore me' },
        { url: 'https://www.idx.co.id/en/listed-companies', content: 'ignore me too' },
      ],
    });
    expect(candidates).toEqual([{ url: 'https://www.idx.co.id/en/listed-companies' }]);
  });

  it('rejects non-https and duplicate URLs, and tolerates a malformed payload', () => {
    const candidates = toDiscoveryCandidateUrls({
      results: [
        { url: 'http://insecure.example.com/a' },
        { url: 'https://www.idx.co.id/a' },
        { url: 'https://www.idx.co.id/a' },
        { url: 'not-a-url' },
      ],
    });
    expect(candidates).toEqual([{ url: 'https://www.idx.co.id/a' }]);
    expect(toDiscoveryCandidateUrls(null)).toEqual([]);
    expect(toDiscoveryCandidateUrls({ results: 'nope' })).toEqual([]);
  });
});

describe('expected-domain matching', () => {
  it('matches a bare domain and its subdomains but not a lookalike', () => {
    const matched = matchExpectedDomains(
      [
        { url: 'https://ir.bri.co.id/page' },
        { url: 'https://bri.co.id/page' },
        { url: 'https://notbri.co.id/page' },
      ],
      ['bri.co.id'],
    );
    expect(matched).toEqual(['bri.co.id']);
  });

  it('reports no match when nothing sits on an expected domain', () => {
    const matched = matchExpectedDomains([{ url: 'https://aggregator.example.com/quote/ACES' }], ['acehardware.co.id']);
    expect(matched).toEqual([]);
  });
});

describe('discovery eval harness', () => {
  it('ships a suite covering both markets with a US control group', () => {
    const suite = readSuite();
    expect(suite.test_cases).toHaveLength(suite.metadata?.case_count ?? -1);
    expect(suite.test_cases.filter((testCase) => testCase.market === 'ID').length).toBeGreaterThanOrEqual(2);
    expect(suite.test_cases.filter((testCase) => testCase.market === 'US').length).toBeGreaterThanOrEqual(2);
  });

  it('includes at least one fixture expecting a miss, so deterministic mode can actually fail', () => {
    const suite = readSuite();
    const misses = suite.test_cases.filter((testCase) => testCase.deterministic_fixture.expected_outcome === 'miss');
    expect(misses.length).toBeGreaterThanOrEqual(1);
  });

  it('passes deterministic mode against the shipped fixtures and approves no provider', async () => {
    const report = await evaluateM008Discovery(process.cwd(), parseDiscoveryEvalArgs([]));
    expect(report.hardGateFailures).toEqual([]);
    expect(report.summary.failedCases).toBe(0);
    expect(report.runMode).toBe('deterministic');
    expect(report.acceptanceOutcome).toBe('deterministic_only');
    expect(report.providerEligibility).toBe('not_evaluated');
  });

  it('fails the deterministic run when the grader stops agreeing with a fixture', async () => {
    const suite = readSuite();
    // Flip the recorded expectation on the miss case; the grader still reports
    // a miss, so the run must now report a hard-gate failure.
    const tampered: DiscoverySuite = {
      ...suite,
      test_cases: suite.test_cases.map((testCase): DiscoveryCase =>
        testCase.deterministic_fixture.expected_outcome === 'miss'
          ? { ...testCase, deterministic_fixture: { ...testCase.deterministic_fixture, expected_outcome: 'hit' } }
          : testCase,
      ),
    };

    const report = await evaluateM008Discovery(process.cwd(), parseDiscoveryEvalArgs([]), { suite: tampered });
    expect(report.hardGateFailures.length).toBeGreaterThan(0);
    expect(report.summary.failedCases).toBeGreaterThan(0);
  });

  it('reports ID and US coverage separately so strong US results cannot mask an Indonesian gap', async () => {
    const suite = readSuite();
    const usOnly = stubProvider(Object.fromEntries(
      suite.test_cases.map((testCase) => [
        testCase.ticker,
        testCase.market === 'US' ? testCase.deterministic_fixture.urls : ['https://aggregator.example.com/quote'],
      ]),
    ));

    const report = await evaluateM008Discovery(
      process.cwd(),
      { ...parseDiscoveryEvalArgs([]), mode: 'live' },
      { suite, provider: usOnly },
    );

    expect(report.coverageByMarket.US.hitRate).toBe(1);
    expect(report.coverageByMarket.ID.hitRate).toBe(0);
    expect(report.acceptanceOutcome).toBe('blocked');
    expect(report.hardGateFailures.some((failure) => failure.startsWith('ID:'))).toBe(true);
    expect(report.hardGateFailures.some((failure) => failure.startsWith('US:'))).toBe(false);
  });

  it('records returned URLs even on a miss, so a wrong expectation is distinguishable from real absence', async () => {
    const suite = readSuite();
    const provider = stubProvider(Object.fromEntries(
      suite.test_cases.map((testCase) => [testCase.ticker, ['https://aggregator.example.com/quote/X']]),
    ));

    const report = await evaluateM008Discovery(
      process.cwd(),
      { ...parseDiscoveryEvalArgs([]), mode: 'live' },
      { suite, provider },
    );

    expect(report.cases.every((result) => result.outcome === 'miss')).toBe(true);
    expect(report.cases.every((result) => result.returnedUrls.length === 1)).toBe(true);
  });

  it('records an unavailable provider as unsupported rather than as a coverage failure', async () => {
    const suite = readSuite();
    const report = await evaluateM008Discovery(
      process.cwd(),
      { ...parseDiscoveryEvalArgs([]), mode: 'live' },
      { suite, provider: stubProvider({}) },
    );

    expect(report.summary.unsupportedCases).toBe(suite.test_cases.length);
    expect(report.summary.failedCases).toBe(0);
    expect(report.cases.every((result) => result.outcome === 'unavailable')).toBe(true);
  });
});

describe('Tavily provider', () => {
  it('fails closed without an API key and never calls the network', async () => {
    let called = false;
    const provider = new TavilyDiscoveryProvider({
      apiKey: '',
      fetchImpl: (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch,
    });
    const result = await provider.search({ market: 'ID', ticker: 'BBRI', query: 'BBRI' });
    expect(result).toEqual({ kind: 'unavailable', code: 'discovery_not_configured', message: 'No Tavily API key is configured.' });
    expect(called).toBe(false);
  });

  it('requests no raw content and maps a real-shaped response to URLs only', async () => {
    let capturedBody: Record<string, unknown> = {};
    const provider = new TavilyDiscoveryProvider({
      apiKey: 'tvly-test',
      fetchImpl: (async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({
          results: [{ url: 'https://www.bri.co.id/ir', title: 'T', content: 'snippet body' }],
        }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    const result = await provider.search({ market: 'ID', ticker: 'BBRI', query: 'BBRI laporan keuangan' });
    expect(capturedBody.include_raw_content).toBe(false);
    expect(capturedBody.include_answer).toBe(false);
    expect(result).toEqual({ kind: 'found', value: [{ url: 'https://www.bri.co.id/ir' }] });
  });

  it('distinguishes quota exhaustion and rate limiting from a generic HTTP failure', async () => {
    const withStatus = (status: number) => new TavilyDiscoveryProvider({
      apiKey: 'tvly-test',
      fetchImpl: (async () => new Response('{}', { status })) as unknown as typeof fetch,
    }).search({ market: 'US', ticker: 'PLTR', query: 'PLTR' });

    expect(await withStatus(429)).toMatchObject({ code: 'discovery_rate_limited' });
    expect(await withStatus(432)).toMatchObject({ code: 'discovery_quota_exhausted' });
    expect(await withStatus(500)).toMatchObject({ code: 'discovery_http_error' });
  });

  // M008 packet §6 review gap: unlike every Class A/B/official fetch, this
  // provider used to call `fetch` directly with zero outbound record —
  // an ADR-0006 transparency miss. These two tests prove the fix: a
  // successful and a failed call each append one line to `logPath`.
  describe('outbound logging (ADR-0006 gap fix)', () => {
    const logPath = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-tavily-log-')), 'outbound.log');

    it('logs a successful search', async () => {
      const file = logPath();
      const provider = new TavilyDiscoveryProvider({
        apiKey: 'tvly-test',
        logPath: file,
        fetchImpl: (async () => new Response(JSON.stringify({ results: [{ url: 'https://www.bri.co.id/ir' }] }), { status: 200 })) as unknown as typeof fetch,
      });
      await provider.search({ market: 'ID', ticker: 'BBRI', query: 'BBRI' });

      const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
      expect(lines).toHaveLength(1);
      const entry = JSON.parse(lines[0]);
      expect(entry).toMatchObject({ provider: 'tavily', status: 200, errorCode: null });
      expect(entry.url).toContain('api.tavily.com');
    });

    it('logs a failed search too', async () => {
      const file = logPath();
      const provider = new TavilyDiscoveryProvider({
        apiKey: 'tvly-test',
        logPath: file,
        fetchImpl: (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch,
      });
      await provider.search({ market: 'US', ticker: 'PLTR', query: 'PLTR' });

      const entry = JSON.parse(fs.readFileSync(file, 'utf8').trim());
      expect(entry).toMatchObject({ provider: 'tavily', status: 500, errorCode: 'discovery_http_error' });
    });

    it('never writes a log line for the discovery_not_configured short-circuit — no request was ever attempted', async () => {
      const file = logPath();
      const provider = new TavilyDiscoveryProvider({ apiKey: '', logPath: file });
      await provider.search({ market: 'US', ticker: 'PLTR', query: 'PLTR' });
      expect(fs.existsSync(file)).toBe(false);
    });
  });
});

describe('Google News RSS provider', () => {
  it('parses RSS XML item links and enforces R-013 by extracting only URLs', async () => {
    const xmlMock = `
      <rss version="2.0">
        <channel>
          <item>
            <title>BBRI Cetak Laba Record</title>
            <link>https://news.google.com/rss/articles/CBM11234</link>
            <pubDate>Sun, 26 Jul 2026 00:00:00 GMT</pubDate>
            <description>Laporan keuangan BRI Q2 2026 tumbuh pesat.</description>
          </item>
        </channel>
      </rss>
    `;

    const provider = new GoogleNewsRssDiscoveryProvider({
      resolveRedirects: false,
      fetchImpl: (async () => new Response(xmlMock, { status: 200 })) as unknown as typeof fetch,
    });

    const result = await provider.search({ market: 'ID', ticker: 'BBRI', query: 'BBRI laporan keuangan' });
    expect(result).toEqual({
      kind: 'found',
      value: [{ url: 'https://news.google.com/rss/articles/CBM11234' }],
    });
    expect(JSON.stringify(result)).not.toContain('Cetak Laba');
    expect(JSON.stringify(result)).not.toContain('tumbuh pesat');
  });

  it('resolves 302 redirects to publisher canonical URLs', async () => {
    const xmlMock = `
      <rss version="2.0">
        <channel>
          <item>
            <link>https://news.google.com/rss/articles/CBM11234</link>
          </item>
        </channel>
      </rss>
    `;

    const provider = new GoogleNewsRssDiscoveryProvider({
      resolveRedirects: true,
      fetchImpl: (async (url: string, init?: RequestInit) => {
        if (init?.method === 'HEAD') {
          return { url: 'https://www.investor.id/market/12345/bbri-kinerja' } as unknown as Response;
        }
        return new Response(xmlMock, { status: 200 });
      }) as unknown as typeof fetch,
    });

    const result = await provider.search({ market: 'ID', ticker: 'BBRI', query: 'BBRI' });
    expect(result).toEqual({
      kind: 'found',
      value: [{ url: 'https://www.investor.id/market/12345/bbri-kinerja' }],
    });
  });
});

describe('Serper provider', () => {
  it('fails closed without an API key', async () => {
    let called = false;
    const provider = new SerperDiscoveryProvider({
      apiKey: '',
      fetchImpl: (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch,
    });
    const result = await provider.search({ market: 'ID', ticker: 'BBRI', query: 'BBRI' });
    expect(result).toEqual({ kind: 'unavailable', code: 'discovery_not_configured', message: 'No Serper API key is configured.' });
    expect(called).toBe(false);
  });

  it('plucks link property and enforces R-013 structural gate', async () => {
    const provider = new SerperDiscoveryProvider({
      apiKey: 'serper-test-key',
      fetchImpl: (async () => new Response(JSON.stringify({
        organic: [
          { title: 'BRI Corporate', link: 'https://www.bri.co.id', snippet: 'Bank Rakyat Indonesia' },
        ],
      }), { status: 200 })) as unknown as typeof fetch,
    });

    const result = await provider.search({ market: 'ID', ticker: 'BBRI', query: 'BBRI' });
    expect(result).toEqual({
      kind: 'found',
      value: [{ url: 'https://www.bri.co.id/' }],
    });
    expect(JSON.stringify(result)).not.toContain('BRI Corporate');
    expect(JSON.stringify(result)).not.toContain('Bank Rakyat Indonesia');
  });
});

