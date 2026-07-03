import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
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
  providerMetadata: text('provider_metadata'), // JSON string of provider, model, prompt version
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Theses
export const theses = sqliteTable('theses', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('draft'), // draft, active, closed
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Assumptions inside a Thesis
export const assumptions = sqliteTable('assumptions', {
  id: text('id').primaryKey(),
  thesisId: text('thesis_id').notNull().references(() => theses.id, { onDelete: 'cascade' }),
  statement: text('statement').notNull(),
  status: text('status').notNull().default('pending'), // pending, verified, challenged
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
  
  documentHash: text('document_hash').notNull(), // SHA-256 of raw bytes
  canonicalTextHash: text('canonical_text_hash'), // SHA-256 for exact_verified
  pageNumber: integer('page_number'), // 1-based index
  boundingBox: text('bounding_box'), // JSON string: [x_min, y_min, x_max, y_max]
  
  sourceUrl: text('source_url').notNull(),
  retrievalTimestamp: text('retrieval_timestamp').notNull(),
  
  content: text('content').notNull(), // The extracted text or derived string
  
  metadata: text('metadata'), // JSON string for parser/ocr/vision model versions
  
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Decisions linked to a Thesis
export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(),
  thesisId: text('thesis_id').notNull().references(() => theses.id, { onDelete: 'cascade' }),
  decision: text('decision').notNull(), // e.g. "Buy", "Hold", "Reject"
  rationale: text('rationale').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
