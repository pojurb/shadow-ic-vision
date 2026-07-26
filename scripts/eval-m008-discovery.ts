import './dotenv-quiet';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResearchMarket } from '@/lib/research/adapters/types';
import { getSearchDiscoveryApiKey } from '@/lib/research/config';
import { GoogleNewsRssDiscoveryProvider } from '@/lib/research/discovery/google-news-rss';
import { SerperDiscoveryProvider } from '@/lib/research/discovery/serper';
import { TavilyDiscoveryProvider } from '@/lib/research/discovery/tavily';
import type {
  DiscoveryCandidateUrl,
  DiscoveryOutcome,
  DiscoveryQuery,
  SearchDiscoveryProvider,
} from '@/lib/research/discovery/types';

const DEFAULT_CASES_PATH = path.join('docs', 'evals', 'M008', 'discovery-cases.json');

export type DiscoveryEvalMode = 'deterministic' | 'live';

type DeterministicFixture = {
  expected_outcome: 'hit' | 'miss';
  urls: string[];
  fixture_rationale?: string;
};

export type DiscoveryCase = {
  id: string;
  name?: string;
  market: ResearchMarket;
  ticker: string;
  query: string;
  expected_domains: string[];
  deterministic_fixture: DeterministicFixture;
};

export type DiscoverySuite = {
  milestone?: string;
  suite?: string;
  metadata?: {
    version?: string;
    grader_version?: string;
    case_count?: number;
    pass_thresholds?: {
      market_hit_rate?: number;
      min_urls_per_case?: number;
    };
  };
  test_cases: DiscoveryCase[];
};

export type DiscoveryEvalArgs = {
  mode: DiscoveryEvalMode;
  providerId: string;
  casesPath: string;
  outputPath: string;
};

type CaseStatus = 'passed' | 'failed' | 'unsupported';

export type DiscoveryEvalCaseResult = {
  id: string;
  market: ResearchMarket;
  ticker: string;
  status: CaseStatus;
  /** Did any returned URL sit on an expected domain? The coverage signal. */
  outcome: 'hit' | 'miss' | 'unavailable';
  returnedUrlCount: number;
  matchedDomains: string[];
  /**
   * Every URL the provider returned, retained verbatim. This is what a human
   * reads to tell "the provider genuinely cannot see this issuer" apart from
   * "the expected_domains list in the suite is wrong".
   */
  returnedUrls: string[];
  notes: string[];
  hardGateFailures: string[];
};

export type DiscoveryEvalReport = {
  schemaVersion: 1;
  suite: 'M008-discovery-eval';
  completedAt: string;
  runMode: DiscoveryEvalMode;
  providerId: string;
  /**
   * Mirrors `modelEligibility` in the M001 provider eval: a deterministic run
   * validates the harness and can never approve a vendor.
   */
  providerEligibility: 'not_evaluated' | 'accepted_for_poc';
  acceptanceOutcome: 'deterministic_only' | 'blocked' | 'ready_for_acceptance';
  thresholds: {
    marketHitRate: number;
    minUrlsPerCase: number;
  };
  /**
   * The number M008's provider decision actually turns on. Broken out by
   * market deliberately: averaging ID and US together would let strong US
   * coverage mask an Indonesian gap, which is the single open question this
   * suite exists to answer.
   */
  coverageByMarket: Record<ResearchMarket, {
    caseCount: number;
    casesWithHit: number;
    hitRate: number;
    totalUrlsReturned: number;
  }>;
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    unsupportedCases: number;
  };
  hardGateFailures: string[];
  cases: DiscoveryEvalCaseResult[];
};

type DiscoveryEvalDependencies = {
  provider?: SearchDiscoveryProvider;
  suite?: DiscoverySuite;
};

export function parseDiscoveryEvalArgs(args: string[]): DiscoveryEvalArgs {
  let mode: DiscoveryEvalMode = 'deterministic';
  let providerId = 'tavily';
  let casesPath: string | null = null;
  let outputPath: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--mode') {
      const next = args[index + 1];
      if (next !== 'deterministic' && next !== 'live') throw new Error(`Unsupported mode: ${next ?? '<missing>'}`);
      mode = next;
      index += 1;
      continue;
    }
    if (value === '--provider') {
      const next = args[index + 1];
      if (!next) throw new Error('Missing value for --provider');
      if (next !== 'tavily' && next !== 'google_news_rss' && next !== 'serper') {
        throw new Error(`Unsupported discovery provider: ${next}`);
      }
      providerId = next;
      index += 1;
      continue;
    }
    if (value === '--cases') {
      const next = args[index + 1];
      if (!next) throw new Error('Missing value for --cases');
      casesPath = next;
      index += 1;
      continue;
    }
    if (value === '--output') {
      const next = args[index + 1];
      if (!next) throw new Error('Missing value for --output');
      outputPath = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  const runId = `${new Date().toISOString().slice(0, 10)}-${providerId}-discovery-eval`;
  return {
    mode,
    providerId,
    casesPath: casesPath ?? DEFAULT_CASES_PATH,
    outputPath: outputPath ?? path.join('docs', 'evidence', 'releases', runId, 'm008-discovery-eval-report.json'),
  };
}

