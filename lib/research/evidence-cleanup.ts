import 'server-only';

import fs from 'node:fs';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { assumptions, evidence, sourceSnapshots, theses } from '@/db/schema';
import { deriveAssumptionStatusAfterEvidenceRemoval, type AssumptionStatus } from './assumption-status';
import { extractSecondaryCandidates } from './extractors/candidate';
import { extractDocument } from './extractors/document';
import { hasOfficialEvidence } from './evidence-persistence';

/**
 * M010 Slice 4. Removes secondary evidence rows that the M010-fixed extractor
 * would no longer produce.
 *
 * M009 deliberately scoped cleanup out, so the 15 low-quality rows from the
 * 2026-07-26 TLKM run stayed visible in the product even after the extractor
 * was fixed. Fixing an extractor never retroactively removes what a broken one
 * already wrote.
 *
 * The selector deliberately RE-DERIVES rather than hardcoding row ids or
 * matching boilerplate patterns: for each candidate row it re-reads the
 * retained snapshot and re-runs the real extraction path, then marks the row
 * stale iff its stored `content` is no longer among the quotes the fixed
 * extractor produces. That makes this self-validating — if the M010 slices
 * under-fix, this under-deletes, visibly, rather than papering over the gap
 * with a second denylist.
 */

/** Never touched, asserted by test — the official trust tier is out of scope. */
const CLEANABLE_VERIFICATION_STATUSES = ['secondary_issuer', 'secondary_news'] as const;

export type CleanupRowOutcome = 'stale' | 'kept' | 'unresolvable';

export type CleanupRowReport = {
  evidenceId: string;
  assumptionId: string;
  outcome: CleanupRowOutcome;
  reason: string;
  sourceUrl: string;
  documentHash: string;
  retrievalTimestamp: string;
  content: string;
};

export type CleanupAssumptionReport = {
  assumptionId: string;
  previousStatus: string;
  nextStatus: string | null;
  needsManualReview: boolean;
};

export type CleanupReport = {
  applied: boolean;
  scanned: number;
  stale: number;
  kept: number;
  unresolvable: number;
  rows: CleanupRowReport[];
  assumptions: CleanupAssumptionReport[];
};

