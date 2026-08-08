import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { knowledgeDocuments, knowledgeProcessingRuns } from '@/db/schema';
import { knowledgeBatchArtifactSchema, knowledgeProviderMetadataSchema, knowledgeSourceCardSchema, type KnowledgeBatchArtifact, type KnowledgeProviderMetadata, type KnowledgeSourceCard } from './types';
import { readKnowledgeExtractionArtifact } from './extraction';
import { syncManifestStatuses } from './intake';

export type KnowledgeDigestInput = {
  sourceDocumentHash: string;
  sourceRelativePath: string;
  mimeType: string;
  extraction: ReturnType<typeof readKnowledgeExtractionArtifact>;
};

export interface KnowledgeDigestProvider {
  getMetadata(): KnowledgeProviderMetadata;
  digest(input: KnowledgeDigestInput): Promise<unknown>;
}

export class KnowledgeProviderError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'KnowledgeProviderError';
  }
}

/** A local fixture adapter. It reads one strict JSON response per hash. */
export class FileBackedKnowledgeProvider implements KnowledgeDigestProvider {
  private readonly metadata: KnowledgeProviderMetadata;

  constructor(private readonly inputDirectory: string, metadata: KnowledgeProviderMetadata = {
    provider: 'file-backed',
    modelId: 'fixture-file-v1',
    promptVersion: 'knowledge-source-card-v1',
  }) {
    this.metadata = knowledgeProviderMetadataSchema.parse(metadata);
  }

  getMetadata() {
    return this.metadata;
  }

  async digest(input: KnowledgeDigestInput): Promise<unknown> {
    const filePath = path.join(this.inputDirectory, `${input.sourceDocumentHash}.json`);
    if (!fs.existsSync(filePath)) {
      throw new KnowledgeProviderError('provider_input_missing', 'No file-backed provider response exists for this source hash.');
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    } catch {
      throw new KnowledgeProviderError('malformed_provider_json', 'File-backed provider response is not valid JSON.');
    }
  }
}

export type KnowledgeBatchResult = {
  attempted: number;
  digested: number;
  awaitingProvider: number;
  skipped: number;
  failed: number;
};

