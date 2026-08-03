import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { assumptions, evidence } from '@/db/schema';
import type { MeasurementContract } from '@/lib/domain/contracts';
import { deriveAssumptionStatus, type AssumptionStatus } from './assumption-status';
import type { VerifiedEvidence } from './pipeline';
import { classifyPolarity, readObservedMeasurement, type PolarityResult } from './polarity';

/**
 * Shared by `lib/research/service.ts` (official/Class A/B evidence) and
 * `lib/research/discovery-promotion.ts` (M008 Class C promoted evidence) —
 * split out of `service.ts` specifically so discovery-promotion.ts can reuse
 * this evidence-insert/status-gate logic without importing `service.ts`
 * itself, which would create a cycle (`service.ts` calls into
 * discovery-promotion.ts to run promotion inside `processResearchJobs`).
 */

export function hasOfficialEvidence(
  tx: { select: AppDatabase['select'] },
  assumptionId: string,
): boolean {
  const row = tx.select({ id: evidence.id }).from(evidence).where(and(
    eq(evidence.assumptionId, assumptionId),
    inArray(evidence.verificationStatus, ['exact_verified', 'ocr_matched']),
  )).get();
  return Boolean(row);
}

/**
 * M007 Slice 5. Applies the confirmation-gate decision inside the same
 * transaction as an evidence insert, given the just-inserted evidence's
 * verification statuses. No-op when `deriveAssumptionStatus` returns null
 * (nothing to change) or the same status (avoids a pointless write).
 */
export function applyAssumptionStatusGate(
  tx: { select: AppDatabase['select']; update: AppDatabase['update'] },
  assumptionId: string,
  insertedVerificationStatuses: VerifiedEvidence['verificationStatus'][],
  nowIso: string,
): void {
  const current = tx.select({ status: assumptions.status }).from(assumptions).where(eq(assumptions.id, assumptionId)).get();
  if (!current) return;
  const nextStatus = deriveAssumptionStatus({
    currentStatus: current.status as AssumptionStatus,
    insertedVerificationStatuses,
    hasOfficialEvidence: hasOfficialEvidence(tx, assumptionId),
  });
  if (nextStatus && nextStatus !== current.status) {
    tx.update(assumptions).set({ status: nextStatus, updatedAt: nowIso }).where(eq(assumptions.id, assumptionId)).run();
  }
}

/**
 * M011. Polarity is computed here rather than in the candidate extractors or
 * in `CitationPipeline`, for two reasons.
 *
 * The extractors are pure text/fact modules with no access to a DB-derived
 * measurement contract, and threading one in would give the domain layer a
 * reverse dependency into extraction. More importantly, the pipeline's
 * per-candidate loop swallows any throw (`pipeline.ts`'s `catch {}`), so a
 * polarity bug there would present as *silently missing evidence* rather than
 * as a wrong verdict. Polarity failing must always degrade to `inconclusive`,
 * never to a missing row — and this function is the single choke point every
 * evidence row in the database passes through.
 *
 * `contract` is required rather than optional on purpose: a future insert site
 * must state `null` explicitly, instead of forgetting the argument and quietly
 * persisting `inconclusive` for an assumption that does have a contract.
 */
export function evidenceInsertValues(
  assumptionId: string,
  result: VerifiedEvidence,
  contract: MeasurementContract | null,
  /**
   * M011. Supplied only when the optional `PolarityClassifier` seam is
   * configured, which nothing does by default. Passing it in — rather than
   * calling the classifier here — keeps this function synchronous, which it
   * must be: it runs inside a better-sqlite3 transaction, where an await would
   * hold the write lock across a network round trip.
   */
  precomputed?: PolarityResult,
) {
  const { polarity, deltaVsThreshold, method } = precomputed ?? classifyPolarity({
    contract,
    observed: readObservedMeasurement(result.metadata),
  });
  return {
    id: randomUUID(),
    polarity,
    deltaVsThreshold,
    polarityMethod: method,
    assumptionId,
    sourceFormat: result.sourceFormat,
    contentKind: result.contentKind,
    sourceVariant: result.sourceVariant,
    extractionMethod: result.extractionMethod,
    verificationStatus: result.verificationStatus,
    sourceTier: result.sourceTier,
    sourceName: result.sourceName,
    publishDate: result.publishDate,
    documentHash: result.documentHash,
    canonicalTextHash: result.canonicalTextHash,
    boundingBox: result.boundingBox ? JSON.stringify(result.boundingBox) : null,
    sourceUrl: result.sourceUrl,
    retrievalTimestamp: result.retrievalTimestamp,
    content: result.exactQuote,
    impactSummary: result.impactSummary,
    pageNumber: result.pageNumber,
    interpretationStatus: 'pending' as const,
    metadata: JSON.stringify(result.metadata),
  };
}
