import { z } from 'zod';
import { OLLAMA_MODEL_IDS } from '@/lib/ai/ollama-models';

export const marketSchema = z.enum(['US', 'ID']);
export const assumptionStatusSchema = z.enum([
  'untested',
  'verified',
  'challenged',
  'held-belief',
  // M007: secondary-only evidence with no official confirmation yet.
  'pending_confirmation',
  // M007: explicitly accepted by the user; deliberately distinct from
  // 'verified' so a secondary-only assumption never looks officially
  // verified even after acceptance.
  'user_confirmed_secondary',
]);
/**
 * M011. Mirrors `EvidencePolarity` in `lib/research/polarity.ts`, which is the
 * module that computes it; declared here too because this file is the shared
 * client/server contract boundary and must not import from `lib/research`.
 */
export const evidencePolaritySchema = z.enum(['supports', 'contradicts', 'inconclusive']);
export type EvidencePolarity = z.infer<typeof evidencePolaritySchema>;

export const researchJobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'degraded',
  'failed',
]);

/**
 * M011 — the measurement contract.
 *
 * An assumption like "automotive gross margin stays above 20% through 2026" is
 * not actually falsifiable until four things are pinned down: which of several
 * defensible definitions of the metric is meant, what the threshold and
 * comparison are, in what unit, and over what reporting period. Until then the
 * same claim is true under one reading and false under another, and evidence
 * matched against it can only ever be topically relevant, never confirming or
 * disconfirming.
 *
 * Deliberately a flat object with a `resolution` discriminator rather than a
 * `z.discriminatedUnion`: `lib/ai/adapters/ollama.ts` feeds this schema through
 * `z.toJSONSchema` to constrain the model's own output grammar, and a flat
 * object with an enum converts far more predictably than a union does.
 */
export const measurementResolutionSchema = z.enum([
  'resolved',
  'ambiguous',
  // Genuinely qualitative ("management remains committed to the programme").
  // Load-bearing: without it every non-numeric assumption would be permanently
  // ambiguous and would block its draft forever.
  'not_measurable',
  // Assigned by the app, never by the model: a draft persisted before M011, or
  // an extraction that omitted the block entirely. `draftClarificationBlock`
  // treats it as blocking, so omission fails loudly rather than passing.
  'legacy_unspecified',
]);

export const measurementOperatorSchema = z.enum([
  'gte', 'gt', 'lte', 'lt', 'eq',
  // Directional claims with no absolute threshold ("margins expand as
  // production scales") — compared against a prior-period value, not a constant.
  'increases', 'decreases',
  'none',
]);

export const measurementUnitSchema = z.enum([
  'percent', 'ratio', 'usd', 'idr', 'count', 'unspecified',
]);

/**
 * The instant-versus-duration axis, named at the contract level rather than
 * inferred at retrieval time. This is the field the XBRL fact gate reads to
 * mechanically refuse a balance-sheet fact for a flow claim — the defect where
 * deferred revenue (a balance) was matched to an assumption about recognized
 * revenue growth (a flow).
 */
export const measurementTimeBasisSchema = z.enum([
  'instant',
  'duration_quarter',
  'duration_ytd',
  'duration_annual',
  'duration_ttm',
  'unspecified',
]);

export const measurementAmbiguityReasonSchema = z.enum([
  'none',
  'metric_undefined',
  'definition_variant_ambiguous',
  'threshold_missing',
  'time_basis_ambiguous',
  'unit_ambiguous',
]);

export type MeasurementResolution = z.infer<typeof measurementResolutionSchema>;
export type MeasurementOperator = z.infer<typeof measurementOperatorSchema>;
export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;
export type MeasurementTimeBasis = z.infer<typeof measurementTimeBasisSchema>;
export type MeasurementAmbiguityReason = z.infer<typeof measurementAmbiguityReasonSchema>;

/** Operators that compare an observed value against a constant threshold. */
export const THRESHOLD_OPERATORS: ReadonlySet<MeasurementOperator> = new Set([
  'gte', 'gt', 'lte', 'lt', 'eq',
]);

