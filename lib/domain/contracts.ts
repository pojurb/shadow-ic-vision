import { z } from 'zod';

export const marketSchema = z.enum(['US', 'ID']);
export const assumptionStatusSchema = z.enum([
  'untested',
  'verified',
  'challenged',
  'held-belief',
]);
export const researchJobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'degraded',
  'failed',
]);

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
      }),
    )
    .min(1)
    .max(12),
  requiresChallenge: z.boolean().default(false),
});

export type ThesisDraft = z.infer<typeof thesisDraftSchema>;

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(4_000),
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
  structuredPayload: ThesisDraft | null;
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
  verificationStatus: 'exact_verified' | 'ocr_matched' | 'derived';
  sourceFormat: 'html' | 'pdf' | 'image' | 'xbrl';
  sourceVariant: string | null;
  contentKind: 'text' | 'table' | 'chart' | 'screenshot' | 'structured_fact';
  extractionMethod: string;
  pageNumber: number | null;
  boundingBox: string | null;
  interpretationStatus: 'pending' | 'deterministic' | 'model';
  metadata: string | null;
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

export const recordDecisionRequestSchema = z.object({
  outcome: decisionOutcomeSchema,
  optionalAction: decisionActionSchema,
  userReasoning: z.string().trim().min(1).max(4_000),
});

export type DecisionDTO = {
  id: string;
  outcome: DecisionOutcome;
  optionalAction: DecisionAction;
  userReasoning: string;
  timestamp: string;
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
      evidence: z.array(
        z.object({
          sourceTier: z.enum(['official', 'secondary']),
          sourceName: z.string(),
          sourceUrl: z.string(),
          publishDate: z.string().nullable(),
          retrievalTimestamp: z.string(),
          exactQuote: z.string(),
          impactSummary: z.string(),
          verificationStatus: z.enum(['exact_verified', 'ocr_matched', 'derived']),
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
        })
      ),
    })
  ),
  decisions: z.array(
    z.object({
      outcome: decisionOutcomeSchema,
      optionalAction: decisionActionSchema,
      userReasoning: z.string().trim().min(1).max(4_000),
      timestamp: z.string(),
    })
  ),
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
};
