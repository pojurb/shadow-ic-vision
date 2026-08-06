import 'server-only';

import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { assumptions, discoveryCandidates, evidence, sourceSnapshots } from '@/db/schema';
import { classifySecondaryDocument } from './secondary-document';

/**
 * Repairs rows written before Class-C promotion classified the documents it
 * fetched (`cf306da`). Until then promotion labelled any page on an
 * allowlisted issuer origin a "Web-discovered issuer release", so the live
 * database holds the issuer homepage and four IR overview/report-index pages
 * under a label `DEC-0015` reserves for direct releases and announcements.
 *
 * Mechanics follow the M010 precedent in `evidence-cleanup.ts` — dry run by
 * default, raw snapshots retained, invalid derived evidence deleted, status
 * recomputed, human decisions flagged rather than reversed. That precedent
 * governs *how*, not *whether*: this cleanup was authorized separately.
 *
 * Decides per document rather than per label: each retained snapshot file is
 * re-classified, and only those the classifier calls `not_article` are acted
 * on. A blanket match on the label would rely on the very assumption that
 * turned out to be wrong.
 *
 * Deliberately does **not** delete the snapshot rows or their raw files. The
 * fetch genuinely happened and is content-addressed; erasing it would destroy
 * the audit trail that made this defect provable. Only the descriptive label
 * changes, to one that claims nothing the document does not support.
 */
export type PromotionCleanupReport = {
  relabelledSnapshots: Array<{ documentHash: string; sourceUrl: string; from: string; to: string }>;
  deletedEvidence: Array<{ id: string; sourceUrl: string; assumptionId: string; quote: string }>;
  recomputedAssumptions: Array<{ assumptionId: string; from: string; to: string }>;
  reclassifiedCandidates: Array<{ id: string; candidateUrl: string; from: string }>;
  flaggedForManualReview: Array<{ assumptionId: string; status: string; reason: string }>;
  unreadableSnapshots: Array<{ documentHash: string; storagePath: string }>;
  applied: boolean;
};

const MISLABELLED_PREFIX = 'Web-discovered issuer release';

/** Claims retrieval and origin, which are true, and nothing about document type. */
function neutralLabel(ticker: string): string {
  return `Web-discovered issuer page (${ticker})`;
}

export function cleanupMislabelledPromotions(params: {
  db: AppDatabase;
  apply: boolean;
}): PromotionCleanupReport {
  const { db, apply } = params;
  const report: PromotionCleanupReport = {
    relabelledSnapshots: [],
    deletedEvidence: [],
    recomputedAssumptions: [],
    reclassifiedCandidates: [],
    flaggedForManualReview: [],
    unreadableSnapshots: [],
    applied: apply,
  };

  const candidateSnapshots = db.select().from(sourceSnapshots).all()
    .filter((row) => row.sourceName.startsWith(MISLABELLED_PREFIX));

  const confirmedNotArticle = new Set<string>();
  for (const snapshot of candidateSnapshots) {
    let kind: ReturnType<typeof classifySecondaryDocument>;
    try {
      kind = classifySecondaryDocument(fs.readFileSync(snapshot.storagePath, 'utf8'));
    } catch {
      // Cannot re-verify, so cannot justify changing anything about it.
      report.unreadableSnapshots.push({ documentHash: snapshot.documentHash, storagePath: snapshot.storagePath });
      continue;
    }
    if (kind !== 'not_article') continue;

    confirmedNotArticle.add(snapshot.sourceUrl);
    report.relabelledSnapshots.push({
      documentHash: snapshot.documentHash,
      sourceUrl: snapshot.sourceUrl,
      from: snapshot.sourceName,
      to: neutralLabel(snapshot.ticker),
    });
    if (apply) {
      db.update(sourceSnapshots)
        .set({ sourceName: neutralLabel(snapshot.ticker) })
        .where(eq(sourceSnapshots.documentHash, snapshot.documentHash))
        .run();
    }
  }

  const staleEvidence = db.select().from(evidence).all()
    .filter((row) => row.sourceName.startsWith(MISLABELLED_PREFIX) && confirmedNotArticle.has(row.sourceUrl));

  const touchedAssumptions = new Set<string>();
  for (const row of staleEvidence) {
    report.deletedEvidence.push({
      id: row.id,
      sourceUrl: row.sourceUrl,
      assumptionId: row.assumptionId,
      quote: row.content.replace(/\s+/g, ' ').slice(0, 160),
    });
    touchedAssumptions.add(row.assumptionId);
    if (apply) db.delete(evidence).where(eq(evidence.id, row.id)).run();
  }

  for (const assumptionId of touchedAssumptions) {
    const assumption = db.select().from(assumptions).where(eq(assumptions.id, assumptionId)).get();
    if (!assumption) continue;

    /*
     * `user_confirmed_secondary` records that a human looked at the evidence
     * and accepted it. Reversing that silently would overwrite a person's
     * judgment with a script's, so it is reported for manual review instead —
     * even though the evidence they saw may have included a deleted row.
     */
    if (assumption.status === 'user_confirmed_secondary') {
      report.flaggedForManualReview.push({
        assumptionId,
        status: assumption.status,
        reason: 'Accepted by a human while mislabelled evidence was present; re-review rather than auto-revert.',
      });
      continue;
    }

    const remaining = apply
      ? db.select().from(evidence).where(eq(evidence.assumptionId, assumptionId)).all().length
      : db.select().from(evidence).where(eq(evidence.assumptionId, assumptionId)).all()
        .filter((row) => !report.deletedEvidence.some((deleted) => deleted.id === row.id)).length;

    if (remaining === 0 && assumption.status === 'pending_confirmation') {
      report.recomputedAssumptions.push({ assumptionId, from: assumption.status, to: 'untested' });
      if (apply) db.update(assumptions).set({ status: 'untested' }).where(eq(assumptions.id, assumptionId)).run();
    }
  }

  for (const candidate of db.select().from(discoveryCandidates).where(eq(discoveryCandidates.status, 'fetched')).all()) {
    if (![...confirmedNotArticle].some((url) => url === candidate.candidateUrl || url.startsWith(candidate.candidateUrl))) continue;
    report.reclassifiedCandidates.push({ id: candidate.id, candidateUrl: candidate.candidateUrl, from: candidate.status });
    if (apply) {
      /*
       * `resultingDocumentHash` is left in place: the snapshot row it points
       * at is retained, so the foreign key stays valid and the rejection keeps
       * its link to the document it was decided from.
       */
      db.update(discoveryCandidates)
        .set({ status: 'rejected', rejectionReason: 'not_an_article' })
        .where(eq(discoveryCandidates.id, candidate.id))
        .run();
    }
  }

  return report;
}
