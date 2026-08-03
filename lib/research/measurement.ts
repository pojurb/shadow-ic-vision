import 'server-only';

import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { assumptionMeasurements } from '@/db/schema';
import {
  LEGACY_MEASUREMENT_CONTRACT,
  measurementContractSchema,
  type MeasurementContract,
} from '@/lib/domain/contracts';

/**
 * M011. The row/contract boundary for `assumption_measurements`.
 *
 * Deliberately standalone — it imports only the schema and the domain contract,
 * never `service.ts` or `pipeline.ts`, for the same cycle-avoidance reason
 * `evidence-persistence.ts` was split out (see that file's header).
 *
 * Only `sourceTags` needs serializing; every other field is a scalar column, so
 * a malformed row degrades one list rather than the whole contract.
 */
export function measurementInsertValues(assumptionId: string, contract: MeasurementContract) {
  return {
    assumptionId,
    resolution: contract.resolution,
    metric: contract.metric,
    definitionVariant: contract.definitionVariant,
    operator: contract.operator,
    threshold: contract.threshold,
    unit: contract.unit,
    timeBasis: contract.timeBasis,
    sourceTags: JSON.stringify(contract.sourceTags),
    clarifyingQuestion: contract.clarifyingQuestion,
    ambiguityReason: contract.ambiguityReason,
  };
}

type MeasurementRow = typeof assumptionMeasurements.$inferSelect;

/**
 * Row -> contract. Total: an unparseable `source_tags` blob costs the tag list,
 * not the contract, and a row that somehow fails `measurementContractSchema`
 * degrades to the legacy sentinel rather than throwing. Both degradations point
 * the same way — toward "we cannot check this", never toward a false verdict.
 */
export function toMeasurementContract(row: MeasurementRow): MeasurementContract {
  let sourceTags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.sourceTags);
    if (Array.isArray(parsed)) sourceTags = parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch {
    sourceTags = [];
  }

  const candidate = {
    resolution: row.resolution,
    metric: row.metric,
    definitionVariant: row.definitionVariant,
    operator: row.operator,
    threshold: row.threshold,
    unit: row.unit,
    timeBasis: row.timeBasis,
    sourceTags,
    clarifyingQuestion: row.clarifyingQuestion,
    ambiguityReason: row.ambiguityReason,
  };

  const parsed = measurementContractSchema.safeParse(candidate);
  return parsed.success ? parsed.data : LEGACY_MEASUREMENT_CONTRACT;
}

/**
 * Loads one assumption's contract. Returns `null` — meaning "no contract row at
 * all" — distinctly from a `legacy_unspecified` contract, which means "a row
 * exists and says this predates M011". `classifyPolarity` treats both as
 * inconclusive, but the coverage ledger reports them differently.
 */
export function loadMeasurementContract(
  tx: { select: AppDatabase['select'] },
  assumptionId: string,
): MeasurementContract | null {
  const row = tx
    .select()
    .from(assumptionMeasurements)
    .where(eq(assumptionMeasurements.assumptionId, assumptionId))
    .get();
  return row ? toMeasurementContract(row) : null;
}
