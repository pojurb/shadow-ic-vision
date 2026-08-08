import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { knowledgeDocuments } from '@/db/schema';
import { extractKnowledgeSources } from '@/lib/knowledge/extraction';
import { scanKnowledgeSources } from '@/lib/knowledge/intake';
import { resolveKnowledgePaths } from '@/lib/knowledge/paths';
import { extractXlsxBytes } from '@/lib/knowledge/office/xlsx';

describe('M014-A XLSX Extraction', () => {
  let directory: string;
  let handle: DatabaseHandle;
  let paths: ReturnType<typeof resolveKnowledgePaths>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-knowledge-xlsx-'));
    paths = resolveKnowledgePaths(directory);
    fs.mkdirSync(path.join(paths.sourceRoot, 'MODULE 1'), { recursive: true });
    handle = createDatabase(path.join(directory, 'knowledge.sqlite'));
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function createSyntheticXlsxBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Main Data
    const sheet1 = workbook.addWorksheet('Overview');
    sheet1.getCell('A1').value = 'Indicator';
    sheet1.getCell('B1').value = 'Value';
    sheet1.getCell('A2').value = 'GDP Growth';
    sheet1.getCell('B2').value = 5.2;
    sheet1.getCell('A3').value = 'Total Capital';
    sheet1.getCell('B3').value = { formula: 'SUM(B2:B2)', result: 5.2 };

    // Sheet 2: Hidden calculations
    const sheet2 = workbook.addWorksheet('Secrets');
    sheet2.state = 'hidden';
    sheet2.getCell('A1').value = 'Internal Scratchpad';
    sheet2.getCell('B1').value = 999;

    // Sheet 3: veryHidden calculations
    const sheet3 = workbook.addWorksheet('VeryHidden');
    sheet3.state = 'veryHidden';
    sheet3.getCell('A1').value = 'Very hidden input';

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  it('extracts multi-sheet workbooks, hidden sheet locators, formula text and cached values', async () => {
    const buffer = await createSyntheticXlsxBuffer();
    const xlsxPath = path.join(paths.sourceRoot, 'MODULE 1', 'data.xlsx');
    fs.writeFileSync(xlsxPath, buffer);

    scanKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
      manifestPath: paths.manifestPath,
    });

    const docRow = handle.db.select().from(knowledgeDocuments).all()[0];
    expect(docRow.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(docRow.status).toBe('extractable');

    const result = await extractKnowledgeSources({
      db: handle.db,
      sourceRoot: paths.sourceRoot,
      knowledgeRoot: paths.knowledgeRoot,
    });

    expect(result.extracted).toBe(1);

    const updatedDoc = handle.db.select().from(knowledgeDocuments).all()[0];
    expect(updatedDoc.status).toBe('extracted');

    const artifactPath = path.join(paths.knowledgeRoot, 'extracted', `${updatedDoc.documentHash}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    expect(artifact.extractionMethod).toBe('xlsx_parser');
    expect(artifact.sourceVariant).toBe('text_layer');
    expect(artifact.canonicalText).toContain('[Sheet: Overview] Overview!A1: Indicator');
    expect(artifact.canonicalText).toContain('[Formula: =SUM(B2:B2) | Value: 5.2]');
    expect(artifact.canonicalText).toContain('[Sheet: Secrets (Hidden)] Secrets!A1: Internal Scratchpad');
    expect(artifact.canonicalText).toContain('[Sheet: VeryHidden (veryHidden)] VeryHidden!A1: Very hidden input');
  });

  it('fails closed on corrupt XLSX files', async () => {
    const corruptBuffer = Buffer.from('corrupt excel binary data');
    await expect(extractXlsxBytes(corruptBuffer)).rejects.toThrow('Failed to load XLSX workbook');
  });
});