/**
 * Deterministic provider: replays each case's recorded fixture URLs. It never
 * touches the network and needs no API key, so the grading logic stays
 * verifiable in CI and in `npm test` without spending free-tier quota.
 */
export function createFixtureDiscoveryProvider(suite: DiscoverySuite): SearchDiscoveryProvider {
  const byTicker = new Map(suite.test_cases.map((testCase) => [testCase.ticker.toUpperCase(), testCase]));
  return {
    providerId: 'fixture',
    async search(query: DiscoveryQuery): Promise<DiscoveryOutcome> {
      const testCase = byTicker.get(query.ticker.toUpperCase());
      if (!testCase) {
        return { kind: 'unavailable', code: 'discovery_not_configured', message: `No fixture for ${query.ticker}.` };
      }
      return { kind: 'found', value: testCase.deterministic_fixture.urls.map((url) => ({ url })) };
    },
  };
}

export function instantiateDiscoveryProvider(providerId: string): SearchDiscoveryProvider {
  if (providerId === 'google_news_rss') {
    return new GoogleNewsRssDiscoveryProvider();
  }
  if (providerId === 'serper') {
    return new SerperDiscoveryProvider();
  }
  return new TavilyDiscoveryProvider({ apiKey: getSearchDiscoveryApiKey() });
}

export async function evaluateM008Discovery(
  rootDirectory: string,
  options: DiscoveryEvalArgs,
  dependencies: DiscoveryEvalDependencies = {},
): Promise<DiscoveryEvalReport> {
  const suite = dependencies.suite ?? readJson<DiscoverySuite>(path.resolve(rootDirectory, options.casesPath));
  const thresholds = {
    marketHitRate: suite.metadata?.pass_thresholds?.market_hit_rate ?? 0.67,
    minUrlsPerCase: suite.metadata?.pass_thresholds?.min_urls_per_case ?? 1,
  };

  const provider = dependencies.provider
    ?? (options.mode === 'deterministic'
      ? createFixtureDiscoveryProvider(suite)
      : instantiateDiscoveryProvider(options.providerId));

  const cases: DiscoveryEvalCaseResult[] = [];
  for (const testCase of suite.test_cases) {
    cases.push(await evaluateCase(testCase, provider, options.mode, thresholds.minUrlsPerCase));
  }

  const coverageByMarket = summarizeCoverage(cases);
  const hardGateFailures = cases.flatMap((result) => result.hardGateFailures);

  // Coverage gates only bind in live mode. A deterministic run replays fixtures
  // and therefore says nothing about a real vendor's reach — its only job is to
  // prove the grader reports hits and misses correctly.
  if (options.mode === 'live') {
    for (const market of ['ID', 'US'] as const) {
      const coverage = coverageByMarket[market];
      if (coverage.caseCount === 0) continue;
      if (coverage.casesWithHit === 0) {
        hardGateFailures.push(`${market}: provider returned no expected-domain match for any case`);
        continue;
      }
      if (coverage.hitRate < thresholds.marketHitRate) {
        hardGateFailures.push(
          `${market}: hit rate ${coverage.hitRate.toFixed(2)} is below the ${thresholds.marketHitRate} threshold`,
        );
      }
    }
  }

  const failedCases = cases.filter((result) => result.status === 'failed').length;
  const unsupportedCases = cases.filter((result) => result.status === 'unsupported').length;

  return {
    schemaVersion: 1,
    suite: 'M008-discovery-eval',
    completedAt: new Date().toISOString(),
    runMode: options.mode,
    providerId: options.mode === 'deterministic' ? provider.providerId : options.providerId,
    providerEligibility: 'not_evaluated',
    acceptanceOutcome: options.mode === 'deterministic'
      ? 'deterministic_only'
      : (hardGateFailures.length === 0 ? 'ready_for_acceptance' : 'blocked'),
    thresholds,
    coverageByMarket,
    summary: {
      totalCases: cases.length,
      passedCases: cases.filter((result) => result.status === 'passed').length,
      failedCases,
      unsupportedCases,
    },
    hardGateFailures,
    cases,
  };
}

