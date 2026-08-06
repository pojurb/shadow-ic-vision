import 'server-only';

import { and, eq, inArray, or } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { assumptions, discoveryCandidates, evidence, theses } from '@/db/schema';
import { buildClientsByOrigin } from './adapters/factory';
import { isIssuerReleaseUrl } from './adapters/issuer-press';
import { classifySecondaryDocument } from './secondary-document';
import type { ResearchMarket, ResearchSourceMode, SourceSnapshot } from './adapters/types';
import { getIssuerPressReleaseUrls, getNewsWireFeedUrls } from './config';
import { extractSecondaryCandidates } from './extractors/candidate';
import { extractDocument } from './extractors/document';
import { applyAssumptionStatusGate, evidenceInsertValues } from './evidence-persistence';
import { loadMeasurementContract } from './measurement';
import type { OfficialHttpClient } from './http';
import { persistSourceSnapshot } from './snapshot-store';
import { createHash, verifyExactMatch } from './verifier';
import type { VerifiedEvidence } from './pipeline';

export type PromotionSourceClass = 'issuer' | 'news';
export type PromotionClient = { client: OfficialHttpClient; sourceClass: PromotionSourceClass };
export type PromotionClients = Record<string, PromotionClient>;

/**
 * M008 Workflow 2 step 2. Origin -> client map, tagged with which allowlist
 * (issuer press release vs. news wire) the origin belongs to, so a
 * successful fetch is classified `secondary_issuer` or `secondary_news`
 * correctly. Built from the exact same `buildClientsByOrigin` helper (now
 * exported from `adapters/factory.ts`) Class A/B already use — not a
 * reimplementation of the domain-matching logic.
 */
export function buildPromotionClients(logPath: string): PromotionClients {
  const merged: PromotionClients = {};
  for (const [origin, client] of Object.entries(buildClientsByOrigin(getIssuerPressReleaseUrls(), logPath))) {
    merged[origin] = { client, sourceClass: 'issuer' };
  }
  for (const [origin, client] of Object.entries(buildClientsByOrigin(getNewsWireFeedUrls(), logPath))) {
    merged[origin] = { client, sourceClass: 'news' };
  }
  return merged;
}

/** A homepage — the one shape cheap enough, and certain enough, to refuse unfetched. */
function isBareOrigin(url: string): boolean {
  try {
    return !new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return false;
  }
}

/*
 * Rejections that a later code or configuration change can legitimately
 * overturn, and which `promoteAllEligibleCandidates` therefore re-evaluates.
 * `domain_not_allowlisted` was already here; the classification reasons joined
 * it because a candidate refused by today's classifier must not be excluded
 * from tomorrow's improved one — a permanently terminal rejection was a defect
 * this module shipped with on 2026-08-06 and is exactly how a genuine release
 * with an unusual URL would have been lost for good.
 */
export const REVIEWABLE_REJECTION_REASONS = [
  'domain_not_allowlisted',
  'not_an_issuer_release',
  'not_an_article',
  'unclassifiable_document',
] as const;

function resolvePromotionClient(url: string, clients: PromotionClients): PromotionClient | undefined {
  try {
    return clients[new URL(url).origin];
  } catch {
    return undefined;
  }
}

export type PromotionOutcome = 'promoted' | 'rejected' | 'unreachable' | 'no_matching_evidence';

/**
 * The DEC-0015 §3.2 mechanism, structurally: `resolvePromotionClient` runs
 * before any fetch, and a miss returns immediately — `OfficialHttpClient` is
 * never constructed or called for an unallowlisted origin. One candidate
 * per call, scoped to one assumption (extraction ranks passages against
 * `assumptionStatement`, so the same URL fetched for two assumptions of the
 * same ticker yields two independently-verified evidence sets, exactly like
 * Class A/B's `runSecondaryResearchCall` already does per assumption).
 * Never throws: every failure path is a `discoveryCandidates` status update
 * and a return value, matching Class A/B's soft-failure discipline.
 */
