import JSZip from 'jszip';
import { ResearchSourceError } from '@/lib/research/errors';
import { normalizeText } from '@/lib/research/verifier';
import { detectEmbeddedInstructions } from '@/lib/research/extractors/safety';

export type ExtractedOfficeDoc = {
  canonicalText: string;
  pages: Array<{ pageNumber: number | null; text: string; blocks?: string[] }>;
  parserVersion: string;
  extractionMethod: 'docx_parser';
  sourceVariant: 'text_layer';
  untrustedInstructionFlagged: boolean;
};

export async function extractDocxBytes(bytes: Uint8Array): Promise<ExtractedOfficeDoc> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (err) {
    throw new ResearchSourceError('corrupt_office_file', 'Failed to unzip DOCX document: ' + (err instanceof Error ? err.message : String(err)));
  }

  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new ResearchSourceError('unsupported_document', 'DOCX archive missing word/document.xml entry.');
  }

  const xmlText = await documentXmlFile.async('text');
  
  // Check for macros or VBA binaries
  const hasVba = Boolean(zip.file('word/vbaProject.bin') || zip.file('vbaProject.bin'));
  
  const { blocks, hasImages } = parseWordDocumentXml(xmlText);

  let limitationNotice = '';
  if (hasVba) {
    limitationNotice += ' [Limitation: Embedded VBA macro script present]';
  }
  if (hasImages) {
    limitationNotice += ' [Limitation: Embedded images or drawings present]';
  }

  const combinedBlocks = [...blocks];
  if (limitationNotice) {
    combinedBlocks.push(limitationNotice.trim());
  }

  const rawText = combinedBlocks.join('\n\n');
  const canonicalText = normalizeText(rawText);
  if (!canonicalText) {
    throw new ResearchSourceError('unsupported_document', 'DOCX document contained no extractable text.');
  }

  const safetyScan = await detectEmbeddedInstructions(canonicalText);

  return {
    canonicalText,
    pages: [
      {
        pageNumber: 1,
        text: canonicalText,
        blocks: combinedBlocks,
      },
    ],
    parserVersion: 'docx-openxml-1',
    extractionMethod: 'docx_parser',
    sourceVariant: 'text_layer',
    untrustedInstructionFlagged: safetyScan.untrustedInstructionFlagged,
  };
}

function parseWordDocumentXml(xml: string): {
  blocks: string[];
  headings: string[];
  hasTables: boolean;
  hasImages: boolean;
} {
  const blocks: string[] = [];
  const headings: string[] = [];
  let hasTables = false;
  let hasImages = false;

  if (xml.includes('<w:drawing') || xml.includes('<w:pict')) {
    hasImages = true;
  }

  // Regex to iterate over top-level elements inside w:body (<w:p> and <w:tbl>)
  const bodyMatch = xml.match(/<w:body[\s\S]*?>([\s\S]*?)<\/w:body>/);
  const bodyContent = bodyMatch ? bodyMatch[1] : xml;

  let paragraphIndex = 0;
  let tableIndex = 0;

  // Split into paragraphs and tables by matching tags
  const elementRegex = /<w:p[\s\S]*?>[\s\S]*?<\/w:p>|<w:tbl[\s\S]*?>[\s\S]*?<\/w:tbl>/g;
  let match: RegExpExecArray | null;

  while ((match = elementRegex.exec(bodyContent)) !== null) {
    const elXml = match[0];
    if (elXml.startsWith('<w:p')) {
      paragraphIndex += 1;
      const { text, headingLevel } = parseParagraphXml(elXml);
      if (text) {
        let blockText = text;
        if (headingLevel) {
          headings.push(text);
          blockText = `[${headingLevel}] ${text}`;
        } else {
          blockText = `[Paragraph ${paragraphIndex}] ${text}`;
        }
        blocks.push(blockText);
      }
    } else if (elXml.startsWith('<w:tbl')) {
      tableIndex += 1;
      hasTables = true;
      const tableBlocks = parseTableXml(elXml, tableIndex);
      blocks.push(...tableBlocks);
    }
  }

  return { blocks, headings, hasTables, hasImages };
}

function parseParagraphXml(pXml: string): { text: string; headingLevel: string | null } {
  let headingLevel: string | null = null;
  const styleMatch = pXml.match(/<w:pStyle w:val="([^"]+)"/);
  if (styleMatch) {
    const val = styleMatch[1];
    if (/^Heading[1-6]$/i.test(val)) {
      headingLevel = val.toUpperCase();
    }
  }

  const textRuns: string[] = [];
  const tRegex = /<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g;
  let tMatch: RegExpExecArray | null;
  while ((tMatch = tRegex.exec(pXml)) !== null) {
    const raw = tMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    textRuns.push(raw);
  }

  const text = textRuns.join('').trim();
  return { text, headingLevel };
}

function parseTableXml(tblXml: string, tableIndex: number): string[] {
  const tableBlocks: string[] = [];
  const rowRegex = /<w:tr[\s\S]*?>([\s\S]*?)<\/w:tr>/g;
  let rMatch: RegExpExecArray | null;
  let rowIndex = 0;

  while ((rMatch = rowRegex.exec(tblXml)) !== null) {
    rowIndex += 1;
    const trXml = rMatch[1];
    const cellRegex = /<w:tc[\s\S]*?>([\s\S]*?)<\/w:tc>/g;
    let cMatch: RegExpExecArray | null;
    let colIndex = 0;

    while ((cMatch = cellRegex.exec(trXml)) !== null) {
      colIndex += 1;
      const tcXml = cMatch[1];
      const { text } = parseParagraphXml(tcXml);
      if (text) {
        tableBlocks.push(`[Table ${tableIndex}, Row ${rowIndex}, Col ${colIndex}] ${text}`);
      }
    }
  }

  return tableBlocks;
}
