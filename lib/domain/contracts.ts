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
};

export type ResearchItemDTO = {
  assumptionId: string;
  statement: string;
  assumptionStatus: z.infer<typeof assumptionStatusSchema>;
  job: {
    id: string;
    status: z.infer<typeof researchJobStatusSchema>;
    error: string | null;
    attemptCount: number;
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
};
