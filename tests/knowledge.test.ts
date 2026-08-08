import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { evidence, knowledgeClaims, knowledgeDocuments, knowledgeGraphEdges, knowledgeGraphNodes } from '@/db/schema';
import { processKnowledgeBatch, type KnowledgeDigestProvider } from '@/lib/knowledge/batch';
import { extractKnowledgeSources } from '@/lib/knowledge/extraction';
import { buildKnowledgeGraph, insertProvenanceCheckedEdge } from '@/lib/knowledge/graph';
import { scanKnowledgeSources } from '@/lib/knowledge/intake';
import { resolveKnowledgePaths } from '@/lib/knowledge/paths';

describe('M012 private knowledge corpus and graph foundation', () => {
  let directory: string;
  let handle: DatabaseHandle;
  let paths: ReturnType<typeof resolveKnowledgePaths>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-knowledge-'));
    paths = resolveKnowledgePaths(directory);
    fs.mkdirSync(path.join(paths.sourceRoot, 'MODULE 1'), { recursive: true });
    fs.mkdirSync(path.join(paths.sourceRoot, 'MODULE 2'), { recursive: true });
    handle = createDatabase(path.join(directory, 'knowledge.sqlite'));
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('keeps the private source and artifact roots ignored with anchored rules', () => {
    const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
    expect(gitignore).toContain('/originals/');
    expect(gitignore).toContain('/private/knowledge/');
    expect(gitignore).not.toContain('originals/**');
    expect(gitignore).not.toContain('private/knowledge/**');
  });

  it('preserves relative paths, hashes deterministically, and detects duplicates', () => {
    const bytes = 'A sanitized educational fixture claim.';
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 1', 'one.txt'), bytes);
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 2', 'copy.txt'), bytes);

    const first = scanKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot, manifestPath: paths.manifestPath });
    const firstManifest = fs.readFileSync(paths.manifestPath, 'utf8');
    expect(first.totalFiles).toBe(2);
    expect(first.uniqueDocuments).toBe(1);
    expect(first.duplicates).toBe(1);
    expect(first.records.map((record) => record.relativePath)).toEqual(['MODULE 1/one.txt', 'MODULE 2/copy.txt']);
    expect(first.records[1].status).toBe('duplicate');
    expect(handle.db.select().from(knowledgeDocuments).all()).toHaveLength(1);

    const second = scanKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot, manifestPath: paths.manifestPath });
    expect(second.uniqueDocuments).toBe(0);
    expect(fs.readFileSync(paths.manifestPath, 'utf8')).toBe(firstManifest);
  });

  it('extracts local text and marks image sources as needing OCR without calling a provider', async () => {
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 1', 'lesson.txt'), 'A sanitized local framework claim.');
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 2', 'scan.png'), Buffer.from([137, 80, 78, 71]));
    scanKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot, manifestPath: paths.manifestPath });

    const result = await extractKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot });
    expect(result.extracted).toBe(1);
    expect(result.needsOcr).toBe(1);
    expect(handle.db.select({ status: knowledgeDocuments.status }).from(knowledgeDocuments).all().map((row) => row.status).sort()).toEqual(['extracted', 'needs_ocr']);
    expect(fs.readdirSync(paths.extractedRoot)).toHaveLength(1);
  });

  it('leaves extracted documents awaiting provider when no provider is configured', async () => {
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 1', 'lesson.txt'), 'A sanitized local framework claim.');
    scanKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot, manifestPath: paths.manifestPath });
    await extractKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot });

    const result = await processKnowledgeBatch({ db: handle.db, knowledgeRoot: paths.knowledgeRoot });
    const [document] = handle.db.select().from(knowledgeDocuments).all();
    expect(result.awaitingProvider).toBe(1);
    expect(document.status).toBe('awaiting_provider');
    expect(document.errorCode).toBe('provider_not_configured');
  });

  it('rejects malformed provider JSON and records a visible failure', async () => {
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 1', 'lesson.txt'), 'A sanitized local framework claim.');
    scanKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot, manifestPath: paths.manifestPath });
    await extractKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot });
    const provider: KnowledgeDigestProvider = {
      getMetadata: () => ({ provider: 'fake', modelId: 'fake-1', promptVersion: 'test-1' }),
      async digest() { return { malformed: true }; },
    };

    const result = await processKnowledgeBatch({ db: handle.db, knowledgeRoot: paths.knowledgeRoot, provider });
    const [document] = handle.db.select().from(knowledgeDocuments).all();
    expect(result.failed).toBe(1);
    expect(document.status).toBe('failed');
    expect(document.errorCode).toBe('malformed_provider_json');
  });

  it('persists only provenance-linked claims and candidate graph edges, never live Evidence', async () => {
    const quote = 'A sanitized local framework claim.';
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 1', 'lesson.txt'), quote);
    scanKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot, manifestPath: paths.manifestPath });
    await extractKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot });
    const [document] = handle.db.select().from(knowledgeDocuments).all();
    const provider: KnowledgeDigestProvider = {
      getMetadata: () => ({ provider: 'fake', modelId: 'fake-1', promptVersion: 'test-1' }),
      async digest(input) {
        return {
          schemaVersion: 1,
          sourceDocumentHash: input.sourceDocumentHash,
          sourceRelativePath: input.sourceRelativePath,
          documentTitle: 'Sanitized fixture',
          documentDate: 'unknown',
          documentType: 'lesson',
          purpose: 'test only',
          concepts: ['concept'],
          claims: [{ claim: 'A sanitized claim.', classification: 'framework', locator: 'page 1', quote }],
          causalMechanisms: ['mechanism'],
          definitionsFormulas: ['definition'],
          relevantObservableIndicators: ['indicator'],
          limitationsExceptions: ['limitation'],
          classification: ['framework'],
        };
      },
    };

    await processKnowledgeBatch({ db: handle.db, knowledgeRoot: paths.knowledgeRoot, provider });
    const graphResult = await buildKnowledgeGraph({ db: handle.db, knowledgeRoot: paths.knowledgeRoot, graphRoot: paths.graphRoot });
    expect(graphResult.graphReady).toBe(1);
    const claims = handle.db.select().from(knowledgeClaims).all();
    const edges = handle.db.select().from(knowledgeGraphEdges).all();
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ documentHash: document.documentHash, locator: 'page 1' });
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((edge) => JSON.parse(edge.sourceClaimIds).length > 0)).toBe(true);
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
    expect(handle.db.select().from(knowledgeGraphNodes).all().every((node) => node.status === 'candidate')).toBe(true);

    const firstEdge = edges[0];
    expect(() => insertProvenanceCheckedEdge({
      db: handle.db,
      id: 'invalid-edge',
      documentHash: document.documentHash,
      sourceNodeId: firstEdge.sourceNodeId,
      targetNodeId: firstEdge.targetNodeId,
      edgeType: 'ASSERTS',
      sourceClaimIds: ['missing-claim'],
    })).toThrow('unknown source claim');
  });

  it('skips a completed identical hash on resume', async () => {
    const quote = 'A sanitized local framework claim.';
    fs.writeFileSync(path.join(paths.sourceRoot, 'MODULE 1', 'lesson.txt'), quote);
    scanKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot, manifestPath: paths.manifestPath });
    await extractKnowledgeSources({ db: handle.db, sourceRoot: paths.sourceRoot, knowledgeRoot: paths.knowledgeRoot });
    let calls = 0;
    const provider: KnowledgeDigestProvider = {
      getMetadata: () => ({ provider: 'fake', modelId: 'fake-1', promptVersion: 'test-1' }),
      async digest(input) {
        calls += 1;
        return {
          schemaVersion: 1,
          sourceDocumentHash: input.sourceDocumentHash,
          sourceRelativePath: input.sourceRelativePath,
          documentTitle: 'Fixture',
          documentDate: 'unknown',
          documentType: 'lesson',
          purpose: 'test',
          concepts: [],
          claims: [{ claim: 'A claim.', classification: 'framework', locator: 'page 1', quote }],
          causalMechanisms: [],
          definitionsFormulas: [],
          relevantObservableIndicators: [],
          limitationsExceptions: [],
          classification: ['framework'],
        };
      },
    };
    await processKnowledgeBatch({ db: handle.db, knowledgeRoot: paths.knowledgeRoot, provider });
    const second = await processKnowledgeBatch({ db: handle.db, knowledgeRoot: paths.knowledgeRoot, provider });
    expect(calls).toBe(1);
    expect(second.skipped).toBe(1);
  });

  it('applies the M012 migration tables without changing live evidence shape', () => {
    for (const table of ['knowledge_documents', 'knowledge_processing_runs', 'knowledge_claims', 'knowledge_graph_nodes', 'knowledge_graph_edges']) {
      const row = handle.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) as { name?: string } | undefined;
      expect(row?.name).toBe(table);
    }
    const evidenceColumns = handle.sqlite.prepare("PRAGMA table_info('evidence')").all() as Array<{ name: string }>;
    expect(evidenceColumns.some((column) => column.name === 'document_hash')).toBe(true);
    expect(handle.db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.status, 'graph_ready')).all()).toEqual([]);
  });
});
