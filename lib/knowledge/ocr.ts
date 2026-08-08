import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ResearchSourceError } from '@/lib/research/errors';
import { normalizeText } from '@/lib/research/verifier';
import { detectEmbeddedInstructions } from '@/lib/research/extractors/safety';

export const knowledgeOcrHandoffSchema = z.object({
  schemaVersion: z.literal(1),
  sourceDocumentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRelativePath: z.string().min(1),
  canonicalText: z.string().min(1),
  pages: z.array(z.object({
    pageNumber: z.number().int().nullable(),
    text: z.string().min(1),
  })).min(1),
  provider: z.string().min(1),
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
});
export type KnowledgeOcrHandoff = z.infer<typeof knowledgeOcrHandoffSchema>;

export type ExtractedOcrDoc = {
  canonicalText: string;
  pages: Array<{ pageNumber: number | null; text: string; blocks?: string[] }>;
  parserVersion: string;
  extractionMethod: 'ocr';
  sourceVariant: 'scanned';
  untrustedInstructionFlagged: boolean;
  providerMetadata: {
    provider: string;
    modelId: string;
    promptVersion: string;
  };
};

export function getOcrHandoffPath(knowledgeRoot: string, documentHash: string): string {
  return path.join(knowledgeRoot, 'ocr_handoff', `${documentHash}.json`);
}

export async function processOcrHandoff(input: {
  knowledgeRoot: string;
  documentHash: string;
  relativePath: string;
}): Promise<ExtractedOcrDoc | null> {
  const handoffPath = getOcrHandoffPath(input.knowledgeRoot, input.documentHash);
  if (!fs.existsSync(handoffPath)) {
    return null; // No handoff file exists -> document remains needs_ocr
  }

  let handoff: KnowledgeOcrHandoff;
  try {
    const content = fs.readFileSync(handoffPath, 'utf8');
    handoff = knowledgeOcrHandoffSchema.parse(JSON.parse(content));
  } catch (err) {
    throw new ResearchSourceError('ocr_handoff_invalid', 'OCR handoff file invalid or corrupt: ' + (err instanceof Error ? err.message : String(err)));
  }

  if (handoff.sourceDocumentHash !== input.documentHash) {
    throw new ResearchSourceError('ocr_handoff_mismatch', `OCR handoff hash mismatch: expected ${input.documentHash}, got ${handoff.sourceDocumentHash}`);
  }

  if (handoff.sourceRelativePath !== input.relativePath) {
    throw new ResearchSourceError('ocr_handoff_mismatch', `OCR handoff path mismatch: expected ${input.relativePath}, got ${handoff.sourceRelativePath}`);
  }

  const canonicalText = normalizeText(handoff.canonicalText);
  if (!canonicalText) {
    throw new ResearchSourceError('ocr_handoff_invalid', 'OCR handoff text contained no extractable content.');
  }

  const numberedPages = handoff.pages.filter((page) => page.pageNumber !== null);
  for (let index = 1; index < numberedPages.length; index += 1) {
    if ((numberedPages[index - 1].pageNumber as number) >= (numberedPages[index].pageNumber as number)) {
      throw new ResearchSourceError('ocr_handoff_invalid', 'OCR handoff page numbers must be strictly increasing.');
    }
  }
  for (const page of handoff.pages) {
    const pageText = normalizeText(page.text);
    if (!canonicalText.includes(pageText)) {
      throw new ResearchSourceError('ocr_handoff_invalid', 'OCR handoff page text is not present in canonicalText.');
    }
  }

  const safetyScan = await detectEmbeddedInstructions(canonicalText);

  return {
    canonicalText,
    pages: handoff.pages,
    parserVersion: `ocr-${handoff.provider}-${handoff.modelId}`,
    extractionMethod: 'ocr',
    sourceVariant: 'scanned',
    untrustedInstructionFlagged: safetyScan.untrustedInstructionFlagged,
    providerMetadata: {
      provider: handoff.provider,
      modelId: handoff.modelId,
      promptVersion: handoff.promptVersion,
    },
  };
}
