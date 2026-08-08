import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { knowledgeDocuments, knowledgeProcessingRuns } from '@/db/schema';
import { extractHtml, extractPdf, type ExtractedDocument } from '@/lib/research/extractors/document';
import { ResearchSourceError } from '@/lib/research/errors';
import { normalizeText } from '@/lib/research/verifier';
import { detectEmbeddedInstructions } from '@/lib/research/extractors/safety';
import { resolveSourcePath, artifactRelativePath } from './paths';
import { syncManifestStatuses } from './intake';
import { knowledgeExtractionArtifactSchema, type KnowledgeExtractionArtifact } from './types';

export type KnowledgeExtractionResult = {
  attempted: number;
  extracted: number;
  needsOcr: number;
  unsupported: number;
  failed: number;
  skipped: number;
};

export async function extractKnowledgeSources(input: {
  db: AppDatabase;
  sourceRoot: string;
  knowledgeRoot: string;
  force?: boolean;
}): Promise<KnowledgeExtractionResult> {
  const documents = input.db.select().from(knowledgeDocuments).all();
  const result: KnowledgeExtractionResult = { attempted: 0, extracted: 0, needsOcr: 0, unsupported: 0, failed: 0, skipped: 0 };

  for (const document of documents) {
    const imageNeedsOcr = document.status === 'unsupported' && document.mimeType.startsWith('image/');
    if (!input.force && document.status !== 'extractable' && !imageNeedsOcr) {
      result.skipped += 1;
      continue;
    }

    result.attempted += 1;
    const startedAt = new Date().toISOString();
    try {
      if (imageNeedsOcr) {
        throw new ResearchSourceError('unsupported_visual', 'Image source requires an explicit OCR or vision provider.');
      }

      const sourcePath = resolveSourcePath(input.sourceRoot, document.relativePath);
      const bytes = fs.readFileSync(sourcePath);
      const extracted = await extractLocalBytes(document.mimeType, bytes);
      const artifact: KnowledgeExtractionArtifact = knowledgeExtractionArtifactSchema.parse({
        schemaVersion: 1,
        sourceDocumentHash: document.documentHash,
        sourceRelativePath: document.relativePath,
        mimeType: document.mimeType,
        canonicalText: extracted.canonicalText,
        pages: extracted.pages,
        parserVersion: extracted.parserVersion,
        extractionMethod: extracted.extractionMethod === 'vision'
          ? 'text_file'
          : (document.mimeType.startsWith('text/') || document.mimeType === 'application/json' || document.mimeType === 'application/xml'
            ? 'text_file'
            : extracted.extractionMethod),
        sourceVariant: extracted.sourceVariant,
        untrustedInstructionFlagged: extracted.untrustedInstructionFlagged,
      });
      const artifactPath = path.join(input.knowledgeRoot, 'extracted', `${document.documentHash}.json`);
      writeJsonAtomically(artifactPath, artifact);
      const completedAt = new Date().toISOString();
      input.db.update(knowledgeDocuments).set({
        status: 'extracted',
        extractionPath: artifactRelativePath(input.knowledgeRoot, artifactPath),
        lastError: null,
        errorCode: null,
        updatedAt: completedAt,
      }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();
      input.db.insert(knowledgeProcessingRuns).values({
        id: randomUUID(),
        stage: 'extract',
        documentHash: document.documentHash,
        status: 'succeeded',
        startedAt,
        completedAt,
        durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
      }).run();
      result.extracted += 1;
    } catch (error) {
      const failure = classifyExtractionFailure(error);
      const completedAt = new Date().toISOString();
      input.db.update(knowledgeDocuments).set({
        status: failure.status,
        lastError: failure.message,
        errorCode: failure.code,
        retryCount: document.retryCount + 1,
        updatedAt: completedAt,
      }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();
      input.db.insert(knowledgeProcessingRuns).values({
        id: randomUUID(),
        stage: 'extract',
        documentHash: document.documentHash,
        status: 'failed',
        startedAt,
        completedAt,
        durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
        errorCode: failure.code,
        error: failure.message,
      }).run();
      if (failure.status === 'needs_ocr') result.needsOcr += 1;
      else if (failure.status === 'unsupported') result.unsupported += 1;
      else result.failed += 1;
    }
  }

  syncManifestStatuses({ db: input.db, manifestPath: path.join(input.knowledgeRoot, 'manifest.jsonl') });
  return result;
}

export function readKnowledgeExtractionArtifact(artifactPath: string): KnowledgeExtractionArtifact {
  return knowledgeExtractionArtifactSchema.parse(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));
}

async function extractLocalBytes(mimeType: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  // pdfjs-dist 6 rejects Node Buffers even though Buffer extends Uint8Array;
  // normalize the bytes at this boundary so the local parser receives a real
  // Uint8Array, matching the existing research pipeline contract.
  if (mimeType === 'application/pdf') return extractPdf(new Uint8Array(bytes));
  if (mimeType === 'text/html') return extractHtml(bytes);
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') {
    const canonicalText = normalizeText(new TextDecoder().decode(bytes));
    if (!canonicalText) throw new ResearchSourceError('unsupported_document', 'Text file contained no extractable text.');
    const scan = await detectEmbeddedInstructions(canonicalText);
    return {
      canonicalText,
      pages: [{ pageNumber: null, text: canonicalText }],
      parserVersion: 'text-decoder-1',
      extractionMethod: 'html_parser',
      sourceVariant: 'text_layer',
      untrustedInstructionFlagged: scan.untrustedInstructionFlagged,
    };
  }
  throw new ResearchSourceError('unsupported_document', `Unsupported MIME type: ${mimeType}`);
}

function classifyExtractionFailure(error: unknown): { status: 'needs_ocr' | 'unsupported' | 'failed'; code: string; message: string } {
  if (error instanceof ResearchSourceError) {
    if (error.code === 'scanned_document' || error.code === 'unsupported_visual') {
      return { status: 'needs_ocr', code: error.code, message: error.message };
    }
    if (error.code === 'unsupported_document') {
      return { status: 'unsupported', code: error.code, message: error.message };
    }
    return { status: 'failed', code: error.code, message: error.message };
  }
  return {
    status: 'failed',
    code: 'extraction_failed',
    message: error instanceof Error ? error.message : 'Local extraction failed.',
  };
}

function writeJsonAtomically(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}
