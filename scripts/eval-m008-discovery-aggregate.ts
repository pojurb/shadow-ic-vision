import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResearchMarket } from '@/lib/research/adapters/types';
import { matchExpectedDomains } from './eval-m008-discovery';
import type { DiscoveryEvalReport, DiscoverySuite } from './eval-m008-discovery';

const DEFAULT_CASES_PATH = path.join('docs', 'evals', 'M008', 'discovery-cases.json');
const DEFAULT_REPORTS_DIR = path.join('test-results');
const DEFAULT_REPORTS_PATTERN = /^m008-discovery-live-\d+\.json$/;

export type AggregateCaseStat = {
  id: string;
  market: ResearchMarket;
  ticker: string;
  runCount: number;
  hits: number;
  misses: number;
  unsupported: number;
  /** hits / (hits + misses). null when every run was unsupported. */
  hitRate: number | null;
  /** Union of matched domains seen across all runs, not just the latest. */
  distinctMatchedDomainsAcrossRuns: string[];
  avgReturnedUrlCount: number;
};

export type AggregateReport = {
  schemaVersion: 1;
  suite: 'M008-discovery-eval-aggregate';
  generatedAt: string;
  /**
   * Every stat below is recomputed from each report's raw `returnedUrls`
   * against the CURRENT `discovery-cases.json` expected_domains list — never
   * from a report's own stored `outcome`/`matchedDomains`. A report generated
   * before an expected_domains fix (e.g. before ir-bri.com was added for
   * BBRI) would otherwise silently drag a stale judgment into the aggregate.
   * Raw URLs are truth; derived verdicts are not, once the suite has moved on.
   */
  recomputedAgainstCasesPath: string;
  reportsIncluded: string[];
  totalRuns: number;
  /** Number of provider calls represented — one per case per report. */
  totalCallsEstimate: number;
  perCase: AggregateCaseStat[];
  perMarket: Record<ResearchMarket, {
    totalHits: number;
    totalMisses: number;
    totalUnsupported: number;
    hitRate: number | null;
  }>;
};

type CaseRunSample = {
  status: 'hit' | 'miss' | 'unsupported';
  matchedDomains: string[];
  returnedUrlCount: number;
};

export function aggregateDiscoveryReports(
  reports: DiscoveryEvalReport[],
  suite: DiscoverySuite,
): AggregateReport {
  const expectedDomainsById = new Map(suite.test_cases.map((testCase) => [testCase.id, testCase.expected_domains]));
  const samplesById = new Map<string, CaseRunSample[]>();
  const marketById = new Map<string, ResearchMarket>();
  const tickerById = new Map<string, string>();

  for (const report of reports) {
    for (const caseResult of report.cases) {
      marketById.set(caseResult.id, caseResult.market);
      tickerById.set(caseResult.id, caseResult.ticker);
      const expectedDomains = expectedDomainsById.get(caseResult.id) ?? [];

      let sample: CaseRunSample;
      if (caseResult.outcome === 'unavailable' || caseResult.returnedUrls.length === 0) {
        sample = { status: 'unsupported', matchedDomains: [], returnedUrlCount: caseResult.returnedUrlCount };
      } else {
        const matched = matchExpectedDomains(
          caseResult.returnedUrls.map((url) => ({ url })),
          expectedDomains,
        );
        sample = {
          status: matched.length > 0 ? 'hit' : 'miss',
          matchedDomains: matched,
          returnedUrlCount: caseResult.returnedUrlCount,
        };
      }

      const existing = samplesById.get(caseResult.id) ?? [];
      existing.push(sample);
      samplesById.set(caseResult.id, existing);
    }
  }

  const perCase: AggregateCaseStat[] = [...samplesById.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, samples]) => {
      const hits = samples.filter((sample) => sample.status === 'hit').length;
      const misses = samples.filter((sample) => sample.status === 'miss').length;
      const unsupported = samples.filter((sample) => sample.status === 'unsupported').length;
      const distinctMatchedDomainsAcrossRuns = [...new Set(samples.flatMap((sample) => sample.matchedDomains))].sort();
      return {
        id,
        market: marketById.get(id) as ResearchMarket,
        ticker: tickerById.get(id) as string,
        runCount: samples.length,
        hits,
        misses,
        unsupported,
        hitRate: hits + misses === 0 ? null : hits / (hits + misses),
        distinctMatchedDomainsAcrossRuns,
        avgReturnedUrlCount: average(samples.map((sample) => sample.returnedUrlCount)),
      };
    });

  const perMarket = summarizeMarkets(perCase);

  return {
    schemaVersion: 1,
    suite: 'M008-discovery-eval-aggregate',
    generatedAt: new Date().toISOString(),
    recomputedAgainstCasesPath: DEFAULT_CASES_PATH,
    reportsIncluded: [],
    totalRuns: reports.length,
    totalCallsEstimate: reports.reduce((sum, report) => sum + report.cases.length, 0),
    perCase,
    perMarket,
  };
}

