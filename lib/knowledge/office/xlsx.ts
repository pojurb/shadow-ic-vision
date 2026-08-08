import ExcelJS from 'exceljs';
import { ResearchSourceError } from '@/lib/research/errors';
import { normalizeText } from '@/lib/research/verifier';
import { detectEmbeddedInstructions } from '@/lib/research/extractors/safety';

export type ExtractedOfficeXlsx = {
  canonicalText: string;
  pages: Array<{ pageNumber: number | null; text: string; blocks?: string[] }>;
  parserVersion: string;
  extractionMethod: 'xlsx_parser';
  sourceVariant: 'text_layer';
  untrustedInstructionFlagged: boolean;
};

export async function extractXlsxBytes(bytes: Uint8Array): Promise<ExtractedOfficeXlsx> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch (err) {
    throw new ResearchSourceError('corrupt_office_file', 'Failed to load XLSX workbook: ' + (err instanceof Error ? err.message : String(err)));
  }

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new ResearchSourceError('unsupported_document', 'XLSX workbook contains no worksheets.');
  }

  const blocks: string[] = [];

  for (const worksheet of workbook.worksheets) {
    const isHidden = worksheet.state === 'hidden';
    const isVeryHidden = worksheet.state === 'veryHidden';
    
    let sheetHeader = `[Sheet: ${worksheet.name}]`;
    if (isHidden) {
      sheetHeader = `[Sheet: ${worksheet.name} (Hidden)]`;
    } else if (isVeryHidden) {
      sheetHeader = `[Sheet: ${worksheet.name} (veryHidden)]`;
    }

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const address = `${worksheet.name}!${cell.address}`;
        const cellRep = formatCellRepresentation(cell);
        if (cellRep) {
          blocks.push(`${sheetHeader} ${address}: ${cellRep}`);
        }
      });
    });
  }

  const rawText = blocks.join('\n');
  const canonicalText = normalizeText(rawText);
  if (!canonicalText) {
    throw new ResearchSourceError('unsupported_document', 'XLSX workbook contained no extractable text or data.');
  }

  const safetyScan = await detectEmbeddedInstructions(canonicalText);

  return {
    canonicalText,
    pages: [
      {
        pageNumber: 1,
        text: canonicalText,
        blocks,
      },
    ],
    parserVersion: 'xlsx-exceljs-1',
    extractionMethod: 'xlsx_parser',
    sourceVariant: 'text_layer',
    untrustedInstructionFlagged: safetyScan.untrustedInstructionFlagged,
  };
}

function formatCellRepresentation(cell: ExcelJS.Cell): string | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;

  // Check if cell is a formula cell
  if (typeof value === 'object' && 'formula' in value) {
    const formulaStr = String(value.formula).trim();
    const resultValue = value.result !== undefined && value.result !== null ? String(value.result).trim() : '';
    if (resultValue) {
      return `[Formula: =${formulaStr} | Value: ${resultValue}]`;
    }
    return `[Formula: =${formulaStr}]`;
  }

  // Handle rich text
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    const text = value.richText.map((rt) => rt.text).join('').trim();
    return text || null;
  }

  // Handle hyperlink text
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text.trim() || null;
  }

  // Handle Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  const str = String(value).trim();
  return str || null;
}