export async function processKnowledgeBatch(input: {
  db: AppDatabase;
  knowledgeRoot: string;
  provider?: KnowledgeDigestProvider;
  force?: boolean;
}): Promise<KnowledgeBatchResult> {
  const documents = input.db.select().from(knowledgeDocuments).all();
  const result: KnowledgeBatchResult = { attempted: 0, digested: 0, awaitingProvider: 0, skipped: 0, failed: 0 };

  for (const document of documents) {
    if (!input.force && (document.status === 'digested' || document.status === 'graph_ready')) {
      result.skipped += 1;
      continue;
    }
    if (document.status !== 'extracted' && document.status !== 'awaiting_provider') {
      result.skipped += 1;
      continue;
    }

    if (!input.provider) {
      const completedAt = new Date().toISOString();
      input.db.update(knowledgeDocuments).set({
        status: 'awaiting_provider',
        errorCode: 'provider_not_configured',
        lastError: 'No knowledge digest provider is configured.',
        updatedAt: completedAt,
      }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();
      input.db.insert(knowledgeProcessingRuns).values({
        id: randomUUID(),
        stage: 'batch',
        documentHash: document.documentHash,
        status: 'skipped',
        startedAt: completedAt,
        completedAt,
        errorCode: 'provider_not_configured',
        error: 'No knowledge digest provider is configured.',
      }).run();
      result.awaitingProvider += 1;
      continue;
    }

    result.attempted += 1;
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const metadata = knowledgeProviderMetadataSchema.parse(input.provider.getMetadata());
    const batchPath = path.join(input.knowledgeRoot, 'batches', `${document.documentHash}.json`);
    try {
      if (!document.extractionPath) throw new KnowledgeProviderError('extraction_artifact_missing', 'No local extraction artifact exists.');
      const extraction = readKnowledgeExtractionArtifact(path.join(input.knowledgeRoot, document.extractionPath));
      const raw = await input.provider.digest({
        sourceDocumentHash: document.documentHash,
        sourceRelativePath: document.relativePath,
        mimeType: document.mimeType,
        extraction,
      });
      const sourceCard = validateKnowledgeSourceCard(raw, {
        sourceDocumentHash: document.documentHash,
        sourceRelativePath: document.relativePath,
        canonicalText: extraction.canonicalText,
      });
      const completedAt = new Date().toISOString();
      const artifact: KnowledgeBatchArtifact = knowledgeBatchArtifactSchema.parse({
        schemaVersion: 1,
        sourceDocumentHash: document.documentHash,
        sourceRelativePath: document.relativePath,
        status: 'digested',
        sourceCard,
        provider: metadata,
        processingTimeMs: Math.max(0, Date.now() - started),
        errorCode: null,
        error: null,
      });
      writeJsonAtomically(batchPath, artifact);
      input.db.update(knowledgeDocuments).set({
        status: 'digested',
        batchPath: path.relative(input.knowledgeRoot, batchPath).split(path.sep).join('/'),
        provider: metadata.provider,
        modelId: metadata.modelId,
        promptVersion: metadata.promptVersion,
        processedAt: completedAt,
        lastError: null,
        errorCode: null,
        updatedAt: completedAt,
      }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();
      input.db.insert(knowledgeProcessingRuns).values({
        id: randomUUID(),
        stage: 'batch',
        documentHash: document.documentHash,
        status: 'succeeded',
        provider: metadata.provider,
        modelId: metadata.modelId,
        promptVersion: metadata.promptVersion,
        startedAt,
        completedAt,
        durationMs: Math.max(0, Date.now() - started),
      }).run();
      result.digested += 1;
    } catch (error) {
      const failure = normalizeBatchError(error);
      const completedAt = new Date().toISOString();
      const artifact: KnowledgeBatchArtifact = {
        schemaVersion: 1,
        sourceDocumentHash: document.documentHash,
        sourceRelativePath: document.relativePath,
        status: 'failed',
        sourceCard: null,
        provider: metadata,
        processingTimeMs: Math.max(0, Date.now() - started),
        errorCode: failure.code,
        error: failure.message,
      };
      writeJsonAtomically(batchPath, artifact);
      input.db.update(knowledgeDocuments).set({
        status: 'failed',
        batchPath: path.relative(input.knowledgeRoot, batchPath).split(path.sep).join('/'),
        provider: metadata.provider,
        modelId: metadata.modelId,
        promptVersion: metadata.promptVersion,
        retryCount: document.retryCount + 1,
        lastError: failure.message,
        errorCode: failure.code,
        updatedAt: completedAt,
      }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();
      input.db.insert(knowledgeProcessingRuns).values({
        id: randomUUID(),
        stage: 'batch',
        documentHash: document.documentHash,
        status: 'failed',
        provider: metadata.provider,
        modelId: metadata.modelId,
        promptVersion: metadata.promptVersion,
        startedAt,
        completedAt,
        durationMs: Math.max(0, Date.now() - started),
        errorCode: failure.code,
        error: failure.message,
      }).run();
      result.failed += 1;
    }
  }

  syncManifestStatuses({ db: input.db, manifestPath: path.join(input.knowledgeRoot, 'manifest.jsonl') });
  return result;
}

export function validateKnowledgeSourceCard(raw: unknown, expected: {
  sourceDocumentHash: string;
  sourceRelativePath: string;
  canonicalText?: string;
}): KnowledgeSourceCard {
  const parsed = knowledgeSourceCardSchema.safeParse(raw);
  if (!parsed.success) throw new KnowledgeProviderError('malformed_provider_json', 'Provider output failed source-card schema validation.');
  if (parsed.data.sourceDocumentHash !== expected.sourceDocumentHash) {
    throw new KnowledgeProviderError('source_hash_mismatch', 'Provider output source hash does not match the local document.');
  }
  if (parsed.data.sourceRelativePath !== expected.sourceRelativePath) {
    throw new KnowledgeProviderError('source_path_mismatch', 'Provider output source path does not match the local document.');
  }

  const claims = parsed.data.claims.map((claim) => {
    const computedQuoteHash = claim.quote ? crypto.createHash('sha256').update(claim.quote).digest('hex') : claim.quoteHash;
    if (!computedQuoteHash) throw new KnowledgeProviderError('uncited_claim', 'Provider output claim has no quote hash.');
    if (claim.quote && claim.quoteHash && claim.quoteHash !== computedQuoteHash) {
      throw new KnowledgeProviderError('quote_hash_mismatch', 'Provider output quote hash does not match its quote.');
    }
    if (claim.quote && expected.canonicalText !== undefined && !expected.canonicalText.includes(claim.quote)) {
      throw new KnowledgeProviderError('quote_not_found', 'Provider output quote is not present in local extracted text.');
    }
    return { ...claim, quoteHash: computedQuoteHash };
  });
  return { ...parsed.data, claims };
}

function normalizeBatchError(error: unknown): { code: string; message: string } {
  if (error instanceof KnowledgeProviderError) return { code: error.code, message: error.message };
  return { code: 'batch_failed', message: error instanceof Error ? error.message : 'Knowledge batch digest failed.' };
}

function writeJsonAtomically(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}
