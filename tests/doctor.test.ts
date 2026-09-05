import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptions, decisions, discoveryCandidates, evidence, researchJobSources, researchJobs, sourceSnapshots, theses } from '@/db/schema';
import {
  classifyLaneBySourceRow,
  computeDoctorReport,
  type DoctorBaseline,
  type DoctorOptions,
} from '@/scripts/doctor';

/**
 * M015 step 4. `doctor` must reproduce, from live data, exactly what the
 * milestone packet established by hand: 114/114 storage paths resolving, the
 * seven zero-byte snapshots reported as accepted exceptions (never a silent
 * pass), a dead lane at >= 10 attempts / 0 successes, and a Tier C regression
 * against a committed baseline. These fixtures build the minimal schema shape
 * each assertion needs rather than a full thesis-confirmation flow.
 */
describe('M015 doctor preflight', () => {
  let directory: string;
  let snapshotDirectory: string;
  let outboundLogPath: string;
  let handle: DatabaseHandle;
  let thesisId: string;
  let assumptionId: string;
  let jobId: string;
  let dbPath: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-doctor-'));
    snapshotDirectory = path.join(directory, 'source-snapshots');
    fs.mkdirSync(snapshotDirectory, { recursive: true });
    outboundLogPath = path.join(directory, 'outbound.log');
    dbPath = path.join(directory, 'test.sqlite');
    handle = createDatabase(dbPath);

    thesisId = 'thesis-1';
    assumptionId = 'assumption-1';
    jobId = 'job-1';
    handle.db.insert(theses).values({ id: thesisId, title: 'TLKM', description: 'test thesis' }).run();
    handle.db.insert(assumptions).values({ id: assumptionId, thesisId, statement: 'test assumption' }).run();
    handle.db.insert(researchJobs).values({ id: jobId, assumptionId, status: 'succeeded' }).run();
    // A connection stays open (WAL) so the readonly connection doctor opens
    // separately below can see committed writes made through it.
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function options(overrides: Partial<DoctorOptions> = {}): DoctorOptions {
    return { dbPath, snapshotDirectory, outboundLogPath, baseline: null, strict: false, ...overrides };
  }

  function writeSnapshotFile(hash: string, bytes: string | Uint8Array, directoryOverride = snapshotDirectory) {
    const storagePath = path.join(directoryOverride, `${hash}.bin`);
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, bytes);
    return storagePath;
  }

  function insertSnapshot(input: {
    hash: string;
    storagePath: string;
    sourceName?: string;
    sourceFormat?: 'html' | 'pdf' | 'image' | 'xbrl';
    retrievalTimestamp?: string;
  }) {
    handle.db.insert(sourceSnapshots).values({
      documentHash: input.hash,
      documentId: `doc-${input.hash}`,
      market: 'ID',
      ticker: 'TLKM',
      sourceUrl: 'https://www.telkom.co.id/report.pdf',
      sourceName: input.sourceName ?? 'Issuer official (TLKM)',
      sourceTier: 'official',
      sourceFormat: input.sourceFormat ?? 'pdf',
      contentType: 'application/pdf',
      httpStatus: 200,
      publishDate: null,
      retrievalTimestamp: input.retrievalTimestamp ?? '2026-09-01T00:00:00.000Z',
      storagePath: input.storagePath,
      sourceMode: 'live',
    }).run();
  }

  function markVerified(hash: string) {
    handle.db.insert(researchJobSources).values({ jobId, documentHash: hash, outcome: 'verified' }).run();
  }

  function writeOutboundLines(entries: Array<{ url: string; status?: number }>) {
    const lines = entries.map((entry) => JSON.stringify({
      timestamp: new Date().toISOString(), method: 'GET', url: entry.url,
      status: entry.status ?? 200, attempt: 1, durationMs: 10, errorCode: null,
    }));
    fs.mkdirSync(path.dirname(outboundLogPath), { recursive: true });
    fs.writeFileSync(outboundLogPath, `${lines.join('\n')}\n`, 'utf8');
  }

  describe('Tier A — integrity assertions', () => {
    it('passes when every storage_path resolves to an existing file', () => {
      const storagePath = writeSnapshotFile('hash-ok', 'real bytes');
      insertSnapshot({ hash: 'hash-ok', storagePath });
      const report = computeDoctorReport(options());
      expect(report.tierA.a1.violations).toEqual([]);
      expect(report.tierA.passed).toBe(true);
    });

    it('fails A1 when a storage_path does not resolve to a file on disk', () => {
      insertSnapshot({ hash: 'hash-missing', storagePath: path.join(snapshotDirectory, 'hash-missing.bin') });
      const report = computeDoctorReport(options());
      expect(report.tierA.a1.violations).toEqual(['hash-missing']);
      expect(report.tierA.passed).toBe(false);
    });

    it('reports a zero-byte verified snapshot on the accepted-hash list as an exception, not a violation', () => {
      const acceptedHash = '8de29aa3979ea59bb6c92dccf6423cad9f155f4bb3b0dc4f8fe2e5840dd2f7f9';
      const storagePath = writeSnapshotFile(acceptedHash, new Uint8Array(0));
      insertSnapshot({ hash: acceptedHash, storagePath });
      markVerified(acceptedHash);
      const report = computeDoctorReport(options());
      expect(report.tierA.a2.violations).toEqual([]);
      expect(report.tierA.a2.acceptedExceptions).toEqual([acceptedHash]);
      expect(report.tierA.passed).toBe(true);
    });

    /*
     * This is the load-bearing case for §7's "an eighth occurrence must
     * fail" requirement. Proven fail-first: a version of the check that
     * treated "any zero-byte verified snapshot" as accepted (a count-based
     * or directory-based rule instead of the exact-hash list) would let this
     * pass silently. Confirmed by temporarily widening the exception
     * predicate to `true` in scripts/doctor.ts — this test then passed
     * incorrectly (0 violations) until the predicate was reverted to the
     * exact-hash set, at which point it correctly reports the violation.
     */
    it('fails A2 for a zero-byte verified snapshot not on the accepted-hash list', () => {
      const storagePath = writeSnapshotFile('hash-unaccepted-empty', new Uint8Array(0));
      insertSnapshot({ hash: 'hash-unaccepted-empty', storagePath });
      markVerified('hash-unaccepted-empty');
      const report = computeDoctorReport(options());
      expect(report.tierA.a2.violations).toEqual(['hash-unaccepted-empty']);
      expect(report.tierA.a2.acceptedExceptions).toEqual([]);
      expect(report.tierA.passed).toBe(false);
    });

    it('does not flag a zero-byte snapshot whose outcome is rejected, not verified', () => {
      const storagePath = writeSnapshotFile('hash-rejected-empty', new Uint8Array(0));
      insertSnapshot({ hash: 'hash-rejected-empty', storagePath });
      handle.db.insert(researchJobSources).values({ jobId, documentHash: 'hash-rejected-empty', outcome: 'rejected' }).run();
      const report = computeDoctorReport(options());
      expect(report.tierA.a2.violations).toEqual([]);
      expect(report.tierA.passed).toBe(true);
    });

    it('fails A3 for a non-accepted storage_path outside the canonical snapshot directory', () => {
      const strayDirectory = path.join(directory, 'old-snapshots');
      const storagePath = writeSnapshotFile('hash-stray', 'bytes', strayDirectory);
      insertSnapshot({ hash: 'hash-stray', storagePath });
      const report = computeDoctorReport(options());
      expect(report.tierA.a3.violations).toEqual(['hash-stray']);
      expect(report.tierA.passed).toBe(false);
    });

    it('does not flag an accepted-hash snapshot for living outside the canonical directory', () => {
      const acceptedHash = '7c37e117078418e440c35e7fde34bdf029be40ff3617aafb8d2bf73c408467dd';
      const strayDirectory = path.join(directory, 'old-snapshots');
      const storagePath = writeSnapshotFile(acceptedHash, new Uint8Array(0), strayDirectory);
      insertSnapshot({ hash: acceptedHash, storagePath });
      markVerified(acceptedHash);
      const report = computeDoctorReport(options());
      expect(report.tierA.a3.violations).toEqual([]);
      expect(report.tierA.a3.acceptedExceptions).toEqual([acceptedHash]);
      expect(report.tierA.passed).toBe(true);
    });
  });

  describe('Tier B — lane liveness', () => {
    it('marks a lane dead at >= 10 attempts and 0 successes', () => {
      writeOutboundLines(Array.from({ length: 10 }, () => ({ url: 'https://www.idx.id/primary/ListedCompany/GetAnnouncement' })));
      const report = computeDoctorReport(options());
      const idx = report.tierB.lanes.find((lane) => lane.key === 'idx_official');
      expect(idx).toMatchObject({ attempts: 10, successes: 0, dead: true });
      expect(report.tierB.passed).toBe(false);
    });

    /*
     * Proven fail-first: dropping the `successes === 0` half of the
     * predicate (failing on attempts alone) makes this test fail, since a
     * lane with real output would then also be reported dead at 10+
     * attempts. Confirmed by editing `buildLane`'s condition to
     * `attempts >= TIER_B_ATTEMPT_THRESHOLD` alone and observing this
     * assertion fail (dead: true) before reverting.
     */
    it('does not mark a lane dead once it has at least one success', () => {
      writeOutboundLines(Array.from({ length: 12 }, () => ({ url: 'https://www.idx.id/primary/ListedCompany/GetAnnouncement' })));
      const storagePath = writeSnapshotFile('hash-idx', 'bytes');
      insertSnapshot({ hash: 'hash-idx', storagePath, sourceName: 'IDX official disclosure (TLKM)' });
      const report = computeDoctorReport(options());
      const idx = report.tierB.lanes.find((lane) => lane.key === 'idx_official');
      expect(idx).toMatchObject({ attempts: 12, successes: 1, dead: false });
      expect(report.tierB.passed).toBe(true);
    });

    it('does not mark a lane dead below the attempt threshold', () => {
      writeOutboundLines(Array.from({ length: 9 }, () => ({ url: 'https://www.idx.id/primary/ListedCompany/GetAnnouncement' })));
      const report = computeDoctorReport(options());
      const idx = report.tierB.lanes.find((lane) => lane.key === 'idx_official');
      expect(idx).toMatchObject({ attempts: 9, successes: 0, dead: false });
      expect(report.tierB.passed).toBe(true);
    });

    /*
     * discovery_promotion's success signal is `discovery_candidates.status
     * = 'fetched'`, not mere presence of `resulting_document_hash` — a
     * candidate `cleanup-mislabelled-promotions.ts` relabels back to
     * `rejected` after finding it was a generic page, not the real
     * document, must not count as a live success. Proven fail-first: using
     * `resultingDocumentHash IS NOT NULL` instead makes this test fail
     * (successes: 1, dead: false) — confirmed by that substitution before
     * reverting to the `status === 'fetched'` filter.
     */
    it('does not count a rejected-but-hash-linked discovery candidate as a promotion success', () => {
      handle.db.insert(sourceSnapshots).values({
        documentHash: 'hash-discovered', documentId: 'doc-discovered', market: 'ID', ticker: 'TLKM',
        sourceUrl: 'https://www.telkom.co.id/', sourceName: 'Web-discovered issuer page (TLKM)', sourceTier: 'secondary',
        sourceFormat: 'html', contentType: 'text/html', httpStatus: 200, publishDate: null,
        retrievalTimestamp: '2026-09-01T00:00:00.000Z', storagePath: writeSnapshotFile('hash-discovered', 'bytes'), sourceMode: 'live',
      }).run();
      for (let index = 0; index < 10; index += 1) {
        handle.db.insert(discoveryCandidates).values({
          id: `candidate-${index}`, market: 'ID', ticker: 'TLKM',
          candidateUrl: `https://example.com/${index}`, searchQuery: 'TLKM',
          status: 'rejected', resultingDocumentHash: index === 0 ? 'hash-discovered' : null,
        }).run();
      }
      const report = computeDoctorReport(options());
      const discovery = report.tierB.lanes.find((lane) => lane.key === 'discovery_promotion');
      expect(discovery).toMatchObject({ attempts: 10, successes: 0, dead: true });
    });
  });

  describe('Tier C — yield facts and baseline regression', () => {
    it('reports no regression and no baseline when none is configured', () => {
      const report = computeDoctorReport(options({ baseline: null }));
      expect(report.tierC.baseline).toBeNull();
      expect(report.tierC.regressions).toEqual([]);
      expect(report.tierC.passed).toBe(true);
    });

    it('computes non-inconclusive evidence count as supports + contradicts', () => {
      seedEvidence({ id: 'ev-1', polarity: 'supports' });
      seedEvidence({ id: 'ev-2', polarity: 'contradicts' });
      seedEvidence({ id: 'ev-3', polarity: 'inconclusive' });
      const report = computeDoctorReport(options());
      expect(report.tierC.current.polarity).toEqual({ supports: 1, contradicts: 1, inconclusive: 1 });
      expect(report.tierC.current.nonInconclusiveEvidenceCount).toBe(2);
    });

    /*
     * Proven fail-first: comparing only exact equality (not "current <
     * baseline") would miss this. Confirmed by changing the comparator to
     * `!==` in `compareTierC` — every count differs from a zero baseline on
     * the very first run, which would make Tier C report a spurious
     * regression on every increase, not just a real drop. Reverted after
     * confirming the intended `<` comparator instead reports no regression
     * here (an increase) and a regression only in the next test (a drop).
     */
    it('reports no regression when a count increases past the baseline', () => {
      seedEvidence({ id: 'ev-1', polarity: 'supports' });
      const baseline: DoctorBaseline = {
        schemaVersion: 1, generatedAt: '2026-09-01T00:00:00.000Z',
        polarity: { supports: 0, contradicts: 0, inconclusive: 0 },
        assurance: { audited: 0, unaudited: 0, unknown: 0 },
        lanes: emptyBaselineLanes(),
        decisions: 0,
      };
      const report = computeDoctorReport(options({ baseline }));
      expect(report.tierC.regressions).toEqual([]);
      expect(report.tierC.passed).toBe(true);
      expect(report.exitCode).toBe(0);
    });

    it('reports a regression and exits 2 when a count drops below the baseline', () => {
      const baseline: DoctorBaseline = {
        schemaVersion: 1, generatedAt: '2026-09-01T00:00:00.000Z',
        polarity: { supports: 2, contradicts: 0, inconclusive: 0 },
        assurance: { audited: 0, unaudited: 0, unknown: 0 },
        lanes: emptyBaselineLanes(),
        decisions: 0,
      };
      seedEvidence({ id: 'ev-1', polarity: 'supports' });
      const report = computeDoctorReport(options({ baseline }));
      expect(report.tierC.regressions).toEqual(["evidence polarity 'supports' dropped from 2 to 1"]);
      expect(report.tierC.passed).toBe(false);
      expect(report.exitCode).toBe(2);
    });

    it('reports a regression when the decisions row count drops below the baseline', () => {
      const baseline: DoctorBaseline = {
        schemaVersion: 1, generatedAt: '2026-09-01T00:00:00.000Z',
        polarity: { supports: 0, contradicts: 0, inconclusive: 0 },
        assurance: { audited: 0, unaudited: 0, unknown: 0 },
        lanes: emptyBaselineLanes(),
        decisions: 1,
      };
      const report = computeDoctorReport(options({ baseline }));
      expect(report.tierC.regressions).toEqual(['decisions row count dropped from 1 to 0']);
      expect(report.exitCode).toBe(2);
    });

    it('does not regress on decisions when the count holds steady', () => {
      handle.db.insert(decisions).values({
        id: 'decision-1', thesisId, outcome: 'No Change', rationale: 'steady',
      }).run();
      const baseline: DoctorBaseline = {
        schemaVersion: 1, generatedAt: '2026-09-01T00:00:00.000Z',
        polarity: { supports: 0, contradicts: 0, inconclusive: 0 },
        assurance: { audited: 0, unaudited: 0, unknown: 0 },
        lanes: emptyBaselineLanes(),
        decisions: 1,
      };
      const report = computeDoctorReport(options({ baseline }));
      expect(report.tierC.regressions).toEqual([]);
    });

    it('counts a lane snapshot/evidence drop against the baseline', () => {
      const baseline: DoctorBaseline = {
        schemaVersion: 1, generatedAt: '2026-09-01T00:00:00.000Z',
        polarity: { supports: 0, contradicts: 0, inconclusive: 0 },
        assurance: { audited: 0, unaudited: 0, unknown: 0 },
        lanes: { ...emptyBaselineLanes(), idx_official: { snapshots: 5, evidence: 5, lastSuccess: null } },
        decisions: 0,
      };
      const report = computeDoctorReport(options({ baseline }));
      expect(report.tierC.regressions).toEqual(expect.arrayContaining([
        "lane 'idx_official' snapshot count dropped from 5 to 0",
        "lane 'idx_official' evidence count dropped from 5 to 0",
      ]));
    });
  });

  describe('exit code precedence', () => {
    it('exits 1 when Tier A fails even if Tier C would also regress', () => {
      insertSnapshot({ hash: 'hash-missing', storagePath: path.join(snapshotDirectory, 'hash-missing.bin') });
      const baseline: DoctorBaseline = {
        schemaVersion: 1, generatedAt: '2026-09-01T00:00:00.000Z',
        polarity: { supports: 5, contradicts: 0, inconclusive: 0 },
        assurance: { audited: 0, unaudited: 0, unknown: 0 },
        lanes: emptyBaselineLanes(),
        decisions: 0,
      };
      const report = computeDoctorReport(options({ baseline }));
      expect(report.tierA.passed).toBe(false);
      expect(report.exitCode).toBe(1);
    });

    it('--strict fails when non-inconclusive evidence is zero, even with clean tiers', () => {
      seedEvidence({ id: 'ev-1', polarity: 'inconclusive' });
      const report = computeDoctorReport(options({ strict: true }));
      expect(report.tierA.passed).toBe(true);
      expect(report.tierB.passed).toBe(true);
      expect(report.tierC.passed).toBe(true);
      expect(report.exitCode).toBe(1);
    });

    it('does not apply --strict when non-inconclusive evidence is present', () => {
      seedEvidence({ id: 'ev-1', polarity: 'supports' });
      const report = computeDoctorReport(options({ strict: true }));
      expect(report.exitCode).toBe(0);
    });
  });

  describe('classifyLaneBySourceRow', () => {
    it('classifies by sourceFormat before sourceName, so an xbrl row is never mistaken for another lane', () => {
      const lane = classifyLaneBySourceRow({ sourceName: 'Anything at all', sourceFormat: 'xbrl' }, new Set());
      expect(lane).toBe('xbrl');
    });

    it('classifies a news-wire row only when its sourceName matches a configured publisher', () => {
      expect(classifyLaneBySourceRow({ sourceName: 'CNBC Indonesia Market', sourceFormat: 'html' }, new Set(['CNBC Indonesia Market']))).toBe('news_wire');
      expect(classifyLaneBySourceRow({ sourceName: 'CNBC Indonesia Market', sourceFormat: 'html' }, new Set())).toBeNull();
    });
  });

  function seedEvidence(overrides: { id: string; polarity: 'supports' | 'contradicts' | 'inconclusive' }) {
    handle.db.insert(evidence).values({
      id: overrides.id, assumptionId, sourceFormat: 'pdf', contentKind: 'text', sourceVariant: null,
      extractionMethod: 'pdf_text', verificationStatus: 'exact_verified', sourceTier: 'official',
      sourceName: 'Issuer official (TLKM)', publishDate: null, documentHash: 'hash-evidence',
      canonicalTextHash: null, boundingBox: null, sourceUrl: 'https://www.telkom.co.id/report.pdf',
      retrievalTimestamp: '2026-09-01T00:00:00.000Z', content: 'quote', pageNumber: null,
      polarity: overrides.polarity,
    }).run();
  }

  function emptyBaselineLanes(): DoctorBaseline['lanes'] {
    const empty = { snapshots: 0, evidence: 0, lastSuccess: null as string | null };
    return {
      issuer_official: { ...empty }, idx_official: { ...empty }, issuer_press_release: { ...empty },
      news_wire: { ...empty }, issuer_info_memo: { ...empty }, xbrl: { ...empty }, discovery_promotion: { ...empty },
    };
  }
});