function summarizeMarkets(perCase: AggregateCaseStat[]): AggregateReport['perMarket'] {
  const markets: ResearchMarket[] = ['US', 'ID'];
  const entries = markets.map((market) => {
    const marketCases = perCase.filter((stat) => stat.market === market);
    const totalHits = marketCases.reduce((sum, stat) => sum + stat.hits, 0);
    const totalMisses = marketCases.reduce((sum, stat) => sum + stat.misses, 0);
    const totalUnsupported = marketCases.reduce((sum, stat) => sum + stat.unsupported, 0);
    return [market, {
      totalHits,
      totalMisses,
      totalUnsupported,
      hitRate: totalHits + totalMisses === 0 ? null : totalHits / (totalHits + totalMisses),
    }] as const;
  });
  return Object.fromEntries(entries) as AggregateReport['perMarket'];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function findReportFiles(rootDirectory: string): string[] {
  const dir = path.resolve(rootDirectory, DEFAULT_REPORTS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => DEFAULT_REPORTS_PATTERN.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

async function main() {
  const rootDirectory = process.cwd();
  const explicitPaths = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const reportPaths = explicitPaths.length > 0
    ? explicitPaths.map((relative) => path.resolve(rootDirectory, relative))
    : findReportFiles(rootDirectory);

  if (reportPaths.length === 0) {
    throw new Error(`No m008-discovery-live-*.json reports found under ${DEFAULT_REPORTS_DIR}. Run 'npm run eval:m008:discovery -- --mode live' first.`);
  }

  const suite = readJson<DiscoverySuite>(path.resolve(rootDirectory, DEFAULT_CASES_PATH));
  const reports = reportPaths.map((filePath) => readJson<DiscoveryEvalReport>(filePath));
  const aggregate = aggregateDiscoveryReports(reports, suite);
  aggregate.reportsIncluded = reportPaths.map((filePath) => path.relative(rootDirectory, filePath));

  const outputPath = path.resolve(rootDirectory, 'test-results', 'm008-discovery-aggregate.json');
  writeJson(outputPath, aggregate);

  process.stdout.write(`M008 discovery aggregate: ${aggregate.totalRuns} runs, ~${aggregate.totalCallsEstimate} provider calls\n`);
  process.stdout.write(`Report: ${path.relative(rootDirectory, outputPath)}\n\n`);
  for (const stat of aggregate.perCase) {
    const rate = stat.hitRate === null ? 'n/a' : `${(stat.hitRate * 100).toFixed(0)}%`;
    process.stdout.write(
      `  ${stat.id} ${stat.ticker.padEnd(6)} hit=${stat.hits} miss=${stat.misses} unsupported=${stat.unsupported} rate=${rate} domains=${stat.distinctMatchedDomainsAcrossRuns.join(',') || '-'}\n`,
    );
  }
  process.stdout.write('\n');
  for (const market of ['ID', 'US'] as const) {
    const summary = aggregate.perMarket[market];
    const rate = summary.hitRate === null ? 'n/a' : `${(summary.hitRate * 100).toFixed(0)}%`;
    process.stdout.write(`  ${market}: ${summary.totalHits}/${summary.totalHits + summary.totalMisses} hit (${rate}), ${summary.totalUnsupported} unsupported\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main();