export async function cleanupBoilerplateEvidence(input: {
  db: AppDatabase;
  apply?: boolean;
  now?: () => Date;
}): Promise<CleanupReport> {
  const { db } = input;
  const apply = input.apply ?? false;
  const now = input.now ?? (() => new Date());

  const candidates = db
    .select({
      id: evidence.id,
      assumptionId: evidence.assumptionId,
      verificationStatus: evidence.verificationStatus,
      content: evidence.content,
      documentHash: evidence.documentHash,
      sourceUrl: evidence.sourceUrl,
      retrievalTimestamp: evidence.retrievalTimestamp,
      interpretationStatus: evidence.interpretationStatus,
      sourceTier: evidence.sourceTier,
    })
    .from(evidence)
    .where(and(
      eq(evidence.sourceTier, 'secondary'),
      inArray(evidence.verificationStatus, [...CLEANABLE_VERIFICATION_STATUSES]),
      // An interpretation that is no longer 'pending' carries a user or model
      // judgement about this row. Removing it would destroy that judgement, so
      // those rows are left alone regardless of what re-extraction says.
      eq(evidence.interpretationStatus, 'pending'),
    ))
    .all();

  const rows: CleanupRowReport[] = [];
  // Re-extraction is per (document, assumption) pair, and the 2026-07-26 run
  // produced many rows per document — cache so a document is parsed once.
  const quotesByPair = new Map<string, Set<string> | null>();

  for (const row of candidates) {
    const base: Omit<CleanupRowReport, 'outcome' | 'reason'> = {
      evidenceId: row.id,
      assumptionId: row.assumptionId,
      sourceUrl: row.sourceUrl,
      documentHash: row.documentHash,
      retrievalTimestamp: row.retrievalTimestamp,
      content: row.content,
    };

    const pairKey = `${row.documentHash}::${row.assumptionId}::${row.verificationStatus}`;
    let quotes = quotesByPair.get(pairKey);
    if (quotes === undefined) {
      quotes = await reExtractQuotes(db, row.documentHash, row.assumptionId, row.verificationStatus);
      quotesByPair.set(pairKey, quotes);
    }

    if (quotes === null) {
      // Never delete a row that cannot be re-derived: without the snapshot
      // there is no evidence either way, and destroying it would be guessing.
      rows.push({ ...base, outcome: 'unresolvable', reason: 'Retained snapshot is missing or unreadable; row left untouched.' });
      continue;
    }

    if (quotes.has(row.content)) {
      rows.push({ ...base, outcome: 'kept', reason: 'The fixed extractor still produces this quote.' });
    } else {
      rows.push({ ...base, outcome: 'stale', reason: 'The fixed extractor no longer produces this quote.' });
    }
  }

  const staleIds = rows.filter((row) => row.outcome === 'stale').map((row) => row.evidenceId);
  const affectedAssumptionIds = [...new Set(rows.filter((row) => row.outcome === 'stale').map((row) => row.assumptionId))];
  const assumptionReports: CleanupAssumptionReport[] = [];

  if (apply && staleIds.length) {
    const nowIso = now().toISOString();
    db.transaction((tx) => {
      tx.delete(evidence).where(inArray(evidence.id, staleIds)).run();

      for (const assumptionId of affectedAssumptionIds) {
        const current = tx.select({ status: assumptions.status }).from(assumptions).where(eq(assumptions.id, assumptionId)).get();
        if (!current) continue;
        const remainingSecondary = tx.select({ id: evidence.id }).from(evidence).where(and(
          eq(evidence.assumptionId, assumptionId),
          inArray(evidence.verificationStatus, [...CLEANABLE_VERIFICATION_STATUSES]),
        )).get();
        const next = deriveAssumptionStatusAfterEvidenceRemoval({
          currentStatus: current.status as AssumptionStatus,
          hasRemainingSecondaryEvidence: Boolean(remainingSecondary),
          hasOfficialEvidence: hasOfficialEvidence(tx, assumptionId),
        });
        if (next && next !== 'needs_manual_review' && next !== current.status) {
          tx.update(assumptions).set({ status: next, updatedAt: nowIso }).where(eq(assumptions.id, assumptionId)).run();
        }
        assumptionReports.push({
          assumptionId,
          previousStatus: current.status,
          nextStatus: next === 'needs_manual_review' ? null : next,
          needsManualReview: next === 'needs_manual_review',
        });
      }
    });
  } else {
    // Dry run reports the same assumption transitions it would make, without
    // writing — so the report a reviewer reads is the report `--apply` acts on.
    for (const assumptionId of affectedAssumptionIds) {
      const current = db.select({ status: assumptions.status }).from(assumptions).where(eq(assumptions.id, assumptionId)).get();
      if (!current) continue;
      const remainingSecondary = db.select({ id: evidence.id }).from(evidence).where(and(
        eq(evidence.assumptionId, assumptionId),
        inArray(evidence.verificationStatus, [...CLEANABLE_VERIFICATION_STATUSES]),
      )).all().filter((candidate) => !staleIds.includes(candidate.id));
      const next = deriveAssumptionStatusAfterEvidenceRemoval({
        currentStatus: current.status as AssumptionStatus,
        hasRemainingSecondaryEvidence: remainingSecondary.length > 0,
        hasOfficialEvidence: hasOfficialEvidence(db, assumptionId),
      });
      assumptionReports.push({
        assumptionId,
        previousStatus: current.status,
        nextStatus: next === 'needs_manual_review' ? null : next,
        needsManualReview: next === 'needs_manual_review',
      });
    }
  }

  return {
    applied: apply,
    scanned: rows.length,
    stale: rows.filter((row) => row.outcome === 'stale').length,
    kept: rows.filter((row) => row.outcome === 'kept').length,
    unresolvable: rows.filter((row) => row.outcome === 'unresolvable').length,
    rows,
    assumptions: assumptionReports,
  };
}

/**
 * Returns the quote set the fixed extractor now produces for this document and
 * assumption, or `null` when the retained snapshot cannot be read — which is
 * reported as `unresolvable` rather than treated as "produces nothing", since
 * the two are very different and only one of them justifies a delete.
 */
async function reExtractQuotes(
  db: AppDatabase,
  documentHash: string,
  assumptionId: string,
  verificationStatus: string,
): Promise<Set<string> | null> {
  const snapshot = db.select().from(sourceSnapshots).where(eq(sourceSnapshots.documentHash, documentHash)).get();
  if (!snapshot) return null;

  const assumptionRow = db
    .select({ statement: assumptions.statement, ticker: theses.ticker })
    .from(assumptions)
    .innerJoin(theses, eq(assumptions.thesisId, theses.id))
    .where(eq(assumptions.id, assumptionId))
    .get();
  if (!assumptionRow?.ticker) return null;

  let rawBytes: Uint8Array;
  try {
    rawBytes = new Uint8Array(fs.readFileSync(snapshot.storagePath));
  } catch {
    return null;
  }

  try {
    const extracted = await extractDocument({
      documentId: snapshot.documentId,
      market: snapshot.market,
      ticker: snapshot.ticker,
      sourceUrl: snapshot.sourceUrl,
      sourceName: snapshot.sourceName,
      sourceTier: snapshot.sourceTier,
      publishDate: snapshot.publishDate,
      sourceFormat: snapshot.sourceFormat,
      rawBytes,
      retrievalTimestamp: snapshot.retrievalTimestamp,
      contentType: snapshot.contentType,
      httpStatus: snapshot.httpStatus,
    }, {});
    const sourceClass = verificationStatus === 'secondary_news' ? 'news' : 'issuer';
    const candidates = extractSecondaryCandidates(extracted, assumptionRow.statement, assumptionRow.ticker, sourceClass);
    return new Set(candidates.map((candidate) => candidate.quote));
  } catch {
    return null;
  }
}
