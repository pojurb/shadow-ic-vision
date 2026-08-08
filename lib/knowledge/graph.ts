import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { knowledgeDocuments, knowledgeGraphEdges, knowledgeGraphNodes, knowledgeClaims, knowledgeProcessingRuns } from '@/db/schema';
import { knowledgeBatchArtifactSchema, knowledgeEdgeTypeSchema, knowledgeNodeTypeSchema, type KnowledgeEdgeType, type KnowledgeNodeType } from './types';
import { syncManifestStatuses } from './intake';

export type KnowledgeGraphResult = {
  attempted: number;
  graphReady: number;
  skipped: number;
  failed: number;
  nodes: number;
  edges: number;
};

export async function buildKnowledgeGraph(input: {
  db: AppDatabase;
  knowledgeRoot: string;
  graphRoot: string;
  force?: boolean;
}): Promise<KnowledgeGraphResult> {
  const documents = input.db.select().from(knowledgeDocuments).all();
  const result: KnowledgeGraphResult = { attempted: 0, graphReady: 0, skipped: 0, failed: 0, nodes: 0, edges: 0 };

  for (const document of documents) {
    if (!input.force && document.status === 'graph_ready') {
      result.skipped += 1;
      continue;
    }
    if (document.status !== 'digested' || !document.batchPath) {
      result.skipped += 1;
      continue;
    }
    result.attempted += 1;
    try {
      const artifact = knowledgeBatchArtifactSchema.parse(JSON.parse(fs.readFileSync(path.join(input.knowledgeRoot, document.batchPath), 'utf8')));
      if (artifact.status !== 'digested' || !artifact.sourceCard) throw new Error('Validated source card is missing from batch artifact.');
      const card = artifact.sourceCard;
      const sourceNodeId = deterministicId('source', document.documentHash);
      ensureNode(input.db, {
        id: sourceNodeId,
        documentHash: document.documentHash,
        sourceClaimId: null,
        nodeType: 'SourceDocument',
        label: document.relativePath,
        description: card.documentTitle,
        status: 'candidate',
      });

      const claimIds: string[] = [];
      for (let index = 0; index < card.claims.length; index += 1) {
        const claim = card.claims[index];
        const claimId = deterministicId('claim', document.documentHash, String(index), claim.claim, claim.locator);
        const quoteHash = claim.quoteHash ?? (claim.quote ? crypto.createHash('sha256').update(claim.quote).digest('hex') : null);
        if (!quoteHash) throw new Error('Validated claim has no quote hash.');
        input.db.insert(knowledgeClaims).values({
          id: claimId,
          documentHash: document.documentHash,
          claimText: claim.claim,
          classification: claim.classification,
          locator: claim.locator,
          quoteHash,
          status: 'candidate',
        }).onConflictDoNothing().run();
        claimIds.push(claimId);

        const claimNodeId = deterministicId('node-claim', claimId);
        ensureNode(input.db, {
          id: claimNodeId,
          documentHash: document.documentHash,
          sourceClaimId: claimId,
          nodeType: 'Claim',
          label: claim.claim,
          description: `${claim.classification} @ ${claim.locator}`,
          status: 'candidate',
        });
        insertProvenanceCheckedEdge({
          db: input.db,
          id: deterministicId('edge-contains', document.documentHash, claimId),
          documentHash: document.documentHash,
          sourceNodeId,
          targetNodeId: claimNodeId,
          edgeType: 'CONTAINS',
          sourceClaimIds: [claimId],
        });

        const sectionNodeId = deterministicId('node-section', document.documentHash, claim.locator);
        ensureNode(input.db, {
          id: sectionNodeId,
          documentHash: document.documentHash,
          sourceClaimId: claimId,
          nodeType: 'Section',
          label: claim.locator,
          description: null,
          status: 'candidate',
        });
        insertProvenanceCheckedEdge({
          db: input.db,
          id: deterministicId('edge-section', document.documentHash, claimId),
          documentHash: document.documentHash,
          sourceNodeId: claimNodeId,
          targetNodeId: sectionNodeId,
          edgeType: 'DERIVED_FROM',
          sourceClaimIds: [claimId],
        });
      }

      const primaryClaimId = claimIds[0];
      if (primaryClaimId) {
        const categories: Array<{ type: KnowledgeNodeType; values: string[]; edgeType: KnowledgeEdgeType }> = [
          { type: 'Concept', values: card.concepts, edgeType: 'ASSERTS' },
          { type: 'Mechanism', values: card.causalMechanisms, edgeType: 'CAUSES' },
          { type: 'Framework', values: card.definitionsFormulas, edgeType: 'DEFINES' },
          { type: 'Indicator', values: card.relevantObservableIndicators, edgeType: 'MEASURED_BY' },
          { type: 'Limitation', values: card.limitationsExceptions, edgeType: 'QUALIFIES' },
        ];
        const claimNodeId = deterministicId('node-claim', primaryClaimId);
        for (const category of categories) {
          for (const value of category.values) {
            const nodeId = deterministicId(`node-${category.type}`, document.documentHash, value);
            ensureNode(input.db, {
              id: nodeId,
              documentHash: document.documentHash,
              sourceClaimId: primaryClaimId,
              nodeType: category.type,
              label: value,
              description: null,
              status: 'candidate',
            });
            insertProvenanceCheckedEdge({
              db: input.db,
              id: deterministicId(`edge-${category.edgeType}`, primaryClaimId, category.type, value),
              documentHash: document.documentHash,
              sourceNodeId: claimNodeId,
              targetNodeId: nodeId,
              edgeType: category.edgeType,
              sourceClaimIds: [primaryClaimId],
            });
          }
        }
      }

      const graphNodes = input.db.select().from(knowledgeGraphNodes).where(eq(knowledgeGraphNodes.documentHash, document.documentHash)).all();
      const graphEdges = input.db.select().from(knowledgeGraphEdges).where(eq(knowledgeGraphEdges.documentHash, document.documentHash)).all();
      const graphPath = path.join(input.graphRoot, `${document.documentHash}.json`);
      writeJsonAtomically(graphPath, {
        schemaVersion: 1,
        sourceDocumentHash: document.documentHash,
        sourceRelativePath: document.relativePath,
        nodes: graphNodes,
        edges: graphEdges,
      });
      input.db.update(knowledgeDocuments).set({
        status: 'graph_ready',
        updatedAt: new Date().toISOString(),
        lastError: null,
        errorCode: null,
      }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();
      result.graphReady += 1;
      result.nodes += graphNodes.length;
      result.edges += graphEdges.length;
    } catch (error) {
      const completedAt = new Date().toISOString();
      input.db.update(knowledgeDocuments).set({
        status: 'failed',
        errorCode: 'graph_failed',
        lastError: error instanceof Error ? error.message : 'Knowledge graph build failed.',
        retryCount: document.retryCount + 1,
        updatedAt: completedAt,
      }).where(eq(knowledgeDocuments.documentHash, document.documentHash)).run();
      input.db.insert(knowledgeProcessingRuns).values({
        id: crypto.randomUUID(),
        stage: 'graph',
        documentHash: document.documentHash,
        status: 'failed',
        startedAt: completedAt,
        completedAt,
        errorCode: 'graph_failed',
        error: error instanceof Error ? error.message : 'Knowledge graph build failed.',
      }).run();
      result.failed += 1;
    }
  }
  syncManifestStatuses({ db: input.db, manifestPath: path.join(input.knowledgeRoot, 'manifest.jsonl') });
  return result;
}

export function insertProvenanceCheckedEdge(input: {
  db: AppDatabase;
  id: string;
  documentHash: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: KnowledgeEdgeType;
  sourceClaimIds: string[];
  status?: 'candidate' | 'approved' | 'rejected';
}) {
  const edgeType = knowledgeEdgeTypeSchema.parse(input.edgeType);
  const sourceClaimIds = [...new Set(input.sourceClaimIds.filter((value) => value.trim()))];
  if (sourceClaimIds.length === 0) throw new Error('Graph edge requires at least one source claim ID.');
  const claims = input.db.select({ id: knowledgeClaims.id }).from(knowledgeClaims).where(and(
    eq(knowledgeClaims.documentHash, input.documentHash),
    inArray(knowledgeClaims.id, sourceClaimIds),
  )).all();
  if (claims.length !== sourceClaimIds.length) throw new Error('Graph edge references an unknown source claim.');
  const sourceNode = input.db.select({ id: knowledgeGraphNodes.id }).from(knowledgeGraphNodes).where(and(
    eq(knowledgeGraphNodes.id, input.sourceNodeId),
    eq(knowledgeGraphNodes.documentHash, input.documentHash),
  )).get();
  const targetNode = input.db.select({ id: knowledgeGraphNodes.id }).from(knowledgeGraphNodes).where(and(
    eq(knowledgeGraphNodes.id, input.targetNodeId),
    eq(knowledgeGraphNodes.documentHash, input.documentHash),
  )).get();
  if (!sourceNode || !targetNode) throw new Error('Graph edge references an unknown graph node.');
  input.db.insert(knowledgeGraphEdges).values({
    id: input.id,
    documentHash: input.documentHash,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    edgeType,
    sourceClaimIds: JSON.stringify(sourceClaimIds),
    status: input.status ?? 'candidate',
  }).onConflictDoNothing().run();
}

function ensureNode(input: Parameters<typeof insertProvenanceCheckedEdge>[0]['db'], values: {
  id: string;
  documentHash: string;
  sourceClaimId: string | null;
  nodeType: KnowledgeNodeType;
  label: string;
  description: string | null;
  status: 'candidate' | 'approved' | 'rejected';
}) {
  input.insert(knowledgeGraphNodes).values({
    ...values,
    nodeType: knowledgeNodeTypeSchema.parse(values.nodeType),
  }).onConflictDoNothing().run();
}

function deterministicId(prefix: string, ...parts: string[]) {
  const digest = crypto.createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32);
  return `${prefix}-${digest}`;
}

function writeJsonAtomically(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}