async function evaluateCase(
  testCase: DiscoveryCase,
  provider: SearchDiscoveryProvider,
  mode: DiscoveryEvalMode,
  minUrlsPerCase: number,
): Promise<DiscoveryEvalCaseResult> {
  const notes: string[] = [];
  const hardGateFailures: string[] = [];

  const result = await provider.search({
    market: testCase.market,
    ticker: testCase.ticker,
    query: testCase.query,
  });

  if (result.kind === 'unavailable') {
    return {
      id: testCase.id,
      market: testCase.market,
      ticker: testCase.ticker,
      status: 'unsupported',
      outcome: 'unavailable',
      returnedUrlCount: 0,
      matchedDomains: [],
      returnedUrls: [],
      notes: [`Provider unavailable (${result.code}): ${result.message}`],
      hardGateFailures: [],
    };
  }

  const returnedUrls = result.value.map((candidate) => candidate.url);
  const matchedDomains = matchExpectedDomains(result.value, testCase.expected_domains);
  const outcome: 'hit' | 'miss' = matchedDomains.length > 0 ? 'hit' : 'miss';

  if (returnedUrls.length < minUrlsPerCase) {
    notes.push(`Provider returned ${returnedUrls.length} URL(s), below the per-case minimum of ${minUrlsPerCase}.`);
  }
  notes.push(outcome === 'hit'
    ? `Matched expected domain(s): ${matchedDomains.join(', ')}`
    : 'No returned URL sat on an expected domain. Inspect returnedUrls before concluding the provider cannot see this issuer — the expected_domains list may be wrong.');

  // Deterministic mode grades the grader, not the vendor: the recorded
  // expected_outcome is the assertion. Without this, every fixture case would
  // trivially "pass" and the suite could not detect a broken grader — the exact
  // defect found in the M001 multimodal suite during M007 Slice 7.
  let status: CaseStatus = 'passed';
  if (mode === 'deterministic') {
    const expected = testCase.deterministic_fixture.expected_outcome;
    if (outcome !== expected) {
      status = 'failed';
      hardGateFailures.push(`${testCase.id}: grader returned '${outcome}' but the fixture expects '${expected}'`);
      notes.push('Deterministic mismatch: the domain-matching logic no longer agrees with the recorded fixture expectation.');
    }
  } else if (outcome === 'miss') {
    status = 'failed';
  }

  return {
    id: testCase.id,
    market: testCase.market,
    ticker: testCase.ticker,
    status,
    outcome,
    returnedUrlCount: returnedUrls.length,
    matchedDomains,
    returnedUrls,
    notes,
    hardGateFailures,
  };
}

/**
 * Suffix-aware hostname match: `bri.co.id` matches `www.bri.co.id` and
 * `ir.bri.co.id`, but must not match `notbri.co.id`.
 */
export function matchExpectedDomains(candidates: DiscoveryCandidateUrl[], expectedDomains: string[]): string[] {
  const matched = new Set<string>();
  for (const candidate of candidates) {
    let hostname: string;
    try {
      hostname = new URL(candidate.url).hostname.toLowerCase();
    } catch {
      continue;
    }
    for (const rawDomain of expectedDomains) {
      const domain = rawDomain.toLowerCase();
      if (hostname === domain || hostname.endsWith(`.${domain}`)) matched.add(domain);
    }
  }
  return [...matched];
}

function summarizeCoverage(cases: DiscoveryEvalCaseResult[]): DiscoveryEvalReport['coverageByMarket'] {
  const markets: ResearchMarket[] = ['US', 'ID'];
  const entries = markets.map((market) => {
    const marketCases = cases.filter((result) => result.market === market);
    const casesWithHit = marketCases.filter((result) => result.outcome === 'hit').length;
    return [market, {
      caseCount: marketCases.length,
      casesWithHit,
      hitRate: marketCases.length === 0 ? 0 : casesWithHit / marketCases.length,
      totalUrlsReturned: marketCases.reduce((sum, result) => sum + result.returnedUrlCount, 0),
    }] as const;
  });
  return Object.fromEntries(entries) as DiscoveryEvalReport['coverageByMarket'];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseDiscoveryEvalArgs(process.argv.slice(2));
  const report = await evaluateM008Discovery(process.cwd(), options);
  const outputPath = path.resolve(process.cwd(), options.outputPath);
  writeJson(outputPath, report);
  process.stdout.write(`M008 discovery eval report: ${path.relative(process.cwd(), outputPath)}\n`);
  process.stdout.write(`  mode=${report.runMode} outcome=${report.acceptanceOutcome} hardGateFailures=${report.hardGateFailures.length}\n`);
  for (const market of ['ID', 'US'] as const) {
    const coverage = report.coverageByMarket[market];
    process.stdout.write(`  ${market}: ${coverage.casesWithHit}/${coverage.caseCount} cases hit (${(coverage.hitRate * 100).toFixed(0)}%), ${coverage.totalUrlsReturned} URLs returned\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main();
