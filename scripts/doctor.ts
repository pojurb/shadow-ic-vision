#!/usr/bin/env node
/**
 * M015 step 4 — `npm run doctor` preflight.
 *
 * Reads the live SQLite database and the source-snapshot/outbound-log
 * filesystem state; never writes to the database. The only file this script
 * ever writes is `docs/generated/doctor-baseline.json`, and only under
 * `--update-baseline`.
 *
 * Four tiers, per docs/milestones/M015-data-integrity-and-verified-output-recovery.md §4:
 *   A — integrity assertions (exit 1 on violation)
 *   B — lane liveness: attempts >= 10 and successes === 0 fails (exit 1)
 *   C — yield facts, compared against a committed baseline (exit 2 on regression)
 *   D — warnings, never failing
 *
 * Deliberately not part of `verify:full` — see the packet §4 "Deliberately
 * not part of verify:full". `verify:full` validates the repository; this
 * validates the live database and filesystem, which a clean checkout does
 * not have.
 */

import './dotenv-quiet';
import 'dotenv/config';

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  getIssuerPressReleaseUrls,
  getIssuerSourceUrls,
  getNewsWireFeedUrls,
  getOutboundLogPath,
  getSnapshotDirectory,
} from '../lib/research/config';
import { INFO_MEMO_SOURCE_PREFIX } from '../lib/research/adapters/issuer-info-memo';

/**
 * §7 of the M015 packet: seven zero-byte snapshots, accepted by explicit user
 * decision on 2026-09-05 as a permanent gap in 21 evidence rows'
 * re-verifiability. Keyed by exact `document_hash`, not by count or
 * directory — an eighth occurrence must fail, not silently join the list.
 */
const ACCEPTED_ZERO_BYTE_HASHES = new Set([
  '8de29aa3979ea59bb6c92dccf6423cad9f155f4bb3b0dc4f8fe2e5840dd2f7f9',
  '7c37e117078418e440c35e7fde34bdf029be40ff3617aafb8d2bf73c408467dd',
  '20c0a56ea7f3aa1487fd1b9f2a33a646d28a7ea45a611a9005fd0a06ca2bcf99',
  '22b3ff91080eb2e1cef44e96ddf9de52dfd2376b1e9527a9a24832db85f92983',
  '75d5ab403dd02d628342e05852240d19568bc9569f3069538ca92ee382ed334c',
  '0a4d768138a49a17a5c1ef834ef0b8e195bb15c5dfdb440c124fc1cf21e05621',
  '275e9107e3a2f06ad33203acf7cb71744cfe0d9b9bbc70127f14c85fcc299400',
]);

export type LaneKey =
  | 'issuer_official'
  | 'idx_official'
  | 'issuer_press_release'
  | 'news_wire'
  | 'issuer_info_memo'
  | 'xbrl'
  | 'discovery_promotion';

const LANE_ORDER: LaneKey[] = [
  'issuer_official', 'idx_official', 'issuer_press_release',
  'news_wire', 'issuer_info_memo', 'xbrl', 'discovery_promotion',
];

const LANE_LABELS: Record<LaneKey, string> = {
  issuer_official: 'Issuer official',
  idx_official: 'IDX official',
  issuer_press_release: 'Issuer press release',
  news_wire: 'News wire',
  issuer_info_memo: 'Issuer info memo',
  xbrl: 'XBRL (SEC structured facts)',
  discovery_promotion: 'Discovery → promotion',
};

// The one calibration input in this script, per the packet §4: "a mechanism
// exercised ten times that has never once worked is broken, not merely
// unlucky." An engineering tolerance, not a thesis threshold.
const TIER_B_ATTEMPT_THRESHOLD = 10;

// IDX and SEC/XBRL hosts mirror the fixed allowlists `createSourceAdapters()`/
// `createXbrlFactSources()` already hardcode in
// lib/research/adapters/factory.ts — there is no env-var-driven config
// function for these two, unlike the issuer/press/news-wire lanes below, so
// there is nothing to derive them from except that same literal.
const IDX_HOSTS = new Set(['www.idx.id', 'idx.id']);
const SEC_HOSTS = new Set(['www.sec.gov', 'data.sec.gov']);

function hostsWithAlternates(urls: Record<string, string>): Set<string> {
  const hosts = new Set<string>();
  for (const value of Object.values(urls)) {
    const host = new URL(value).hostname.toLowerCase();
    hosts.add(host);
    hosts.add(host.startsWith('www.') ? host.slice(4) : `www.${host}`);
  }
  return hosts;
}