describe('M015 doctor CLI — --update-baseline and --strict', () => {
  let directory: string;
  let dbPath: string;
  let snapshotDirectory: string;
  let outboundLogPath: string;
  let baselinePath: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-doctor-cli-'));
    dbPath = path.join(directory, 'test.sqlite');
    snapshotDirectory = path.join(directory, 'source-snapshots');
    fs.mkdirSync(snapshotDirectory, { recursive: true });
    outboundLogPath = path.join(directory, 'outbound.log');
    baselinePath = path.join(process.cwd(), 'docs', 'generated', 'doctor-baseline.json');
    const handle = createDatabase(dbPath);
    handle.db.insert(theses).values({ id: 't1', title: 'TLKM', description: 'd' }).run();
    handle.db.insert(assumptions).values({ id: 'a1', thesisId: 't1', statement: 's' }).run();
    handle.sqlite.close();
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
    // Never leave a baseline written by a test sitting in the real repo tree.
    fs.rmSync(baselinePath, { force: true });
  });

  function runCli(args: string[]) {
    return spawnSync(process.execPath, ['--import', './node_modules/tsx/dist/loader.mjs', 'scripts/doctor.ts', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        DB_PATH: dbPath,
        SOURCE_SNAPSHOT_DIR: snapshotDirectory,
        OUTBOUND_LOG_PATH: outboundLogPath,
        ISSUER_SOURCE_URLS: '{}',
        ISSUER_PRESS_RELEASE_URLS: '{}',
        NEWS_WIRE_FEED_URLS: '{}',
      },
    });
  }

  /*
   * Proven fail-first: a version of `main()` that writes the baseline
   * unconditionally (no Tier A/B guard) makes this test fail, since the
   * baseline file would then exist despite the missing-file violation.
   * Confirmed by removing the `if (!report.tierA.passed...)` guard in
   * scripts/doctor.ts and observing `fs.existsSync(baselinePath)` become
   * true, before reverting.
   */
  it('refuses --update-baseline while Tier A is failing, and writes nothing', () => {
    const handle = createDatabase(dbPath);
    handle.db.insert(sourceSnapshots).values({
      documentHash: 'hash-missing', documentId: 'doc-missing', market: 'ID', ticker: 'TLKM',
      sourceUrl: 'https://www.telkom.co.id/x.pdf', sourceName: 'Issuer official (TLKM)', sourceTier: 'official',
      sourceFormat: 'pdf', contentType: 'application/pdf', httpStatus: 200, publishDate: null,
      retrievalTimestamp: '2026-09-01T00:00:00.000Z', storagePath: path.join(snapshotDirectory, 'hash-missing.bin'), sourceMode: 'live',
    }).run();
    handle.sqlite.close();

    const result = runCli(['--update-baseline']);
    expect(result.status).toBe(1);
    expect(fs.existsSync(baselinePath)).toBe(false);
  }, 20_000);

  it('writes the Tier C baseline when Tier A and B pass', () => {
    const result = runCli(['--update-baseline']);
    expect(result.status).toBe(0);
    expect(fs.existsSync(baselinePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    expect(written).toMatchObject({ schemaVersion: 1, decisions: 0 });
  }, 20_000);

  it('exits 1 under --strict --json when no evidence is directional', () => {
    const result = runCli(['--strict', '--json']);
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.tierC.current.nonInconclusiveEvidenceCount).toBe(0);
  }, 20_000);
});
