import fs from 'node:fs';
import path from 'node:path';
import type { AppDatabase } from '@/db/client';
import { knowledgeDocuments, knowledgeGraphEdges, knowledgeGraphNodes, knowledgeClaims } from '@/db/schema';
import { knowledgeManifestRecordSchema } from './types';

export type KnowledgeReport = {
  schemaVersion: 1;
  generatedAt: string;
  totalFiles: number;
  filesByStatus: Record<string, number>;
  exactDuplicates: number;
  unreadableOrUnsupportedFiles: number;
  extractionFailures: number;
  documentsAwaitingProvider: number;
  claimsLackingProvenance: number;
  graphNodesByType: Record<string, number>;
  graphEdgesByType: Record<string, number>;
  candidateEdgesWithoutValidSourceClaim: number;
  resumeRetry: {
    documentsWithRetries: number;
    totalRetries: number;
  };
};

export function buildKnowledgeReport(input: {
  db: AppDatabase;
  manifestPath: string;
}): KnowledgeReport {
  const records = readManifest(input.manifestPath);
  const documents = input.db.select().from(knowledgeDocuments).all();
  const claims = input.db.select().from(knowledgeClaims).all();
  const nodes = input.db.select().from(knowledgeGraphNodes).all();
  const edges = input.db.select().from(knowledgeGraphEdges).all();
  const documentHashes = new Set(documents.map((document) => document.documentHash));
  const claimIds = new Set(claims.map((claim) => claim.id));

  const filesByStatus = countBy(records.map((record) => record.status));
  const graphNodesByType = countBy(nodes.map((node) => node.nodeType));
  const graphEdgesByType = countBy(edges.map((edge) => edge.edgeType));
  const claimsLackingProvenance = claims.filter((claim) => !documentHashes.has(claim.documentHash) || !claim.locator || !claim.quoteHash).length;
  const candidateEdgesWithoutValidSourceClaim = edges.filter((edge) => {
    if (edge.status !== 'candidate') return false;
    const sourceClaimIds = parseClaimIds(edge.sourceClaimIds);
    return sourceClaimIds.length === 0 || sourceClaimIds.some((id) => !claimIds.has(id));
  }).length;
  const totalRetries = documents.reduce((total, document) => total + document.retryCount, 0);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totalFiles: records.length,
    filesByStatus,
    exactDuplicates: records.filter((record) => record.status === 'duplicate').length,
    unreadableOrUnsupportedFiles: records.filter((record) => record.status === 'unsupported' || record.status === 'needs_ocr' || record.status === 'failed').length,
    extractionFailures: documents.filter((document) => document.errorCode && ['extraction_failed', 'corrupt_document', 'source_read_failed'].includes(document.errorCode)).length,
    documentsAwaitingProvider: documents.filter((document) => document.status === 'awaiting_provider').length,
    claimsLackingProvenance,
    graphNodesByType,
    graphEdgesByType,
    candidateEdgesWithoutValidSourceClaim,
    resumeRetry: {
      documentsWithRetries: documents.filter((document) => document.retryCount > 0).length,
      totalRetries,
    },
  };
}

export function writeKnowledgeReport(input: {
  db: AppDatabase;
  manifestPath: string;
  reportPath: string;
}): KnowledgeReport {
  const report = buildKnowledgeReport(input);
  fs.mkdirSync(path.dirname(input.reportPath), { recursive: true });
  const temporaryPath = `${input.reportPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, input.reportPath);
  return report;
}

export function parseClaimIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((value) => typeof value === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function readManifest(manifestPath: string) {
  if (!fs.existsSync(manifestPath)) return [];
  return fs.readFileSync(manifestPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => knowledgeManifestRecordSchema.parse(JSON.parse(line)));
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