export async function promoteCandidate(params: {
  db: AppDatabase;
  candidateId: string;
  candidateUrl: string;
  market: ResearchMarket;
  ticker: string;
  assumptionId: string;
  assumptionStatement: string;
  jobId?: string;
  snapshotDirectory: string;
  sourceMode: ResearchSourceMode;
  now: () => Date;
  clients: PromotionClients;
}): Promise<PromotionOutcome> {
  const { db, candidateId, candidateUrl, market, ticker, assumptionId, assumptionStatement } = params;
  const nowIso = params.now().toISOString();

  const resolved = resolvePromotionClient(candidateUrl, params.clients);
  if (!resolved) {
    db.update(discoveryCandidates).set({
      status: 'rejected',
      rejectionReason: 'domain_not_allowlisted',
      updatedAt: nowIso,
    }).where(eq(discoveryCandidates.id, candidateId)).run();
    return 'rejected';
  }

  /*
   * `DEC-0015`'s table defines Class A as "direct company press releases and
   * investor relations announcements". Origin allowlisting proves only that a
   * URL is on a trusted domain, not that the page at it is a release — so
   * until now every fetched page on an issuer domain was labelled
   * "Web-discovered issuer release", including the site homepage and generic
   * IR overview and report-index pages, all of which are in the live database
   * under that label. A mislabel is not cosmetic: any secondary evidence row
   * moves its assumption to `pending_confirmation` and offers the user
   * "Accept secondary evidence" in the panel.
   *
   * Two stages, after an independent review found a URL-only gate insufficient
   * (2026-08-06). Only a bare origin is refused before the fetch — a homepage
   * is never an article, and refusing it costs no HTTP call. Every other
   * candidate is fetched and then classified from the document itself
   * (`classifySecondaryDocument`), because `DEC-0015` defines its classes by
   * document type and `ADR-0006` requires the target to be fetched *and*
   * classified. Judging the path alone also permanently rejected genuine
   * releases whose URLs use opaque or unlisted conventions.
   *
   * The post-fetch check reads `fetched.url`, so a candidate that redirects to
   * a different page is judged on where it actually landed — the URL written
   * into the snapshot — not on where it claimed to point.
   */
  if (isBareOrigin(candidateUrl)) {
    db.update(discoveryCandidates).set({
      status: 'rejected',
      rejectionReason: 'not_an_issuer_release',
      updatedAt: nowIso,
    }).where(eq(discoveryCandidates.id, candidateId)).run();
    return 'rejected';
  }

  let fetched;
  try {
    fetched = await resolved.client.get(candidateUrl, 'text/html,application/xhtml+xml;q=0.9,application/pdf;q=0.8');
  } catch (error) {
    db.update(discoveryCandidates).set({
      status: 'unreachable',
      rejectionReason: (error instanceof Error ? error.message : 'Fetch failed.').slice(0, 500),
      updatedAt: nowIso,
    }).where(eq(discoveryCandidates.id, candidateId)).run();
    return 'unreachable';
  }

  /*
   * Applied to issuer and news alike. An origin configured for a news feed
   * proves only that a publisher is allowlisted, not that this page is an
   * article — the same defect Class A had, and leaving Class B ungated was an
   * inconsistency the review declined to accept.
   *
   * Fails closed. A document that declares nothing is `undetermined`, and a
   * PDF has no such markup at all, so both fall back to the URL hint rather
   * than being admitted on the assumption that they are releases.
   */
  const isHtml = !(fetched.contentType === 'application/pdf' || fetched.url.toLowerCase().endsWith('.pdf'));
  const documentKind = isHtml
    ? classifySecondaryDocument(new TextDecoder().decode(fetched.bytes))
    : 'undetermined';
  const eligible = documentKind === 'article'
    || (documentKind === 'undetermined' && isIssuerReleaseUrl(new URL(fetched.url)));

  if (!eligible) {
    db.update(discoveryCandidates).set({
      status: 'rejected',
      // No `resultingDocumentHash`: that column is a foreign key into
      // `source_snapshots`, and a refused document is deliberately never
      // persisted there. The reason plus the candidate URL is the audit trail.
      rejectionReason: documentKind === 'not_article' ? 'not_an_article' : 'unclassifiable_document',
      updatedAt: nowIso,
    }).where(eq(discoveryCandidates.id, candidateId)).run();
    return 'rejected';
  }

  const snapshot: SourceSnapshot = {
    documentId: fetched.url,
    market,
    ticker,
    sourceUrl: fetched.url,
    sourceName: resolved.sourceClass === 'issuer'
      ? `Web-discovered issuer release (${ticker})`
      : `Web-discovered news article (${ticker})`,
    sourceTier: 'secondary',
    publishDate: null,
    sourceFormat: fetched.contentType === 'application/pdf' || fetched.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
    rawBytes: fetched.bytes,
    retrievalTimestamp: params.now().toISOString(),
    contentType: fetched.contentType,
    httpStatus: fetched.status,
  };
  const documentHash = createHash(snapshot.rawBytes);

  let extracted;
  try {
    extracted = await extractDocument(snapshot, {});
  } catch (error) {
    db.update(discoveryCandidates).set({
      status: 'unreachable',
      rejectionReason: (error instanceof Error ? error.message : 'Extraction failed.').slice(0, 500),
      updatedAt: nowIso,
    }).where(eq(discoveryCandidates.id, candidateId)).run();
    return 'unreachable';
  }

  // Everything past this point is persistence: a real, fetched, extracted
  // document exists either way. Wrapped in its own try/catch so an
  // unexpected failure here (a constraint violation, a bug in evidence
  // mapping) still leaves an audit trail on the candidate row instead of
  // leaving it silently stuck at `pending` forever with no diagnostic —
  // caught by an M008 test that (deliberately, before the fix) passed a
  // `jobId` violating `research_job_sources`' FK and reproduced exactly
  // that silent-stuck-pending failure mode.
  try {
    // The document itself is real, content-addressed, and safety-scanned
    // (extractDocument already runs scanEmbeddedInstructions) regardless of
    // whether it happens to match this assumption's wording, so it is
    // persisted even on a zero-candidate outcome below.
    persistSourceSnapshot({
      db,
      jobId: params.jobId,
      snapshot,
      documentHash,
      sourceMode: params.sourceMode,
      snapshotDirectory: params.snapshotDirectory,
      outcome: 'verified',
    });

    const verificationStatus = resolved.sourceClass === 'issuer' ? 'secondary_issuer' as const : 'secondary_news' as const;
    /*
     * Same identity exclusion the Class A/B paths apply: words that only say
     * which company this is cannot also show that a passage concerns this
     * assumption. Read from the thesis the assumption belongs to.
     */
    const owner = db.select({ companyName: theses.companyName })
      .from(theses)
      .innerJoin(assumptions, eq(assumptions.thesisId, theses.id))
      .where(eq(assumptions.id, assumptionId))
      .get();
    const identity = `${owner?.companyName ?? ''} ${market === 'ID' ? 'Indonesia' : 'United States'}`;
    const candidates = extractSecondaryCandidates(extracted, assumptionStatement, ticker, resolved.sourceClass, 3, identity);
    const insertedStatuses: VerifiedEvidence['verificationStatus'][] = [];

    db.transaction((tx) => {
      const contract = loadMeasurementContract(tx, assumptionId);
      for (const candidate of candidates) {
        try {
          verifyExactMatch(candidate.quote, extracted.canonicalText);
        } catch {
          continue;
        }
        const duplicate = tx.select({ id: evidence.id }).from(evidence).where(and(
          eq(evidence.assumptionId, assumptionId),
          eq(evidence.documentHash, documentHash),
          eq(evidence.content, candidate.quote),
        )).get();
        if (duplicate) continue;

        tx.insert(evidence).values(evidenceInsertValues(assumptionId, {
          sourceUrl: snapshot.sourceUrl,
          documentHash,
          canonicalTextHash: null,
          exactQuote: candidate.quote,
          impactSummary: candidate.impactSummary,
          sourceName: snapshot.sourceName,
          sourceTier: 'secondary',
          sourceFormat: snapshot.sourceFormat,
          sourceVariant: candidate.sourceVariant ?? null,
          contentKind: candidate.contentKind ?? 'text',
          publishDate: snapshot.publishDate,
          retrievalTimestamp: snapshot.retrievalTimestamp,
          extractionMethod: candidate.extractionMethod ?? 'html_parser',
          verificationStatus,
          pageNumber: candidate.pageNumber,
          boundingBox: candidate.boundingBox ?? null,
          metadata: { ...(candidate.metadata ?? {}), untrustedInstructionFlagged: extracted.untrustedInstructionFlagged },
        }, contract)).run();
        insertedStatuses.push(verificationStatus);
      }
      if (insertedStatuses.length > 0) {
        applyAssumptionStatusGate(tx, assumptionId, insertedStatuses, params.now().toISOString());
      }
    });

    db.update(discoveryCandidates).set({
      status: 'fetched',
      resultingDocumentHash: documentHash,
      updatedAt: nowIso,
    }).where(eq(discoveryCandidates.id, candidateId)).run();

    return insertedStatuses.length > 0 ? 'promoted' : 'no_matching_evidence';
  } catch (error) {
    db.update(discoveryCandidates).set({
      status: 'unreachable',
      rejectionReason: (error instanceof Error ? error.message : 'Promotion failed after fetch.').slice(0, 500),
      updatedAt: nowIso,
    }).where(eq(discoveryCandidates.id, candidateId)).run();
    return 'unreachable';
  }
}

