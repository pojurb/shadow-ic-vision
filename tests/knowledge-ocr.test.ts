import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { knowledgeDocuments } from '@/db/schema';
import { extractKnowledgeSources } from '@/lib/knowledge/extraction';
import { scanKnowledgeSources } from '@/lib/knowledge/intake';
import { resolveKnowledgePaths } from '@/lib/knowledge/paths';
import { getOcrHandoffPath, type KnowledgeOcrHandoff } from '@/lib/knowledge/ocr';

describe('M014-B OCR Handoff Boundary', () => {
  let directory: string;
  let handle: DatabaseHandle;
  let paths: ReturnType<typeof resolveKnowledgePaths>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-knowledge-ocr-'));
    paths = resolveKnowledgePaths(directory);
    fs.mkdirSync(path.join(paths.sourceRoot, 'MODULE 1'), { recursive: true });
    handle = createDatabase(path.join(directory, 'knowledge.sqlite'));
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('remains needs_ocr when no OCR handoff file exists', async () => {
    const fakeImage = Buffer.from('fake image content');
    const imagePath = path.join(paths.sourceRoot, 'MODULE 1', 'scan.png');
    fs.writeFileSync(imagePath, fakeImage);

    scanKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
      manifestPath: paths.manifestPath,
    });

    const docRow = handle.db.select().from(knowledgeDocuments).all()[0];
    expect(docRow.mimeType).toBe('image/png');
    expect(docRow.status).toBe('unsupported');

    const result = await extractKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
      force: true,
    });

    expect(result.needsOcr).toBe(1);
    const updatedDoc = handle.db.select().from(knowledgeDocuments).all()[0];
    expect(updatedDoc.status).toBe('needs_ocr');
    expect(updatedDoc.errorCode).toBe('unsupported_visual');
  });

  it('ingests a valid file-backed OCR handoff artifact and updates provider metadata', async () => {
    const fakeImage = Buffer.from('scanned page pixels');
    const hash = crypto.createHash('sha256').update(fakeImage).digest('hex');
    const relativePath = 'MODULE 1/scan.png';
    const imagePath = path.join(paths.sourceRoot, relativePath);
    fs.writeFileSync(imagePath, fakeImage);

    scanKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
      manifestPath: paths.manifestPath,
    });

    // Create file-backed OCR handoff
    const handoffPath = getOcrHandoffPath(paths.knowledgeRoot, hash);
    fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
    
    const handoffData: KnowledgeOcrHandoff = {
      schemaVersion: 1,
      sourceDocumentHash: hash,
      sourceRelativePath: relativePath,
      canonicalText: 'Scanned Macroeconomic Chart showing Interest Rate Transmission Mechanism.',
      pages: [
        { pageNumber: 1, text: 'Scanned Macroeconomic Chart showing Interest Rate Transmission Mechanism.' },
      ],
      provider: 'terminal-agent',
      modelId: 'vision-model-test',
      promptVersion: 'ocr-v1',
    };
    fs.writeFileSync(handoffPath, JSON.stringify(handoffData, null, 2));

    const result = await extractKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
      force: true,
    });

    expect(result.extracted).toBe(1);

    const updatedDoc = handle.db.select().from(knowledgeDocuments).all()[0];
    expect(updatedDoc.status).toBe('extracted');
    expect(updatedDoc.provider).toBe('terminal-agent');
    expect(updatedDoc.modelId).toBe('vision-model-test');
    expect(updatedDoc.promptVersion).toBe('ocr-v1');

    const artifactPath = path.join(paths.knowledgeRoot, 'extracted', `${hash}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    expect(artifact.extractionMethod).toBe('ocr');
    expect(artifact.sourceVariant).toBe('scanned');
    expect(artifact.canonicalText).toContain('Interest Rate Transmission Mechanism');
  });

  it('fails closed when OCR pages are empty or inconsistent with canonical text', async () => {
    const fakeImage = Buffer.from('invalid handoff pixels');
    const hash = crypto.createHash('sha256').update(fakeImage).digest('hex');
    const relativePath = 'MODULE 1/invalid-scan.png';
    fs.writeFileSync(path.join(paths.sourceRoot, relativePath), fakeImage);

    scanKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
      manifestPath: paths.manifestPath,
    });

    const handoffPath = getOcrHandoffPath(paths.knowledgeRoot, hash);
    fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
    fs.writeFileSync(handoffPath, JSON.stringify({
      schemaVersion: 1,
      sourceDocumentHash: hash,
      sourceRelativePath: relativePath,
      canonicalText: 'Canonical OCR text',
      pages: [],
      provider: 'terminal-agent',
      modelId: 'vision-model-test',
      promptVersion: 'ocr-v1',
    }));

    const result = await extractKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
      force: true,
    });

    expect(result.failed).toBe(1);
    const updatedDoc = handle.db.select().from(knowledgeDocuments).all()[0];
    expect(updatedDoc.status).toBe('failed');
    expect(updatedDoc.errorCode).toBe('ocr_handoff_invalid');
  });
});
