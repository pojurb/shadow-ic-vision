import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
    enum: ['untested', 'verified', 'challenged', 'held-belief'],
  }).notNull().default('untested'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
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
  verificationStatus: text('verification_status').notNull(), // exact_verified, ocr_matched, derived
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
  decision: text('decision').notNull(), // e.g. "Buy", "Hold", "Reject"
  rationale: text('rationale').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

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
