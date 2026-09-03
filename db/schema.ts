import { index, integer, primaryKey, sqliteTable, text, uniqueIndex, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Conversations (multi-turn interactions)
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Messages in a conversation
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  providerMetadata: text('provider_metadata'),
  structuredPayload: text('structured_payload'),
  validationOutcome: text('validation_outcome', {
    enum: ['valid', 'invalid', 'not_applicable'],
  }).notNull().default('not_applicable'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Theses
export const theses = sqliteTable('theses', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  draftMessageId: text('draft_message_id').references(() => messages.id, { onDelete: 'set null' }),
  ticker: text('ticker'),
  companyName: text('company_name'),
  market: text('market', { enum: ['US', 'ID'] }),
  coreBelief: text('core_belief'),
  // Retained for compatibility with the committed initial migration.
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('theses_conversation_id_unique').on(table.conversationId),
  uniqueIndex('theses_draft_message_id_unique').on(table.draftMessageId),
]);

// Assumptions inside a Thesis
export const assumptions = sqliteTable('assumptions', {
  id: text('id').primaryKey(),
  thesisId: text('thesis_id').notNull().references(() => theses.id, { onDelete: 'cascade' }),
  statement: text('statement').notNull(),
  status: text('status', {
    // M007: 'pending_confirmation' (secondary-only evidence, no official
    // confirmation yet) and 'user_confirmed_secondary' (explicitly accepted
    // by the user, deliberately distinct from 'verified' — see
    // docs/milestones/M007-secondary-source-ingestion.md Workflow 3).
    enum: ['untested', 'verified', 'challenged', 'held-belief', 'pending_confirmation', 'user_confirmed_secondary'],
  }).notNull().default('untested'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * M011 — the measurement contract for one assumption (1:1, `assumption_id` is
 * the primary key, so the cardinality is enforced by the schema rather than a
 * separate unique index).
 *
 * A separate table rather than columns on `assumptions` for two reasons. First,
 * row presence *is* the state machine: no row means never extracted,
 * `resolution='ambiguous'` means confirmation is blocked, `'resolved'` means
 * usable, `'legacy_unspecified'` means it predates M011 — whereas eight
 * nullable columns would represent "unresolved" in 2^8 indistinguishable ways.
 * Second, `assumptions.status` carries a documented never-auto-mark invariant
 * (`lib/research/assumption-status.ts`); leaving that table untouched keeps the
 * invariant easy to read.
 *
 * A single JSON column was also rejected: unparseable JSON would degrade
 * silently to "no contract", which degrades to "no breach detected" — the exact
 * failure class M011 exists to fix, failing in the direction of reassurance.
 */
export const assumptionMeasurements = sqliteTable('assumption_measurements', {
  assumptionId: text('assumption_id').primaryKey().references(() => assumptions.id, { onDelete: 'cascade' }),
  resolution: text('resolution', {
    enum: ['resolved', 'ambiguous', 'not_measurable', 'legacy_unspecified'],
  }).notNull().default('legacy_unspecified'),
  metric: text('metric').notNull().default(''),
  definitionVariant: text('definition_variant').notNull().default(''),
  operator: text('operator', {
    enum: ['gte', 'gt', 'lte', 'lt', 'eq', 'increases', 'decreases', 'none'],
  }).notNull().default('none'),
  threshold: real('threshold'),
  unit: text('unit', {
    enum: ['percent', 'ratio', 'usd', 'idr', 'count', 'unspecified'],
  }).notNull().default('unspecified'),
  timeBasis: text('time_basis', {
    enum: ['instant', 'duration_quarter', 'duration_ytd', 'duration_annual', 'duration_ttm', 'unspecified'],
  }).notNull().default('unspecified'),
  // JSON `string[]`. The one JSON field here, and only because this list is
  // always read whole and never filtered on in SQL.
  sourceTags: text('source_tags').notNull().default('[]'),
  clarifyingQuestion: text('clarifying_question'),
  ambiguityReason: text('ambiguity_reason', {
    enum: ['none', 'metric_undefined', 'definition_variant_ambiguous', 'threshold_missing', 'time_basis_ambiguous', 'unit_ambiguous'],
  }).notNull().default('none'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * M013 Q6 — per-assumption source-adequacy classification, 1:1 with
 * `assumptions` for the same reason `assumptionMeasurements` is: row
 * presence is meaningful state, not a nullable-column combination.
 *
 * A deliberately separate concept from `assumptionMeasurements.resolution`
 * (is the contract well-formed?) and from `coverage.ts`'s computed
 * `no_source_for_market` (does this market have a structured-fact adapter? —
 * a system-capability fact, always false for the ID market by construction,
 * independent of any specific assumption). This table answers a third,
 * different question the M013 packet exists to record: for THIS assumption's
 * CURRENT contract, has any public source been identified after actually
 * looking? That is a human judgment (`AGENTS.md` rule 2/4 — the assistant
 * assembles evidence, the user classifies), never derived automatically.
 *
 * `contractFingerprint` is what keeps a `classification: 'C'` row from going
 * silently stale: it snapshots the exact contract fields the judgment was
 * made against, so editing the contract (a new threshold, a redefined
 * `definitionVariant`) invalidates the row without deleting it — the
 * assumption becomes eligible for research again, and the prior finding
 * stays in the row as history rather than being overwritten.
 */
export const sourceAdequacyAssessments = sqliteTable('source_adequacy_assessments', {
  assumptionId: text('assumption_id').primaryKey().references(() => assumptions.id, { onDelete: 'cascade' }),
  classification: text('classification', { enum: ['A', 'B', 'C'] }).notNull(),
  reasoning: text('reasoning').notNull(),
  contractFingerprint: text('contract_fingerprint').notNull(),
  assessedBy: text('assessed_by').notNull().default('user'),
  assessedAt: text('assessed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Multimodal Evidence linked to an Assumption
export const evidence = sqliteTable('evidence', {
  id: text('id').primaryKey(),
  assumptionId: text('assumption_id').notNull().references(() => assumptions.id, { onDelete: 'cascade' }),
  
  // ADR-0008 Multimodal Evidence extensions
  sourceFormat: text('source_format').notNull(), // html, pdf, image, xbrl
  contentKind: text('content_kind').notNull(), // text, table, chart, screenshot, structured_fact
  sourceVariant: text('source_variant'), // text_layer, scanned, encrypted, corrupt, unsupported
  extractionMethod: text('extraction_method').notNull(), // html_parser, pdf_text, ocr, vision, table_parser, xbrl_parser, deterministic_calculation
  verificationStatus: text('verification_status').notNull(), // exact_verified, ocr_matched, derived, secondary_issuer, secondary_news
  sourceTier: text('source_tier', { enum: ['official', 'secondary'] }).notNull().default('official'),
  sourceName: text('source_name').notNull().default('Unknown source'),
  publishDate: text('publish_date'),
  
  documentHash: text('document_hash').notNull(), // SHA-256 of raw bytes
  canonicalTextHash: text('canonical_text_hash'), // SHA-256 for exact_verified
  pageNumber: integer('page_number'), // 1-based index
  boundingBox: text('bounding_box'), // JSON string: [x_min, y_min, x_max, y_max]
  
  sourceUrl: text('source_url').notNull(),
  retrievalTimestamp: text('retrieval_timestamp').notNull(),
  
  content: text('content').notNull(), // The extracted text or derived string
  impactSummary: text('impact_summary').notNull().default(''),
  interpretationStatus: text('interpretation_status', {
    enum: ['pending', 'deterministic', 'model'],
  }).notNull().default('pending'),
  
  metadata: text('metadata'), // JSON string for parser/ocr/vision model versions

  /*
   * M011 — evidence polarity.
   *
   * Real columns rather than fields inside `metadata`, unlike R-018's
   * `untrustedInstructionFlagged` flag. That flag failing to parse costs a
   * warning banner — bad, but visible. Polarity failing to parse costs "no
   * contradiction found", which is the exact defect M011 exists to fix and
   * which fails silently in the direction of reassurance. The verdict and
   * coverage ledger also need `WHERE polarity = 'contradicts'`, which a JSON
   * blob cannot serve.
   *
   * Defaults are semantically correct rather than placeholder: an evidence row
   * with no contract to judge against genuinely is inconclusive for the reason
   * `no_contract`, so every pre-M011 row is already accurate with no backfill.
   */
  polarity: text('polarity', {
    enum: ['supports', 'contradicts', 'inconclusive'],
  }).notNull().default('inconclusive'),
  // Always `observed - threshold`; null whenever no comparison was made.
  deltaVsThreshold: real('delta_vs_threshold'),
  polarityMethod: text('polarity_method').notNull().default('no_contract'),

  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const researchJobs = sqliteTable('research_jobs', {
  id: text('id').primaryKey(),
  assumptionId: text('assumption_id').notNull().references(() => assumptions.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['queued', 'running', 'succeeded', 'degraded', 'failed'],
  }).notNull().default('queued'),
  error: text('error'),
  errorCode: text('error_code'),
  sourceMode: text('source_mode', { enum: ['mock', 'live'] }).notNull().default('mock'),
  attemptCount: integer('attempt_count').notNull().default(0),
  leaseExpiresAt: text('lease_expires_at'),
  // Draft plan `docs/drafts/cli-terminal-dashboard-draft-plan.md` §4.2: the
  // reclaim sweep resets any job past its lease back to `queued` regardless
  // of whether the original worker is still alive, and every final-state
  // update filtered only on `id`, so a worker that outlives its own lease can
  // clobber whatever a later claimant already wrote. `leaseOwner` makes every
  // final-state write conditional on still holding the lease it started
  // with, so a stale worker's write becomes a no-op instead of a clobber.
  leaseOwner: text('lease_owner'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('research_jobs_assumption_id_unique').on(table.assumptionId)]);

export const sourceSnapshots = sqliteTable('source_snapshots', {
  documentHash: text('document_hash').primaryKey(),
  documentId: text('document_id').notNull(),
  market: text('market', { enum: ['US', 'ID'] }).notNull(),
  ticker: text('ticker').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceName: text('source_name').notNull(),
  sourceTier: text('source_tier', { enum: ['official', 'secondary'] }).notNull(),
  sourceFormat: text('source_format', { enum: ['html', 'pdf', 'image', 'xbrl'] }).notNull(),
  contentType: text('content_type').notNull(),
  httpStatus: integer('http_status').notNull(),
  publishDate: text('publish_date'),
  retrievalTimestamp: text('retrieval_timestamp').notNull(),
  storagePath: text('storage_path').notNull(),
  sourceMode: text('source_mode', { enum: ['mock', 'live'] }).notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const researchJobSources = sqliteTable('research_job_sources', {
  jobId: text('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  documentHash: text('document_hash').notNull().references(() => sourceSnapshots.documentHash, { onDelete: 'restrict' }),
  outcome: text('outcome', { enum: ['verified', 'rejected'] }).notNull(),
  errorCode: text('error_code'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.jobId, table.documentHash] })]);

// Decisions linked to a Thesis
export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(),
  thesisId: text('thesis_id').notNull().references(() => theses.id, { onDelete: 'cascade' }),
  outcome: text('outcome', {
    enum: ['No Change', 'Investigate Further', 'Update Thesis', 'Archive'],
  }).notNull(),
  action: text('action', { enum: ['Buy', 'Hold', 'Reduce', 'Exit'] }),
  rationale: text('rationale').notNull(),
  // VISION.md §7: "every record retains the user's reasoning, relevant
  // evidence, known alternatives, and timestamp." Both stored as JSON-encoded
  // arrays, mirroring the `sourceTags` convention elsewhere in this schema.
  // `evidenceIds` references `evidence.id` rows informally (not a foreign
  // key) because it is a point-in-time snapshot of what was relevant when the
  // decision was made — it must survive that evidence later being superseded
  // or deleted, not cascade with it.
  evidenceIds: text('evidence_ids').notNull().default('[]'),
  alternatives: text('alternatives').notNull().default('[]'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('decisions_thesis_created_idx').on(table.thesisId, table.createdAt),
]);

export const sourceCursors = sqliteTable('source_cursors', {
  market: text('market', { enum: ['US', 'ID'] }).notNull(),
  ticker: text('ticker').notNull(),
  lastPublishDate: text('last_publish_date'),
  lastDocumentId: text('last_document_id'),
  checkedAt: text('checked_at').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.market, table.ticker] })]);

export const ingestionRuns = sqliteTable('ingestion_runs', {
  id: text('id').primaryKey(),
  trigger: text('trigger', { enum: ['cron', 'manual'] }).notNull(),
  status: text('status', { enum: ['running', 'succeeded', 'degraded', 'failed'] }).notNull(),
  trackedCompanyCount: integer('tracked_company_count').notNull().default(0),
  newDocumentCount: integer('new_document_count').notNull().default(0),
  errorCode: text('error_code'),
  error: text('error'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

export const ingestionLeases = sqliteTable('ingestion_leases', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  expiresAt: text('expires_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sourceDiscoveries = sqliteTable('source_discoveries', {
  documentHash: text('document_hash').notNull().references(() => sourceSnapshots.documentHash, { onDelete: 'cascade' }),
  discoveredFromUrl: text('discovered_from_url').notNull(),
  discoveryMethod: text('discovery_method', { enum: ['exchange_api', 'issuer_crawl'] }).notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.documentHash, table.discoveredFromUrl] })]);

// M007: pre-fetch candidate URLs for the (deferred) Class C web-search
// discovery path. Deliberately NOT the same table as sourceDiscoveries
// above, which requires an already-fetched, hashed document — this table
// exists for candidates that may never resolve to one. No snippet/title
// column exists here by design: search text is never persisted (R-013).
export const discoveryCandidates = sqliteTable('discovery_candidates', {
  id: text('id').primaryKey(),
  market: text('market', { enum: ['US', 'ID'] }).notNull(),
  ticker: text('ticker').notNull(),
  candidateUrl: text('candidate_url').notNull(),
  discoveredVia: text('discovered_via', { enum: ['web_search'] }).notNull().default('web_search'),
  searchQuery: text('search_query').notNull(),
  status: text('status', { enum: ['pending', 'fetched', 'unreachable', 'rejected'] }).notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  resultingDocumentHash: text('resulting_document_hash').references(() => sourceSnapshots.documentHash, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('discovery_candidates_market_ticker_url_unique').on(table.market, table.ticker, table.candidateUrl),
]);

// Portfolio Positions (Holdings)
// PRODUCT_STRATEGY.md §3: "Each company may be tagged Owned or Watchlist.
// V1 does not collect quantity, cost basis, position value, target
// allocation, or brokerage-account data" — so this table tracks the tag, not
// a brokerage position.
export const portfolioPositions = sqliteTable('portfolio_positions', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull(),
  market: text('market', { enum: ['US', 'ID'] }).notNull(),
  status: text('status', { enum: ['owned', 'watchlist'] }).notNull().default('watchlist'),
  thesisId: text('thesis_id').references(() => theses.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Portfolio Ingestion/New Filing Alerts
export const portfolioAlerts = sqliteTable('portfolio_alerts', {
  id: text('id').primaryKey(),
  positionId: text('position_id').notNull().references(() => portfolioPositions.id, { onDelete: 'cascade' }),
  documentHash: text('document_hash').notNull().references(() => sourceSnapshots.documentHash, { onDelete: 'cascade' }),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// M012: private educational knowledge corpus. These tables are deliberately
// separate from source_snapshots/evidence: course material is a framework
// corpus, never current market evidence.
export const knowledgeDocuments = sqliteTable('knowledge_documents', {
  documentHash: text('document_hash').primaryKey(),
  relativePath: text('relative_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: text('status', {
    enum: [
      'discovered', 'duplicate', 'extractable', 'needs_ocr', 'unsupported',
      'extracted', 'awaiting_provider', 'digested', 'graph_ready', 'failed',
    ],
  }).notNull(),
  // The hash is validated by the intake service. It is intentionally not a
  // self-reference in the Drizzle initializer, which would create a circular
  // TypeScript inference path for this table definition.
  duplicateOfHash: text('duplicate_of_hash'),
  extractionPath: text('extraction_path'),
  batchPath: text('batch_path'),
  lastError: text('last_error'),
  errorCode: text('error_code'),
  retryCount: integer('retry_count').notNull().default(0),
  provider: text('provider'),
  modelId: text('model_id'),
  promptVersion: text('prompt_version'),
  processedAt: text('processed_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('knowledge_documents_relative_path_idx').on(table.relativePath),
  index('knowledge_documents_status_idx').on(table.status),
]);

export const knowledgeProcessingRuns = sqliteTable('knowledge_processing_runs', {
  id: text('id').primaryKey(),
  stage: text('stage', { enum: ['scan', 'extract', 'batch', 'graph', 'report'] }).notNull(),
  documentHash: text('document_hash').references(() => knowledgeDocuments.documentHash, { onDelete: 'cascade' }),
  status: text('status', { enum: ['running', 'succeeded', 'failed', 'skipped'] }).notNull(),
  provider: text('provider'),
  modelId: text('model_id'),
  promptVersion: text('prompt_version'),
  retryCount: integer('retry_count').notNull().default(0),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  durationMs: integer('duration_ms'),
  errorCode: text('error_code'),
  error: text('error'),
});

export const knowledgeClaims = sqliteTable('knowledge_claims', {
  id: text('id').primaryKey(),
  documentHash: text('document_hash').notNull().references(() => knowledgeDocuments.documentHash, { onDelete: 'restrict' }),
  claimText: text('claim_text').notNull(),
  classification: text('classification', {
    enum: ['framework', 'historical', 'time_sensitive', 'opinion', 'uncertain'],
  }).notNull(),
  locator: text('locator').notNull(),
  quoteHash: text('quote_hash').notNull(),
  status: text('status', { enum: ['candidate', 'approved', 'rejected'] }).notNull().default('candidate'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('knowledge_claims_document_hash_idx').on(table.documentHash),
]);

export const knowledgeGraphNodes = sqliteTable('knowledge_graph_nodes', {
  id: text('id').primaryKey(),
  documentHash: text('document_hash').notNull().references(() => knowledgeDocuments.documentHash, { onDelete: 'restrict' }),
  sourceClaimId: text('source_claim_id').references(() => knowledgeClaims.id, { onDelete: 'restrict' }),
  nodeType: text('node_type', {
    enum: ['SourceDocument', 'Section', 'Claim', 'Concept', 'Indicator', 'Mechanism', 'Framework', 'Limitation'],
  }).notNull(),
  label: text('label').notNull(),
  description: text('description'),
  status: text('status', { enum: ['candidate', 'approved', 'rejected'] }).notNull().default('candidate'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('knowledge_graph_nodes_document_hash_idx').on(table.documentHash),
  index('knowledge_graph_nodes_source_claim_idx').on(table.sourceClaimId),
]);

export const knowledgeGraphEdges = sqliteTable('knowledge_graph_edges', {
  id: text('id').primaryKey(),
  documentHash: text('document_hash').notNull().references(() => knowledgeDocuments.documentHash, { onDelete: 'restrict' }),
  sourceNodeId: text('source_node_id').notNull().references(() => knowledgeGraphNodes.id, { onDelete: 'restrict' }),
  targetNodeId: text('target_node_id').notNull().references(() => knowledgeGraphNodes.id, { onDelete: 'restrict' }),
  edgeType: text('edge_type', {
    enum: ['CONTAINS', 'ASSERTS', 'DEFINES', 'CAUSES', 'REQUIRES', 'MEASURED_BY', 'QUALIFIES', 'CONTRADICTS', 'DERIVED_FROM'],
  }).notNull(),
  sourceClaimIds: text('source_claim_ids').notNull().default('[]'),
  status: text('status', { enum: ['candidate', 'approved', 'rejected'] }).notNull().default('candidate'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('knowledge_graph_edges_document_hash_idx').on(table.documentHash),
  index('knowledge_graph_edges_source_node_idx').on(table.sourceNodeId),
  index('knowledge_graph_edges_target_node_idx').on(table.targetNodeId),
]);