function isUnderDirectory(filePath: string, directory: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Classifies one `source_snapshots`/`evidence` row into a lane by the same
 * `sourceName`/`sourceFormat` fields both tables already carry (see the
 * packet §4's "do not invent a new lane registry" instruction). Used
 * identically for Tier C's per-lane snapshot/evidence counts. Tier B's
 * `discovery_promotion` numbers come from `discovery_candidates` instead
 * (see `readTierB`) — a "Web-discovered" snapshot can exist for a candidate
 * later relabelled `rejected` by `cleanup-mislabelled-promotions.ts`, so
 * sourceName presence alone overstates genuine promotions.
 */
export function classifyLaneBySourceRow(
  row: { sourceName: string; sourceFormat: string },
  newsWirePublishers: ReadonlySet<string>,
): LaneKey | null {
  if (row.sourceFormat === 'xbrl') return 'xbrl';
  if (row.sourceName.startsWith('Issuer official (')) return 'issuer_official';
  if (row.sourceName.startsWith('IDX official disclosure (')) return 'idx_official';
  if (row.sourceName.startsWith('Issuer press release (')) return 'issuer_press_release';
  if (row.sourceName.startsWith(`${INFO_MEMO_SOURCE_PREFIX} (`)) return 'issuer_info_memo';
  if (newsWirePublishers.has(row.sourceName)) return 'news_wire';
  if (row.sourceName.startsWith('Web-discovered')) return 'discovery_promotion';
  return null;
}

function aggregateByLane(
  rows: Array<{ sourceName: string; sourceFormat: string; timestamp: string }>,
  newsWirePublishers: ReadonlySet<string>,
): Record<LaneKey, { count: number; lastSuccess: string | null }> {
  const result = Object.fromEntries(LANE_ORDER.map((key) => [key, { count: 0, lastSuccess: null as string | null }])) as
    Record<LaneKey, { count: number; lastSuccess: string | null }>;
  for (const row of rows) {
    const lane = classifyLaneBySourceRow(row, newsWirePublishers);
    if (!lane) continue;
    const entry = result[lane];
    entry.count += 1;
    if (!entry.lastSuccess || row.timestamp > entry.lastSuccess) entry.lastSuccess = row.timestamp;
  }
  return result;
}

function countOutboundAttemptsByHost(logPath: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (!fs.existsSync(logPath)) return counts;
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let record: unknown;
    try { record = JSON.parse(line); } catch { continue; }
    if (!record || typeof record !== 'object') continue;
    const url = (record as { url?: unknown }).url;
    if (typeof url !== 'string') continue;
    let hostname: string;
    try { hostname = new URL(url).hostname.toLowerCase(); } catch { continue; }
    counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
  }
  return counts;
}

type SnapshotRow = { document_hash: string; storage_path: string; source_name: string; source_format: string; retrieval_timestamp: string };

export type TierAReport = {
  a1: { checkedCount: number; violations: string[] };
  a2: { acceptedExceptions: string[]; violations: string[] };
  a3: { acceptedExceptions: string[]; violations: string[] };
  passed: boolean;
};

function readTierA(sqlite: Database.Database, snapshotDirectory: string): TierAReport {
  const snapshots = sqlite.prepare('SELECT document_hash, storage_path FROM source_snapshots').all() as
    Pick<SnapshotRow, 'document_hash' | 'storage_path'>[];

  const a1Violations = snapshots.filter((row) => !fs.existsSync(row.storage_path)).map((row) => row.document_hash);

  const verifiedHashes = new Set(
    (sqlite.prepare("SELECT DISTINCT document_hash FROM research_job_sources WHERE outcome = 'verified'").all() as { document_hash: string }[])
      .map((row) => row.document_hash),
  );

  const a2AcceptedExceptions: string[] = [];
  const a2Violations: string[] = [];
  for (const row of snapshots) {
    if (!verifiedHashes.has(row.document_hash) || !fs.existsSync(row.storage_path)) continue;
    if (fs.statSync(row.storage_path).size !== 0) continue;
    if (ACCEPTED_ZERO_BYTE_HASHES.has(row.document_hash)) a2AcceptedExceptions.push(row.document_hash);
    else a2Violations.push(row.document_hash);
  }

  const a3AcceptedExceptions: string[] = [];
  const a3Violations: string[] = [];
  for (const row of snapshots) {
    if (isUnderDirectory(row.storage_path, snapshotDirectory)) continue;
    if (ACCEPTED_ZERO_BYTE_HASHES.has(row.document_hash)) a3AcceptedExceptions.push(row.document_hash);
    else a3Violations.push(row.document_hash);
  }

  return {
    a1: { checkedCount: snapshots.length, violations: a1Violations },
    a2: { acceptedExceptions: a2AcceptedExceptions.sort(), violations: a2Violations },
    a3: { acceptedExceptions: a3AcceptedExceptions.sort(), violations: a3Violations },
    passed: a1Violations.length === 0 && a2Violations.length === 0 && a3Violations.length === 0,
  };
}

export type LaneReport = { key: LaneKey; label: string; attempts: number; successes: number; lastSuccess: string | null; dead: boolean };
export type TierBReport = { lanes: LaneReport[]; passed: boolean };

function readTierB(sqlite: Database.Database, outboundLogPath: string): TierBReport {
  const newsWireUrls = getNewsWireFeedUrls();
  const newsWirePublishers = new Set(Object.keys(newsWireUrls));
  const laneHosts: Record<Exclude<LaneKey, 'discovery_promotion'>, Set<string>> = (() => {
    const issuerHosts = hostsWithAlternates(getIssuerSourceUrls());
    return {
      issuer_official: issuerHosts,
      issuer_info_memo: issuerHosts,
      issuer_press_release: hostsWithAlternates(getIssuerPressReleaseUrls()),
      news_wire: hostsWithAlternates(newsWireUrls),
      idx_official: IDX_HOSTS,
      xbrl: SEC_HOSTS,
    };
  })();

  const hostAttempts = countOutboundAttemptsByHost(outboundLogPath);
  const snapshotRows = (sqlite.prepare('SELECT source_name, source_format, retrieval_timestamp FROM source_snapshots').all() as
    Pick<SnapshotRow, 'source_name' | 'source_format' | 'retrieval_timestamp'>[])
    .map((row) => ({ sourceName: row.source_name, sourceFormat: row.source_format, timestamp: row.retrieval_timestamp }));
  const laneSuccesses = aggregateByLane(snapshotRows, newsWirePublishers);

  // discovery_promotion: attempts/successes come from discovery_candidates,
  // not the outbound log. A candidate hits many different origins (the whole
  // point of web-search discovery), so there is no single host to attribute
  // attempts to; and `status: 'fetched'` is the genuine-promotion signal —
  // `resulting_document_hash IS NOT NULL` alone overcounts, since
  // cleanup-mislabelled-promotions.ts can set a document hash and still leave
  // (or restore) `status: 'rejected'` for a fetch that was not the real
  // document (e.g. a homepage caught on origin match alone).
  const discoveryRows = sqlite.prepare('SELECT status, updated_at FROM discovery_candidates').all() as { status: string; updated_at: string }[];
  const discoveryFetched = discoveryRows.filter((row) => row.status === 'fetched');
  const discoveryLastSuccess = discoveryFetched.reduce<string | null>(
    (max, row) => (!max || row.updated_at > max ? row.updated_at : max), null,
  );

  const lanes: LaneReport[] = LANE_ORDER.map((key) => {
    if (key === 'discovery_promotion') {
      return buildLane(key, discoveryRows.length, discoveryFetched.length, discoveryLastSuccess);
    }
    const hosts = laneHosts[key];
    const attempts = [...hosts].reduce((sum, host) => sum + (hostAttempts.get(host) ?? 0), 0);
    return buildLane(key, attempts, laneSuccesses[key].count, laneSuccesses[key].lastSuccess);
  });

  return { lanes, passed: lanes.every((lane) => !lane.dead) };
}

function buildLane(key: LaneKey, attempts: number, successes: number, lastSuccess: string | null): LaneReport {
  return { key, label: LANE_LABELS[key], attempts, successes, lastSuccess, dead: attempts >= TIER_B_ATTEMPT_THRESHOLD && successes === 0 };
}

export type TierCCounts = { supports: number; contradicts: number; inconclusive: number };
export type TierCAssurance = { audited: number; unaudited: number; unknown: number };
export type TierCLaneFacts = { snapshots: number; evidence: number; lastSuccess: string | null };
export type TierCFacts = {
  polarity: TierCCounts;
  assurance: TierCAssurance;
  lanes: Record<LaneKey, TierCLaneFacts>;
  decisions: number;
  nonInconclusiveEvidenceCount: number;
};
export type DoctorBaseline = {
  schemaVersion: 1;
  generatedAt: string;
  polarity: TierCCounts;
  assurance: TierCAssurance;
  lanes: Record<LaneKey, TierCLaneFacts>;
  decisions: number;
};
export type TierCReport = { current: TierCFacts; baseline: DoctorBaseline | null; regressions: string[]; passed: boolean };

function readTierC(sqlite: Database.Database, baseline: DoctorBaseline | null): TierCReport {
  const newsWirePublishers = new Set(Object.keys(getNewsWireFeedUrls()));

  const polarity: TierCCounts = { supports: 0, contradicts: 0, inconclusive: 0 };
  for (const row of sqlite.prepare('SELECT polarity, COUNT(*) as c FROM evidence GROUP BY polarity').all() as { polarity: string; c: number }[]) {
    if (row.polarity in polarity) polarity[row.polarity as keyof TierCCounts] = row.c;
  }

  const assurance: TierCAssurance = { audited: 0, unaudited: 0, unknown: 0 };
  for (const row of sqlite.prepare('SELECT assurance_level, COUNT(*) as c FROM evidence GROUP BY assurance_level').all() as { assurance_level: string; c: number }[]) {
    if (row.assurance_level in assurance) assurance[row.assurance_level as keyof TierCAssurance] = row.c;
  }

  const snapshotRows = (sqlite.prepare('SELECT source_name, source_format, retrieval_timestamp FROM source_snapshots').all() as
    Pick<SnapshotRow, 'source_name' | 'source_format' | 'retrieval_timestamp'>[])
    .map((row) => ({ sourceName: row.source_name, sourceFormat: row.source_format, timestamp: row.retrieval_timestamp }));
  const snapshotsByLane = aggregateByLane(snapshotRows, newsWirePublishers);

  const evidenceRows = (sqlite.prepare('SELECT source_name, source_format, retrieval_timestamp FROM evidence').all() as
    { source_name: string; source_format: string; retrieval_timestamp: string }[])
    .map((row) => ({ sourceName: row.source_name, sourceFormat: row.source_format, timestamp: row.retrieval_timestamp }));
  const evidenceByLane = aggregateByLane(evidenceRows, newsWirePublishers);

  const lanes = Object.fromEntries(LANE_ORDER.map((key) => [key, {
    snapshots: snapshotsByLane[key].count,
    evidence: evidenceByLane[key].count,
    lastSuccess: snapshotsByLane[key].lastSuccess,
  }])) as Record<LaneKey, TierCLaneFacts>;

  const decisions = (sqlite.prepare('SELECT COUNT(*) as c FROM decisions').get() as { c: number }).c;

  const current: TierCFacts = {
    polarity, assurance, lanes, decisions,
    nonInconclusiveEvidenceCount: polarity.supports + polarity.contradicts,
  };

  const regressions = compareTierC(current, baseline);
  return { current, baseline, regressions, passed: regressions.length === 0 };
}

function compareTierC(current: TierCFacts, baseline: DoctorBaseline | null): string[] {
  if (!baseline) return [];
  const regressions: string[] = [];
  if (current.polarity.supports < baseline.polarity.supports) {
    regressions.push(`evidence polarity 'supports' dropped from ${baseline.polarity.supports} to ${current.polarity.supports}`);
  }
  if (current.polarity.contradicts < baseline.polarity.contradicts) {
    regressions.push(`evidence polarity 'contradicts' dropped from ${baseline.polarity.contradicts} to ${current.polarity.contradicts}`);
  }
  if (current.assurance.audited < baseline.assurance.audited) {
    regressions.push(`evidence assurance 'audited' dropped from ${baseline.assurance.audited} to ${current.assurance.audited}`);
  }
  if (current.decisions < baseline.decisions) {
    regressions.push(`decisions row count dropped from ${baseline.decisions} to ${current.decisions}`);
  }
  for (const key of LANE_ORDER) {
    const baselineLane = baseline.lanes[key];
    if (!baselineLane) continue;
    const currentLane = current.lanes[key];
    if (currentLane.snapshots < baselineLane.snapshots) {
      regressions.push(`lane '${key}' snapshot count dropped from ${baselineLane.snapshots} to ${currentLane.snapshots}`);
    }
    if (currentLane.evidence < baselineLane.evidence) {
      regressions.push(`lane '${key}' evidence count dropped from ${baselineLane.evidence} to ${currentLane.evidence}`);
    }
  }
  return regressions;
}

export type TierDReport = { unreferencedSnapshotFiles: string[] };

function readTierD(sqlite: Database.Database, snapshotDirectory: string): TierDReport {
  const known = new Set((sqlite.prepare('SELECT document_hash FROM source_snapshots').all() as { document_hash: string }[]).map((row) => row.document_hash));
  let files: string[] = [];
  try { files = fs.readdirSync(snapshotDirectory).filter((file) => file.endsWith('.bin')); } catch { files = []; }
  const unreferenced = files.filter((file) => !known.has(file.slice(0, -'.bin'.length)));
  return { unreferencedSnapshotFiles: unreferenced.sort() };
}

export type DoctorOptions = {
  dbPath: string;
  snapshotDirectory: string;
  outboundLogPath: string;
  baseline: DoctorBaseline | null;
  strict: boolean;
  now?: () => Date;
};

export type DoctorReport = {
  schemaVersion: 1;
  generatedAt: string;
  dbPath: string;
  snapshotDirectory: string;
  outboundLogPath: string;
  strict: boolean;
  tierA: TierAReport;
  tierB: TierBReport;
  tierC: TierCReport;
  tierD: TierDReport;
  exitCode: number;
};

export function computeDoctorReport(options: DoctorOptions): DoctorReport {
  // Read-only, per the packet §4: "doctor reads; it never writes to the
  // database." `fileMustExist` refuses to silently create an empty database
  // at the wrong path, which a read/write open would otherwise do.
  const sqlite = new Database(options.dbPath, { readonly: true, fileMustExist: true });
  try {
    const tierA = readTierA(sqlite, options.snapshotDirectory);
    const tierB = readTierB(sqlite, options.outboundLogPath);
    const tierC = readTierC(sqlite, options.baseline);
    const tierD = readTierD(sqlite, options.snapshotDirectory);

    let exitCode = 0;
    if (!tierA.passed || !tierB.passed) exitCode = 1;
    else if (!tierC.passed) exitCode = 2;
    if (exitCode === 0 && options.strict && tierC.current.nonInconclusiveEvidenceCount === 0) exitCode = 1;

    return {
      schemaVersion: 1,
      generatedAt: (options.now ?? (() => new Date()))().toISOString(),
      dbPath: options.dbPath,
      snapshotDirectory: options.snapshotDirectory,
      outboundLogPath: options.outboundLogPath,
      strict: options.strict,
      tierA, tierB, tierC, tierD,
      exitCode,
    };
  } finally {
    sqlite.close();
  }
}

export function renderHumanReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`jp-invest doctor — ${report.generatedAt}`);
  lines.push(`  database: ${report.dbPath}`);
  lines.push(`  snapshots: ${report.snapshotDirectory}`);
  lines.push('');

  lines.push(`Tier A — integrity assertions: ${report.tierA.passed ? 'PASS' : 'FAIL'}`);
  lines.push(`  A1 storage_path resolves to a file: ${report.tierA.a1.checkedCount - report.tierA.a1.violations.length}/${report.tierA.a1.checkedCount}` +
    (report.tierA.a1.violations.length ? ` — MISSING: ${report.tierA.a1.violations.join(', ')}` : ''));
  lines.push(`  A2 no zero-byte file for a verified outcome: ${report.tierA.a2.violations.length} violation(s), ` +
    `${report.tierA.a2.acceptedExceptions.length} accepted exception(s) [${report.tierA.a2.acceptedExceptions.join(', ')}]` +
    (report.tierA.a2.violations.length ? ` — VIOLATIONS: ${report.tierA.a2.violations.join(', ')}` : ''));
  lines.push(`  A3 storage_path under the canonical snapshot directory: ${report.tierA.a3.violations.length} violation(s), ` +
    `${report.tierA.a3.acceptedExceptions.length} accepted exception(s) [${report.tierA.a3.acceptedExceptions.join(', ')}]` +
    (report.tierA.a3.violations.length ? ` — VIOLATIONS: ${report.tierA.a3.violations.join(', ')}` : ''));
  lines.push('');

  lines.push(`Tier B — lane liveness (>= ${TIER_B_ATTEMPT_THRESHOLD} attempts, 0 successes fails): ${report.tierB.passed ? 'PASS' : 'FAIL'}`);
  for (const lane of report.tierB.lanes) {
    lines.push(`  ${lane.dead ? 'DEAD' : 'ok  '} ${lane.label}: ${lane.attempts} attempt(s), ${lane.successes} success(es), last success ${lane.lastSuccess ?? 'never'}`);
  }
  lines.push('');

  lines.push(`Tier C — yield facts vs. baseline: ${report.tierC.baseline ? (report.tierC.passed ? 'PASS' : 'REGRESSION') : 'NO BASELINE'}`);
  lines.push(`  evidence polarity: supports=${report.tierC.current.polarity.supports} contradicts=${report.tierC.current.polarity.contradicts} inconclusive=${report.tierC.current.polarity.inconclusive}`);
  lines.push(`  evidence assurance: audited=${report.tierC.current.assurance.audited} unaudited=${report.tierC.current.assurance.unaudited} unknown=${report.tierC.current.assurance.unknown}`);
  lines.push(`  non-inconclusive evidence count: ${report.tierC.current.nonInconclusiveEvidenceCount}`);
  lines.push(`  decisions: ${report.tierC.current.decisions}`);
  for (const key of LANE_ORDER) {
    const lane = report.tierC.current.lanes[key];
    lines.push(`  ${LANE_LABELS[key]}: ${lane.snapshots} snapshot(s), ${lane.evidence} evidence row(s)`);
  }
  if (report.tierC.regressions.length) {
    lines.push('  REGRESSIONS:');
    for (const regression of report.tierC.regressions) lines.push(`    - ${regression}`);
  }
  lines.push('');

  lines.push('Tier D — warnings (never failing):');
  lines.push(`  unreferenced snapshot files: ${report.tierD.unreferencedSnapshotFiles.length}` +
    (report.tierD.unreferencedSnapshotFiles.length ? ` [${report.tierD.unreferencedSnapshotFiles.join(', ')}]` : ''));
  lines.push('');

  if (report.strict && report.tierC.current.nonInconclusiveEvidenceCount === 0) {
    lines.push('--strict: non-inconclusive evidence count is 0 — FAIL');
  }
  lines.push(`Exit code: ${report.exitCode}`);
  return `${lines.join('\n')}\n`;
}

