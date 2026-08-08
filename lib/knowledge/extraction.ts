import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { knowledgeDocuments, knowledgeProcessingRuns } from '@/db/schema';
import { extractHtml, extractPdf } from '@/lib/research/extractors/document';
import { ResearchSourceError } from '@/lib/research/errors';
import { normalizeText } from '@/lib/research/verifier';
import { detectEmbeddedInstructions } from '@/lib/research/extractors/safety';
import { resolveSourcePath, artifactRelativePath } from './paths';
import { syncManifestStatuses } from './intake';
import { knowledgeExtractionArtifactSchema, type KnowledgeExtractionArtifact } from './types';
import { extractDocxBytes } from './office/docx';
import { extractXlsxBytes } from './office/xlsx';
import { processOcrHandoff } from './ocr';

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
    const isNeedsOcrStatus = document.status === 'needs_ocr' || (document.status === 'unsupported' && document.mimeType.startsWith('image/'));

    if (!input.force && document.status !== 'extractable' && !isNeedsOcrStatus) {
      result.skipped += 1;
      continue;
    }

    result.attempted += 1;
    const startedAt = new Date().toISOString();
    try {
      if (isNeedsOcrStatus) {
        const ocrDoc = await processOcrHandoff({
          knowledgeRoot: input.knowledgeRoot,
          documentHash: document.documentHash,
          relativePath: document.relativePath,
        });

        if (!ocrDoc) {
          throw new ResearchSourceError('unsupported_visual', 'Image/scanned source requires an explicit OCR handoff artifact.');
        }

        const artifact: KnowledgeExtractionArtifact = knowledgeExtractionArtifactSchema.parse({
          schemaVersion: 1,
          sourceDocumentHash: document.documentHash,
          sourceRelativePath: document.relativePath,
          mimeType: document.mimeType,
          canonicalText: ocrDoc.canonicalText,
          pages: ocrDoc.pages,
          parserVersion: ocrDoc.parserVersion,
          extractionMethod: 'ocr',
          sourceVariant: 'scanned',
          untrustedInstructionFlagged: ocrDoc.untrustedInstructionFlagged,
        });

        const artifactPath = path.join(input.knowledgeRoot, 'extracted', `${document.documentHash}.json`);
        writeJsonAtomically(artifactPath, artifact);
        const completedAt = new Date().toISOString();

        input.db.update(knowledgeDocuments).set({
          status: 'extracted',
          extractionPath: artifactRelativePath(input.knowledgeRoot, artifactPath),
          provider: ocrDoc.providerMetadata.provider,
          modelId: ocrDoc.providerMetadata.modelId,
          promptVersion: ocrDoc.providerMetadata.promptVersion,
          lastError: null,
          errorCode: null,
          updatedAt: completedAt,
        }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();

        input.db.insert(knowledgeProcessingRuns).values({
          id: randomUUID(),
          stage: 'extract',
          documentHash: document.documentHash,
          status: 'succeeded',
          provider: ocrDoc.providerMetadata.provider,
          modelId: ocrDoc.providerMetadata.modelId,
          promptVersion: ocrDoc.providerMetadata.promptVersion,
          startedAt,
          completedAt,
          durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
        }).run();

        result.extracted += 1;
        continue;
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
        extractionMethod: (document.mimeType.startsWith('text/') || document.mimeType === 'application/json' || document.mimeType === 'application/xml')
          ? 'text_file'
          : extracted.extractionMethod,
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

type KnowledgeExtractedPayload = {
  canonicalText: string;
  pages: Array<{ pageNumber: number | null; text: string; blocks?: string[] }>;
  parserVersion: string;
  extractionMethod: 'html_parser' | 'pdf_text' | 'vision' | 'text_file' | 'docx_parser' | 'xlsx_parser' | 'ocr';
  sourceVariant: 'text_layer' | 'scanned';
  untrustedInstructionFlagged: boolean;
};

async function extractLocalBytes(mimeType: string, bytes: Uint8Array): Promise<KnowledgeExtractedPayload> {
  if (mimeType === 'application/pdf') return extractPdf(new Uint8Array(bytes));
  if (mimeType === 'text/html') return extractHtml(bytes);
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const docx = await extractDocxBytes(bytes);
    return {
      canonicalText: docx.canonicalText,
      pages: docx.pages,
      parserVersion: docx.parserVersion,
      extractionMethod: docx.extractionMethod,
      sourceVariant: docx.sourceVariant,
      untrustedInstructionFlagged: docx.untrustedInstructionFlagged,
    };
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    const xlsx = await extractXlsxBytes(bytes);
    return {
      canonicalText: xlsx.canonicalText,
      pages: xlsx.pages,
      parserVersion: xlsx.parserVersion,
      extractionMethod: xlsx.extractionMethod,
      sourceVariant: xlsx.sourceVariant,
      untrustedInstructionFlagged: xlsx.untrustedInstructionFlagged,
    };
  }
  if (mimeType === 'application/msword' || mimeType === 'application/vnd.ms-excel') {
    throw new ResearchSourceError('unsupported_document', 'Legacy binary Office formats (.doc, .xls) are unsupported.');
  }
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
    if (error.code === 'unsupported_document' || error.code === 'corrupt_office_file') {
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