export const measurementContractSchema = z.object({
  resolution: measurementResolutionSchema,
  /** The measurable quantity, normalized. e.g. "automotive gross margin". */
  metric: z.string().trim().max(120),
  /** Which of several defensible definitions. e.g. "automotive segment,
   *  excluding regulatory credits, GAAP". */
  definitionVariant: z.string().trim().max(200),
  operator: measurementOperatorSchema,
  threshold: z.number().nullable(),
  unit: measurementUnitSchema,
  timeBasis: measurementTimeBasisSchema,
  /** Candidate us-gaap XBRL tags, most specific first. Empty is legal and means
   *  "no structured fact source" — the ID market always lands here. */
  sourceTags: z.array(z.string().trim().regex(/^[A-Za-z][A-Za-z0-9]{1,119}$/)).max(8),
  /** Exactly one question, shown verbatim in the draft card. */
  clarifyingQuestion: z.string().trim().max(400).nullable(),
  ambiguityReason: measurementAmbiguityReasonSchema,
}).superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (value.resolution === 'resolved') {
    if (!value.metric) issue('A resolved contract must name a metric.');
    if (value.ambiguityReason !== 'none') issue('A resolved contract cannot carry an ambiguity reason.');
    if (value.clarifyingQuestion !== null) issue('A resolved contract cannot carry a clarifying question.');
    if (value.timeBasis === 'unspecified') issue('A resolved contract must fix a time basis.');
    if (THRESHOLD_OPERATORS.has(value.operator)) {
      if (value.threshold === null) issue('A threshold operator requires a threshold.');
      if (value.unit === 'unspecified') issue('A threshold requires a unit.');
    }
  }
  if (value.resolution === 'ambiguous') {
    if (!value.clarifyingQuestion) issue('An ambiguous contract must supply a clarifying question.');
    if (value.ambiguityReason === 'none') issue('An ambiguous contract must name why.');
  }
  if (value.resolution === 'not_measurable' && value.operator !== 'none') {
    issue('A not_measurable contract cannot carry a comparison operator.');
  }
});

export type MeasurementContract = z.infer<typeof measurementContractSchema>;

/**
 * The sentinel for a draft that predates M011 or whose extraction omitted the
 * block. Deliberately not a "safe default": it resolves to *blocked*, so a
 * missing contract stops confirmation rather than silently passing as measured.
 */
export const LEGACY_MEASUREMENT_CONTRACT: MeasurementContract = {
  resolution: 'legacy_unspecified',
  metric: '',
  definitionVariant: '',
  operator: 'none',
  threshold: null,
  unit: 'unspecified',
  timeBasis: 'unspecified',
  sourceTags: [],
  clarifyingQuestion: null,
  ambiguityReason: 'none',
};

export const thesisDraftSchema = z.object({
  ticker: z.string().trim().min(1).max(12),
  companyName: z.string().trim().min(1).max(160),
  market: marketSchema,
  coreBelief: z.string().trim().min(1).max(4_000),
  assumptions: z
    .array(
      z.object({
        statement: z.string().trim().min(1).max(1_000),
        status: assumptionStatusSchema,
        // M011. `.default()` rather than required-or-optional, on measured Zod 4
        // behavior: a defaulted field still appears in `z.toJSONSchema`'s
        // `required` array (so the model is instructed to produce it) *and*
        // every historical `messages.structured_payload` row still parses in
        // `toMessageDTO`. Omission is not silently tolerated — the sentinel
        // resolves to blocked in `draftClarificationBlock`. That library
        // behavior is pinned by a regression test in
        // `tests/measurement-contract.test.ts`.
        measurement: measurementContractSchema.default(LEGACY_MEASUREMENT_CONTRACT),
      }),
    )
    .min(1)
    .max(12),
  requiresChallenge: z.boolean().default(false),
});

export type ThesisDraft = z.infer<typeof thesisDraftSchema>;

/**
 * M011. The single source of truth for "may this draft be confirmed?", shared
 * by the client (`components/ChatUI.tsx` disables the button) and the server
 * (`confirmDraft` refuses outright). Pure and dependency-free so both can
 * import it — this module pulls in no `server-only`.
 *
 * A disabled button is not a control, which is why both halves exist.
 */
export function draftClarificationBlock(draft: ThesisDraft): {
  blocked: boolean;
  questions: Array<{ statement: string; question: string; reason: MeasurementAmbiguityReason }>;
} {
  const questions = draft.assumptions.flatMap((assumption) => {
    const { resolution, clarifyingQuestion, ambiguityReason } = assumption.measurement;
    if (resolution === 'resolved' || resolution === 'not_measurable') return [];
    return [{
      statement: assumption.statement,
      question: clarifyingQuestion
        ?? `How should "${assumption.statement}" be measured — which metric definition, threshold, and reporting period?`,
      reason: ambiguityReason,
    }];
  });
  return { blocked: questions.length > 0, questions };
}

export const explorationDraftSchema = z.object({
  sectorName: z.string().trim().min(1).max(100),
  candidates: z.array(
    z.object({
      ticker: z.string().trim().min(1).max(12),
      companyName: z.string().trim().min(1).max(160),
      market: marketSchema,
      rationale: z.string().trim().min(1).max(1_000),
      // PRODUCT_STRATEGY.md Workflow B step 3: each candidate needs a "cited
      // inclusion rationale" — the source the rationale is grounded in, not
      // the rationale text itself.
      citation: z.string().trim().min(1).max(500),
    })
  // PRODUCT_STRATEGY.md Workflow B step 3: sector-theme exploration returns
  // 3-5 unranked candidates.
  ).min(3).max(5),
});