/**
 * M008 Slice 3, automatic path. Called once per claimed job inside
 * `processResearchJobs`, right after that job's discovery search — sweeps
 * every `pending` candidate for this job's ticker against this job's
 * assumption. Never throws: a single candidate's crash (network, parsing,
 * anything) is caught here and skipped, exactly like `runSecondaryResearchCall`'s
 * soft-failure boundary — never touches `research_jobs.status`.
 */
export async function promotePendingForAssumption(params: {
  db: AppDatabase;
  market: ResearchMarket;
  ticker: string;
  assumptionId: string;
  assumptionStatement: string;
  jobId: string;
  snapshotDirectory: string;
  sourceMode: ResearchSourceMode;
  now: () => Date;
  clients: PromotionClients;
}): Promise<void> {
  const pending = params.db.select().from(discoveryCandidates).where(and(
    eq(discoveryCandidates.market, params.market),
    eq(discoveryCandidates.ticker, params.ticker),
    eq(discoveryCandidates.status, 'pending'),
  )).all();

  for (const row of pending) {
    try {
      await promoteCandidate({
        db: params.db,
        candidateId: row.id,
        candidateUrl: row.candidateUrl,
        market: params.market,
        ticker: params.ticker,
        assumptionId: params.assumptionId,
        assumptionStatement: params.assumptionStatement,
        jobId: params.jobId,
        snapshotDirectory: params.snapshotDirectory,
        sourceMode: params.sourceMode,
        now: params.now,
        clients: params.clients,
      });
    } catch {
      // Soft failure, by design — one candidate must never block another's
      // promotion or the owning research job.
    }
  }
}

