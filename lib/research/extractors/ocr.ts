import { ResearchSourceError } from '../errors';
import { normalizeText } from '../verifier';
import { createOcrCandidate, type EvidenceCandidate } from './candidate';

export type SyntheticOcrPage = {
  pageNumber: number;
  text: string;
  boundingBox?: [number, number, number, number] | null;
};

export function extractSyntheticOcrCandidate(input: {
  pages: SyntheticOcrPage[];
  candidateQuote: string;
  impactSummary: string;
  ocrVersion?: string;
  contentKind?: 'text' | 'screenshot';
}): EvidenceCandidate {
  const quote = normalizeText(input.candidateQuote);
  const page = input.pages.find((item) => normalizeText(item.text).includes(quote));
  if (!page) {
    throw new ResearchSourceError('citation_not_found', 'Candidate quote differs from retained OCR output.');
  }

  return createOcrCandidate({
    quote,
    ocrText: normalizeText(page.text),
    impactSummary: input.impactSummary,
    pageNumber: page.pageNumber,
    contentKind: input.contentKind,
    boundingBox: page.boundingBox,
    ocrVersion: input.ocrVersion,
  });
}
