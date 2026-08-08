import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { knowledgeDocuments, knowledgeProcessingRuns } from '@/db/schema';
import { ensureKnowledgeArtifactLayout, toSourceRelativePath } from './paths';
import { knowledgeManifestRecordSchema, type KnowledgeDocumentStatus, type KnowledgeManifestRecord } from './types';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const LOCAL_TEXT_MIME_TYPES = new Set([
  'application/pdf',
  'text/html',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export type KnowledgeScanResult = {
  totalFiles: number;
  uniqueDocuments: number;
  duplicates: number;
  failedFiles: number;
  manifestPath: string;
  records: KnowledgeManifestRecord[];
};

type ReadableSource = {
  absolutePath: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  sourceHash: string;
};

export function detectKnowledgeMimeType(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function isLocallyExtractableMimeType(mimeType: string): boolean {
  return LOCAL_TEXT_MIME_TYPES.has(mimeType);
}

export function scanKnowledgeSources(input: {
  db: AppDatabase;
  sourceRoot: string;
  knowledgeRoot: string;
  manifestPath: string;
}): KnowledgeScanResult {
  ensureKnowledgeArtifactLayout({
    root: path.resolve(input.sourceRoot, '..'),
    sourceRoot: input.sourceRoot,
    knowledgeRoot: input.knowledgeRoot,
    manifestPath: input.manifestPath,
    extractedRoot: path.join(input.knowledgeRoot, 'extracted'),
    batchesRoot: path.join(input.knowledgeRoot, 'batches'),
    reportsRoot: path.join(input.knowledgeRoot, 'reports'),
    graphRoot: path.join(input.knowledgeRoot, 'graph'),
  });

  const startedAt = new Date().toISOString();
  const existing = new Map(input.db.select().from(knowledgeDocuments).all().map((row) => [row.documentHash, row]));
  const files = walkFiles(input.sourceRoot, input.sourceRoot).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const firstPathByHash = new Map<string, string>();
  const records: KnowledgeManifestRecord[] = [];
  let uniqueDocuments = 0;
  let duplicates = 0;
  let failedFiles = 0;

  for (const file of files) {
    const mimeType = detectKnowledgeMimeType(file.absolutePath);
    let readable: ReadableSource | null = null;
    try {
      const realSourceRoot = fs.realpathSync(input.sourceRoot);
      const realFile = fs.realpathSync(file.absolutePath);
      const realRelative = path.relative(realSourceRoot, realFile);
      if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        throw new Error('source_symlink_escapes_archive');
      }
      const bytes = fs.readFileSync(file.absolutePath);
      readable = {
        absolutePath: file.absolutePath,
        relativePath: file.relativePath,
        mimeType,
        sizeBytes: bytes.byteLength,
        sourceHash: crypto.createHash('sha256').update(bytes).digest('hex'),
      };
    } catch {
      failedFiles += 1;
    }

    if (!readable) {
      records.push(knowledgeManifestRecordSchema.parse({
        relativePath: file.relativePath,
        sourceHash: null,
        mimeType,
        sizeBytes: file.sizeBytes,
        status: 'failed',
        duplicateOfHash: null,
        errorCode: 'source_read_failed',
      }));
      continue;
    }

    const existingDocument = existing.get(readable.sourceHash);
    const firstPath = firstPathByHash.get(readable.sourceHash);
    const canonicalPath = existingDocument?.relativePath ?? firstPath;
    const isDuplicate = Boolean(canonicalPath && canonicalPath !== readable.relativePath);

    if (isDuplicate) {
      duplicates += 1;
      records.push({
        relativePath: readable.relativePath,
        sourceHash: readable.sourceHash,
        mimeType: readable.mimeType,
        sizeBytes: readable.sizeBytes,
        status: 'duplicate',
        duplicateOfHash: readable.sourceHash,
        errorCode: null,
      });
      continue;
    }

    firstPathByHash.set(readable.sourceHash, readable.relativePath);
    if (!existingDocument) {
      const status: KnowledgeDocumentStatus = isLocallyExtractableMimeType(readable.mimeType) ? 'extractable' : 'unsupported';
      input.db.insert(knowledgeDocuments).values({
        documentHash: readable.sourceHash,
        relativePath: readable.relativePath,
        mimeType: readable.mimeType,
        sizeBytes: readable.sizeBytes,
        status,
        duplicateOfHash: null,
        retryCount: 0,
      }).onConflictDoNothing().run();
      uniqueDocuments += 1;
      records.push({
        relativePath: readable.relativePath,
        sourceHash: readable.sourceHash,
        mimeType: readable.mimeType,
        sizeBytes: readable.sizeBytes,
        status,
        duplicateOfHash: null,
        errorCode: null,
      });
    } else {
      const shouldReclassifyAsExtractable = existingDocument.status === 'unsupported'
        && isLocallyExtractableMimeType(readable.mimeType)
        && (!existingDocument.errorCode || existingDocument.errorCode === 'unsupported_document');
      if (shouldReclassifyAsExtractable) {
        input.db.update(knowledgeDocuments).set({
          mimeType: readable.mimeType,
          sizeBytes: readable.sizeBytes,
          status: 'extractable',
          lastError: null,
          errorCode: null,
          updatedAt: new Date().toISOString(),
        }).where(eq(knowledgeDocuments.documentHash, readable.sourceHash)).run();
      }
      if (existingDocument.relativePath === readable.relativePath
        && (existingDocument.mimeType !== readable.mimeType || existingDocument.sizeBytes !== readable.sizeBytes)) {
        input.db.update(knowledgeDocuments).set({
          mimeType: readable.mimeType,
          sizeBytes: readable.sizeBytes,
          updatedAt: new Date().toISOString(),
        }).where(eq(knowledgeDocuments.documentHash, readable.sourceHash)).run();
      }
      records.push({
        relativePath: readable.relativePath,
        sourceHash: readable.sourceHash,
        mimeType: readable.mimeType,
        sizeBytes: readable.sizeBytes,
        status: shouldReclassifyAsExtractable ? 'extractable' : existingDocument.status as KnowledgeDocumentStatus,
        duplicateOfHash: null,
        errorCode: shouldReclassifyAsExtractable ? null : existingDocument.errorCode,
      });
    }
  }

  writeManifest(input.manifestPath, records);
  const completedAt = new Date().toISOString();
  input.db.insert(knowledgeProcessingRuns).values({
    id: randomUUID(),
    stage: 'scan',
    documentHash: null,
    status: 'succeeded',
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
  }).run();

  return {
    totalFiles: files.length,
    uniqueDocuments,
    duplicates,
    failedFiles,
    manifestPath: input.manifestPath,
    records: records.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
  };
}

export function writeManifest(manifestPath: string, records: KnowledgeManifestRecord[]) {
  const content = records
    .slice()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    .map((record) => JSON.stringify(knowledgeManifestRecordSchema.parse(record)))
    .join('\n');
  const temporaryPath = `${manifestPath}.tmp`;
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(temporaryPath, content ? `${content}\n` : '', 'utf8');
  fs.renameSync(temporaryPath, manifestPath);
}

export function syncManifestStatuses(input: { db: AppDatabase; manifestPath: string }) {
  if (!fs.existsSync(input.manifestPath)) return;
  const documents = new Map(input.db.select().from(knowledgeDocuments).all().map((document) => [document.documentHash, document]));
  const records = fs.readFileSync(input.manifestPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => knowledgeManifestRecordSchema.parse(JSON.parse(line)))
    .map((record) => {
      if (!record.sourceHash || record.status === 'duplicate') return record;
      const document = documents.get(record.sourceHash);
      if (!document) return record;
      return { ...record, status: document.status as KnowledgeDocumentStatus, errorCode: document.errorCode };
    });
  writeManifest(input.manifestPath, records);
}

function walkFiles(directory: string, sourceRoot: string): Array<{ absolutePath: string; relativePath: string; sizeBytes: number }> {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  const files: Array<{ absolutePath: string; relativePath: string; sizeBytes: number }> = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath, sourceRoot));
      continue;
    }
    const relativePath = toSourceRelativePath(sourceRoot, absolutePath);
    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(absolutePath).size; } catch { /* read path records a visible failure */ }
    files.push({ absolutePath, relativePath, sizeBytes });
  }
  return files;
}
