import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { assumptions, evidence } from '@/db/schema';
import { deriveAssumptionStatus, type AssumptionStatus } from './assumption-status';
import type { VerifiedEvidence } from './pipeline';

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

export function evidenceInsertValues(assumptionId: string, result: VerifiedEvidence) {
  return {
    id: randomUUID(),
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
