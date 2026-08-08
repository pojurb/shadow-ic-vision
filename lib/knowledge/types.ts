import { z } from 'zod';

export const knowledgeDocumentStatusSchema = z.enum([
  'discovered',
  'duplicate',
  'extractable',
  'needs_ocr',
  'unsupported',
  'extracted',
  'awaiting_provider',
  'digested',
  'graph_ready',
  'failed',
]);
export type KnowledgeDocumentStatus = z.infer<typeof knowledgeDocumentStatusSchema>;

export const knowledgeClassificationSchema = z.enum([
  'framework',
  'historical',
  'time_sensitive',
  'opinion',
  'uncertain',
]);
export type KnowledgeClassification = z.infer<typeof knowledgeClassificationSchema>;

export const knowledgeNodeTypeSchema = z.enum([
  'SourceDocument',
  'Section',
  'Claim',
  'Concept',
  'Indicator',
  'Mechanism',
  'Framework',
  'Limitation',
]);
export type KnowledgeNodeType = z.infer<typeof knowledgeNodeTypeSchema>;

export const knowledgeEdgeTypeSchema = z.enum([
  'CONTAINS',
  'ASSERTS',
  'DEFINES',
  'CAUSES',
  'REQUIRES',
  'MEASURED_BY',
  'QUALIFIES',
  'CONTRADICTS',
  'DERIVED_FROM',
]);
export type KnowledgeEdgeType = z.infer<typeof knowledgeEdgeTypeSchema>;

export const knowledgeManifestRecordSchema = z.object({
  relativePath: z.string().min(1),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  status: knowledgeDocumentStatusSchema,
  duplicateOfHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  errorCode: z.string().nullable(),
});
export type KnowledgeManifestRecord = z.infer<typeof knowledgeManifestRecordSchema>;

const quoteHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const knowledgeCardClaimSchema = z.object({
  claim: z.string().min(1),
  classification: knowledgeClassificationSchema,
  locator: z.string().min(1),
  quote: z.string().min(1).max(1000).optional(),
  quoteHash: quoteHashSchema.optional(),
}).superRefine((value, context) => {
  if (!value.quote && !value.quoteHash) {
    context.addIssue({ code: 'custom', message: 'Each material claim needs a quote or quoteHash.', path: ['quoteHash'] });
  }
});
export type KnowledgeCardClaim = z.infer<typeof knowledgeCardClaimSchema>;

export const knowledgeSourceCardSchema = z.object({
  schemaVersion: z.literal(1),
  sourceDocumentHash: quoteHashSchema,
  sourceRelativePath: z.string().min(1),
  documentTitle: z.string().min(1),
  documentDate: z.string().min(1),
  documentType: z.string().min(1),
  purpose: z.string().min(1),
  concepts: z.array(z.string().min(1)),
  claims: z.array(knowledgeCardClaimSchema),
  causalMechanisms: z.array(z.string().min(1)),
  definitionsFormulas: z.array(z.string().min(1)),
  relevantObservableIndicators: z.array(z.string().min(1)),
  limitationsExceptions: z.array(z.string().min(1)),
  classification: z.array(knowledgeClassificationSchema),
});
export type KnowledgeSourceCard = z.infer<typeof knowledgeSourceCardSchema>;

export const knowledgeProviderMetadataSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
});
export type KnowledgeProviderMetadata = z.infer<typeof knowledgeProviderMetadataSchema>;

export const knowledgeBatchArtifactSchema = z.object({
  schemaVersion: z.literal(1),
  sourceDocumentHash: quoteHashSchema,
  sourceRelativePath: z.string().min(1),
  status: z.enum(['digested', 'failed']),
  sourceCard: knowledgeSourceCardSchema.nullable(),
  provider: knowledgeProviderMetadataSchema.nullable(),
  processingTimeMs: z.number().int().nonnegative().nullable(),
  errorCode: z.string().nullable(),
  error: z.string().nullable(),
});
export type KnowledgeBatchArtifact = z.infer<typeof knowledgeBatchArtifactSchema>;

export const knowledgeExtractionArtifactSchema = z.object({
  schemaVersion: z.literal(1),
  sourceDocumentHash: quoteHashSchema,
  sourceRelativePath: z.string().min(1),
  mimeType: z.string().min(1),
  canonicalText: z.string(),
  pages: z.array(z.object({
    pageNumber: z.number().int().nullable(),
    text: z.string(),
    blocks: z.array(z.string()).optional(),
  })),
  parserVersion: z.string().min(1),
  extractionMethod: z.enum(['html_parser', 'pdf_text', 'text_file', 'docx_parser', 'xlsx_parser', 'ocr']),
  sourceVariant: z.enum(['text_layer', 'scanned']),
  untrustedInstructionFlagged: z.boolean(),
});
export type KnowledgeExtractionArtifact = z.infer<typeof knowledgeExtractionArtifactSchema>;