export type PromotionSweepStats = {
  candidatesConsidered: number;
  assumptionsAttempted: number;
  promoted: number;
  rejected: number;
  unreachable: number;
  noMatchingEvidence: number;
};

/**
 * M008 Slice 3, explicit path (`scripts/promote-discoveries.ts`). Sweeps
 * every `pending` candidate, plus every `rejected: domain_not_allowlisted`
 * candidate (re-checked in case `.env` allowlists changed since rejection —
 * the whole reason this script exists), against every active thesis
 * assumption tracking that candidate's ticker. No `jobId`: this runs outside
 * `processResearchJobs`, so `persistSourceSnapshot` (via `promoteCandidate`)
 * skips the `research_job_sources` audit row for these fetches by design.
 */
export async function promoteAllEligibleCandidates(params: {
  db: AppDatabase;
  snapshotDirectory: string;
  sourceMode: ResearchSourceMode;
  now: () => Date;
  clients: PromotionClients;
}): Promise<PromotionSweepStats> {
  const rows = params.db.select().from(discoveryCandidates).where(
    or(
      eq(discoveryCandidates.status, 'pending'),
      and(
        eq(discoveryCandidates.status, 'rejected'),
        inArray(discoveryCandidates.rejectionReason, [...REVIEWABLE_REJECTION_REASONS]),
      ),
    ),
  ).all();

  const stats: PromotionSweepStats = {
    candidatesConsidered: rows.length,
    assumptionsAttempted: 0,
    promoted: 0,
    rejected: 0,
    unreachable: 0,
    noMatchingEvidence: 0,
  };

  for (const row of rows) {
    const matchingAssumptions = params.db
      .select({ assumptionId: assumptions.id, statement: assumptions.statement })
      .from(assumptions)
      .innerJoin(theses, eq(assumptions.thesisId, theses.id))
      .where(and(
        eq(theses.ticker, row.ticker),
        eq(theses.market, row.market),
        eq(theses.status, 'active'),
      ))
      .all();

    for (const assumption of matchingAssumptions) {
      stats.assumptionsAttempted += 1;
      try {
        const outcome = await promoteCandidate({
          db: params.db,
          candidateId: row.id,
          candidateUrl: row.candidateUrl,
          market: row.market as ResearchMarket,
          ticker: row.ticker,
          assumptionId: assumption.assumptionId,
          assumptionStatement: assumption.statement,
          snapshotDirectory: params.snapshotDirectory,
          sourceMode: params.sourceMode,
          now: params.now,
          clients: params.clients,
        });
        if (outcome === 'promoted') stats.promoted += 1;
        else if (outcome === 'rejected') stats.rejected += 1;
        else if (outcome === 'unreachable') stats.unreachable += 1;
        else stats.noMatchingEvidence += 1;
      } catch {
        stats.unreachable += 1;
      }
    }
  }

  return stats;
}
