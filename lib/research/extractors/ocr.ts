import type { LLMProvider, ProviderCallContext } from '@/lib/ai/provider';
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

/**
 * Real-provider counterpart to `extractSyntheticOcrCandidate`. Sends the raw
 * image bytes to a configured vision-capable provider and verifies the
 * candidate quote appears in the returned transcription before wrapping it as
 * an `ocr_matched` candidate — never `exact_verified`, per DEC-0008 rule 6 /
 * R-017. Not wired into `CitationPipeline`'s automatic recovery path: the
 * production research flow discovers evidence open-endedly against an
 * assumption, which is a larger extraction-ranking design than eligibility
 * testing requires; this function is the reusable seam for that future work.
 */
export async function extractVisionOcrCandidate(input: {
  rawBytes: Uint8Array;
  mimeType: string;
  candidateQuote: string;
  impactSummary: string;
  contentKind?: 'text' | 'screenshot';
  provider: LLMProvider;
  context: ProviderCallContext;
}): Promise<EvidenceCandidate> {
  const base64 = Buffer.from(input.rawBytes).toString('base64');
  const result = await input.provider.chat(
    [
      {
        role: 'system',
        content: 'Transcribe only the literal text visible in the attached image. Return the transcription verbatim with no commentary, formatting, or added claims.',
      },
      {
        role: 'user',
        content: 'Transcribe the visible text in this image.',
        attachments: [{ type: 'image', mimeType: input.mimeType, base64 }],
      },
    ],
    input.context,
  );

  const recognizedText = normalizeText(result.text);
  const quote = normalizeText(input.candidateQuote);
  if (!recognizedText.includes(quote)) {
    throw new ResearchSourceError('citation_not_found', 'Candidate quote differs from real provider OCR/vision output.');
  }

  return createOcrCandidate({
    quote,
    ocrText: recognizedText,
    impactSummary: input.impactSummary,
    pageNumber: null,
    contentKind: input.contentKind,
    ocrVersion: result.metadata.modelId,
  });
}