export type ExplorationDraft = z.infer<typeof explorationDraftSchema>;

export const chatResponsePayloadSchema = z.object({
  type: z.enum(['thesis_draft', 'exploration_draft', 'none']),
  thesisDraft: thesisDraftSchema.optional(),
  explorationDraft: explorationDraftSchema.optional(),
});

export type ChatResponsePayload = z.infer<typeof chatResponsePayloadSchema>;

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(4_000),
  modelId: z.enum(OLLAMA_MODEL_IDS).optional(),
});

export const confirmRequestSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const researchRunRequestSchema = z.object({
  conversationId: z.string().uuid(),
});

export const researchRetryRequestSchema = z.object({
  jobId: z.string().uuid(),
});

export type MessageDTO = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structuredPayload: ChatResponsePayload | ThesisDraft | null;
  validationOutcome: 'valid' | 'invalid' | 'not_applicable';
  createdAt: string;
};

export type EvidenceDTO = {
  id: string;
  sourceTier: 'official' | 'secondary';
  sourceName: string;
  sourceUrl: string;
  publishDate: string | null;
  retrievalTimestamp: string;
  exactQuote: string;
  impactSummary: string;
  verificationStatus: 'exact_verified' | 'ocr_matched' | 'derived' | 'secondary_issuer' | 'secondary_news';
  sourceFormat: 'html' | 'pdf' | 'image' | 'xbrl';
  sourceVariant: string | null;
  contentKind: 'text' | 'table' | 'chart' | 'screenshot' | 'structured_fact';
  extractionMethod: string;
  pageNumber: number | null;
  boundingBox: string | null;
  interpretationStatus: 'pending' | 'deterministic' | 'model';
  metadata: string | null;
  // M011. Direction, not just relevance. `deltaVsThreshold` is always
  // `observed - threshold`, so read `polarity` for the verdict and the delta
  // only for magnitude.
  polarity: EvidencePolarity;
  deltaVsThreshold: number | null;
  polarityMethod: string;
};

export const decisionOutcomeSchema = z.enum([
  'No Change',
  'Investigate Further',
  'Update Thesis',
  'Archive',
]);

export const decisionActionSchema = z.enum([
  'Buy',
  'Hold',
  'Reduce',
  'Exit',
]).nullable();

export type DecisionOutcome = z.infer<typeof decisionOutcomeSchema>;
export type DecisionAction = z.infer<typeof decisionActionSchema>;

export const decisionRecordSchema = z.object({
  outcome: decisionOutcomeSchema,
  optionalAction: decisionActionSchema,
  userReasoning: z.string().trim().min(1).max(4_000),
  timestamp: z.string(),
});

export const recordDecisionRequestSchema = decisionRecordSchema.omit({ timestamp: true });

export type DecisionDTO = {
  id: string;
  outcome: DecisionOutcome;
  optionalAction: DecisionAction;
  userReasoning: string;
  timestamp: string;
  previousAction?: DecisionAction;
};

export const thesisExportSchema = z.object({
  version: z.literal(1),
  thesis: z.object({
    ticker: z.string().trim().min(1).max(12),
    companyName: z.string().trim().min(1).max(160),
    market: marketSchema,
    coreBelief: z.string().trim().min(1).max(4_000),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    status: z.enum(['active', 'archived']),
    createdAt: z.string(),
  }),
  assumptions: z.array(
    z.object({
      statement: z.string().trim().min(1).max(1_000),
      status: assumptionStatusSchema,
      createdAt: z.string(),
      // M011. `.optional()`, matching this schema's existing posture for
      // fields added after v1 (`sourceVariant`, `documentHash`, …): every
      // export file written before M011 must still import.
      measurement: measurementContractSchema.optional(),
      evidence: z.array(
        z.object({
          sourceTier: z.enum(['official', 'secondary']),
          sourceName: z.string(),
          sourceUrl: z.string(),
          publishDate: z.string().nullable(),
          retrievalTimestamp: z.string(),
          exactQuote: z.string(),
          impactSummary: z.string(),
          verificationStatus: z.enum(['exact_verified', 'ocr_matched', 'derived', 'secondary_issuer', 'secondary_news']),
          sourceFormat: z.enum(['html', 'pdf', 'image', 'xbrl']),
          sourceVariant: z.string().nullable().optional(),
          contentKind: z.enum(['text', 'table', 'chart', 'screenshot', 'structured_fact']).default('text'),
          extractionMethod: z.string(),
          pageNumber: z.number().nullable(),
          boundingBox: z.string().nullable().optional(),
          interpretationStatus: z.enum(['pending', 'deterministic', 'model']),
          metadata: z.string().nullable(),
          documentHash: z.string().optional(),
          canonicalTextHash: z.string().nullable().optional(),
          // M011. Defaulted/optional so every export file written before M011
          // still imports — the same posture this schema already takes for
          // `sourceVariant` and `documentHash`.
          polarity: evidencePolaritySchema.default('inconclusive'),
          deltaVsThreshold: z.number().nullable().optional(),
          polarityMethod: z.string().optional(),
        })
      ),
    })
  ),
  decisions: z.array(decisionRecordSchema),
});

