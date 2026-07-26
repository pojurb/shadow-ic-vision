import { describe, expect, it } from 'vitest';
import { aggregateDiscoveryReports } from '@/scripts/eval-m008-discovery-aggregate';
import type { DiscoveryEvalReport, DiscoverySuite } from '@/scripts/eval-m008-discovery';

const suite: DiscoverySuite = {
  test_cases: [
    {
      id: 'DS-001',
      market: 'ID',
      ticker: 'BBRI',
      query: 'BBRI',
      expected_domains: ['ir-bri.com', 'bri.co.id'],
      deterministic_fixture: { expected_outcome: 'hit', urls: [] },
    },
    {
      id: 'DS-004',
      market: 'US',
      ticker: 'PLTR',
      query: 'PLTR',
      expected_domains: ['palantir.com'],
      deterministic_fixture: { expected_outcome: 'hit', urls: [] },
    },
  ],
};

function makeReport(caseResults: DiscoveryEvalReport['cases']): DiscoveryEvalReport {
  return {
    schemaVersion: 1,
    suite: 'M008-discovery-eval',
    completedAt: '2026-07-26T00:00:00.000Z',
    runMode: 'live',
    providerId: 'tavily',
    providerEligibility: 'not_evaluated',
    acceptanceOutcome: 'blocked',
    thresholds: { marketHitRate: 0.66, minUrlsPerCase: 1 },
    coverageByMarket: {
      US: { caseCount: 0, casesWithHit: 0, hitRate: 0, totalUrlsReturned: 0 },
      ID: { caseCount: 0, casesWithHit: 0, hitRate: 0, totalUrlsReturned: 0 },
    },
    summary: { totalCases: caseResults.length, passedCases: 0, failedCases: 0, unsupportedCases: 0 },
    hardGateFailures: [],
    cases: caseResults,
  };
}

describe('discovery eval aggregation', () => {
  it('recomputes outcome from raw returnedUrls rather than trusting a stale stored outcome', () => {
    // This report's stored outcome/matchedDomains reflect an OLD expected_domains
    // list that did not include ir-bri.com yet — exactly the real bug found in
    // this project's first live run. The aggregate must still count it as a hit
    // because ir-bri.com now matches, proving raw URLs are treated as truth.
    const staleReport = makeReport([
      {
        id: 'DS-001', market: 'ID', ticker: 'BBRI', status: 'failed', outcome: 'miss',
        returnedUrlCount: 1, matchedDomains: [], returnedUrls: ['https://www.ir-bri.com/news.html'],
        notes: [], hardGateFailures: [],
      },
    ]);

    const aggregate = aggregateDiscoveryReports([staleReport], suite);
    const bbri = aggregate.perCase.find((stat) => stat.id === 'DS-001');
    expect(bbri?.hits).toBe(1);
    expect(bbri?.misses).toBe(0);
    expect(bbri?.distinctMatchedDomainsAcrossRuns).toEqual(['ir-bri.com']);
  });

  it('aggregates hit rate across multiple runs and tracks the union of matched domains', () => {
    const run1 = makeReport([
      {
        id: 'DS-001', market: 'ID', ticker: 'BBRI', status: 'failed', outcome: 'miss',
        returnedUrlCount: 3, matchedDomains: [], returnedUrls: ['https://finance.yahoo.com/quote/BBRI.JK'],
        notes: [], hardGateFailures: [],
      },
    ]);
    const run2 = makeReport([
      {
        id: 'DS-001', market: 'ID', ticker: 'BBRI', status: 'passed', outcome: 'hit',
        returnedUrlCount: 2, matchedDomains: ['ir-bri.com'], returnedUrls: ['https://www.ir-bri.com/news.html', 'https://bri.co.id/report'],
        notes: [], hardGateFailures: [],
      },
    ]);

    const aggregate = aggregateDiscoveryReports([run1, run2], suite);
    const bbri = aggregate.perCase.find((stat) => stat.id === 'DS-001');
    expect(bbri).toMatchObject({ runCount: 2, hits: 1, misses: 1, unsupported: 0, hitRate: 0.5 });
    expect(bbri?.distinctMatchedDomainsAcrossRuns).toEqual(['bri.co.id', 'ir-bri.com']);
    expect(aggregate.totalCallsEstimate).toBe(2);
  });

  it('counts unavailable results as unsupported, excluded from the hit-rate denominator', () => {
    const run = makeReport([
      {
        id: 'DS-001', market: 'ID', ticker: 'BBRI', status: 'unsupported', outcome: 'unavailable',
        returnedUrlCount: 0, matchedDomains: [], returnedUrls: [], notes: [], hardGateFailures: [],
      },
    ]);
    const aggregate = aggregateDiscoveryReports([run], suite);
    const bbri = aggregate.perCase.find((stat) => stat.id === 'DS-001');
    expect(bbri).toMatchObject({ hits: 0, misses: 0, unsupported: 1, hitRate: null });
  });

  it('never blends markets: a perfect US run and a failing ID run stay in separate buckets', () => {
    const run = makeReport([
      {
        id: 'DS-001', market: 'ID', ticker: 'BBRI', status: 'failed', outcome: 'miss',
        returnedUrlCount: 1, matchedDomains: [], returnedUrls: ['https://finance.yahoo.com/quote/BBRI.JK'],
        notes: [], hardGateFailures: [],
      },
      {
        id: 'DS-004', market: 'US', ticker: 'PLTR', status: 'passed', outcome: 'hit',
        returnedUrlCount: 1, matchedDomains: ['palantir.com'], returnedUrls: ['https://www.palantir.com/newsroom'],
        notes: [], hardGateFailures: [],
      },
    ]);
    const aggregate = aggregateDiscoveryReports([run], suite);
    expect(aggregate.perMarket.ID.hitRate).toBe(0);
    expect(aggregate.perMarket.US.hitRate).toBe(1);
  });
});