// Mirrors db/client.ts's `resolveDatabasePath`. Not imported from there:
// db/client.ts opens with `import 'server-only'`, which throws unless the
// process is run with `--conditions=react-server` (as research-queue.ts and
// research-retry.ts are) — doctor's own npm script deliberately is not,
// matching status-check.ts's plain invocation — and db/client.ts's
// `createDatabase`/`getDatabase` run migrations and a WAL pragma on connect,
// which doctor must never do; it only ever opens the database read-only.
function resolveDatabasePath(): string {
  return path.resolve(process.cwd(), process.env.DB_PATH || '../jp-invest-data/db.sqlite');
}

const BASELINE_RELATIVE_PATH = path.join('docs', 'generated', 'doctor-baseline.json');

function loadBaseline(root: string): DoctorBaseline | null {
  const target = path.join(root, BASELINE_RELATIVE_PATH);
  if (!fs.existsSync(target)) return null;
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8')) as DoctorBaseline;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const updateBaseline = args.includes('--update-baseline');

  const dbPath = resolveDatabasePath();
  const snapshotDirectory = getSnapshotDirectory();
  const outboundLogPath = getOutboundLogPath();
  const baseline = loadBaseline(process.cwd());

  const report = computeDoctorReport({ dbPath, snapshotDirectory, outboundLogPath, baseline, strict });

  if (updateBaseline) {
    if (!report.tierA.passed || !report.tierB.passed) {
      process.stderr.write(
        'Refusing to update the Tier C baseline: Tier A or Tier B is currently failing. ' +
        'A broken state must never be baselined as normal — fix the underlying defect first.\n\n',
      );
      process.stderr.write(json ? `${JSON.stringify(report, null, 2)}\n` : renderHumanReport(report));
      process.exitCode = 1;
      return;
    }
    const newBaseline: DoctorBaseline = {
      schemaVersion: 1,
      generatedAt: report.generatedAt,
      polarity: report.tierC.current.polarity,
      assurance: report.tierC.current.assurance,
      lanes: report.tierC.current.lanes,
      decisions: report.tierC.current.decisions,
    };
    const target = path.join(process.cwd(), BASELINE_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(newBaseline, null, 2)}\n`, 'utf8');
    process.stdout.write(`Updated Tier C baseline: ${BASELINE_RELATIVE_PATH}\n`);
    return;
  }

  process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : renderHumanReport(report));
  process.exitCode = report.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