export type ThesisExport = z.infer<typeof thesisExportSchema>;

export const decisionRecommendationSchema = z.object({
  recommendedOutcome: decisionOutcomeSchema,
  recommendedAction: decisionActionSchema,
  rationale: z.string().trim().min(1).max(4_000),
});

export type DecisionRecommendation = z.infer<typeof decisionRecommendationSchema>;

export type ResearchItemDTO = {
  assumptionId: string;
  statement: string;
  assumptionStatus: z.infer<typeof assumptionStatusSchema>;
  job: {
    id: string;
    status: z.infer<typeof researchJobStatusSchema>;
    error: string | null;
    errorCode: string | null;
    attemptCount: number;
    sourceMode: 'mock' | 'live';
  };
  evidence: EvidenceDTO[];
};

// M011. Structural mirrors of `ThesisVerdict`/`CoverageLedger`. Declared here
// rather than imported because this module is the client/server boundary and
// must not pull in anything from `lib/research`, which is server-only.
export type ThesisVerdictDTO = {
  level: 'breached' | 'at_risk' | 'holding' | 'insufficient_evidence';
  headline: string;
  contradictions: Array<{
    assumptionId: string;
    statement: string;
    metric: string;
    operator: MeasurementOperator;
    threshold: number;
    unit: MeasurementUnit;
    observedValue: number;
    deltaVsThreshold: number;
    evidenceId: string;
    sourceName: string;
    sourceUrl: string;
  }>;
  softContradictionCount: number;
  rule: string;
};

export type CoverageLedgerDTO = {
  totalAssumptions: number;
  evidenced: number;
  supported: number;
  contradicted: number;
  inconclusiveOnly: number;
  unevidenced: number;
  unresolvedContracts: number;
  coverageRatio: number;
  confidenceGate: 'open' | 'suppressed';
  suppressionReasons: Array<'low_coverage' | 'unresolved_contracts'>;
  unevidencedAssumptions: Array<{
    assumptionId: string;
    statement: string;
    reason: 'job_pending' | 'job_failed' | 'no_candidate_passed_gate' | 'no_source_for_market';
  }>;
};

export type ResearchPanelDTO = {
  thesis: {
    id: string;
    ticker: string;
    companyName: string;
    market: z.infer<typeof marketSchema>;
    coreBelief: string;
  } | null;
  items: ResearchItemDTO[];
  decisions: DecisionDTO[];
  /*
   * M011. Both derived server-side by pure functions (`lib/research/verdict.ts`
   * and `lib/research/coverage.ts`) and passed through unchanged. Optional in
   * the same way `ingestion`/`discoverySummary` are, so an empty panel needs no
   * placeholder — but unlike those, they are present whenever a thesis is.
   *
   * The verdict is deliberately NOT model output: it is arithmetic over
   * persisted polarity, so no generated text can bury or soften it.
   */
  verdict?: ThesisVerdictDTO;
  coverage?: CoverageLedgerDTO;
  ingestion?: {
    schedule: string;
    nextScheduledAt: string;
    lastRun: {
      status: 'running' | 'succeeded' | 'degraded' | 'failed';
      trigger: 'cron' | 'manual';
      newDocumentCount: number;
      trackedCompanyCount: number;
      startedAt: string;
      completedAt: string | null;
      errorCode: string | null;
      error: string | null;
    } | null;
  };
  // M008 Slice 4. Undefined when this thesis's ticker has no discovered
  // candidates yet (no Tavily key configured, or nothing found) — omitted
  // rather than an empty array so the UI can distinguish "never ran" from
  // "ran and found nothing" the same way `ingestion` already does.
  discoverySummary?: {
    candidates: Array<{
      id: string;
      candidateUrl: string;
      status: 'pending' | 'fetched' | 'unreachable' | 'rejected';
      rejectionReason: string | null;
      updatedAt: string;
    }>;
  };
};
