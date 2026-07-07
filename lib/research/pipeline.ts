import type { ResearchMarket, ResearchSourceMode, SourceAdapter, SourceSnapshot } from './adapters/types';
import { createSourceAdapters } from './adapters/factory';
import { ResearchSourceError } from './errors';
import { extractDeterministicCandidates, type EvidenceCandidate, type EvidenceContentKind, type EvidenceExtractionMethod } from './extractors/candidate';
import { extractDocument } from './extractors/document';
import { createHash, verifyExactMatch, verifyPageExactMatch } from './verifier';

export interface VerifiedEvidence {
  sourceUrl: string;
  documentHash: string;
  canonicalTextHash: string | null;
  exactQuote: string;
  impactSummary: string;
  sourceName: string;
  sourceTier: 'official' | 'secondary';
  sourceFormat: 'html' | 'pdf' | 'image' | 'xbrl';
  sourceVariant: 'text_layer' | 'scanned' | 'encrypted' | 'corrupt' | 'unsupported' | null;
  contentKind: EvidenceContentKind;
  publishDate: string | null;
  retrievalTimestamp: string;
  extractionMethod: EvidenceExtractionMethod;
  verificationStatus: 'exact_verified' | 'ocr_matched' | 'derived';
  pageNumber: number | null;
  boundingBox: [number, number, number, number] | null;
  metadata: Record<string, unknown>;
}

export type ResearchExecution = {
  unchanged?: false;
  snapshot: SourceSnapshot;
  documentHash: string;
  evidence: VerifiedEvidence[];
} | { unchanged: true; documentId: string };

export class CitationPipeline {
  readonly sourceMode: ResearchSourceMode;

  constructor(private readonly adapters: Record<ResearchMarket, SourceAdapter> = createSourceAdapters()) {
    this.sourceMode = adapters.US.mode === 'live' || adapters.ID.mode === 'live' ? 'live' : 'mock';
  }

  async executeResearchJob(
    market: ResearchMarket,
    ticker: string,
    assumption: string,
    candidateOverrides?: EvidenceCandidate[],
    knownDocumentIds: ReadonlySet<string> = new Set(),
  ): Promise<ResearchExecution> {
    const adapter = this.adapters[market];
    const discovery = await adapter.discover({ market, ticker, documentTypes: ['10-Q', '10-K'] });
    if (discovery.kind !== 'found') {
      throw new ResearchSourceError(discovery.code, discovery.message);
    }
    if (discovery.value.length === 0) {
      throw new ResearchSourceError('source_not_found', 'Official source returned no eligible documents.');
    }
    if (knownDocumentIds.has(discovery.value[0].documentId)) {
      return { unchanged: true, documentId: discovery.value[0].documentId };
    }

    const fetched = await adapter.fetchSnapshot(discovery.value[0]);
    if (fetched.kind !== 'found') throw new ResearchSourceError(fetched.code, fetched.message);

    const snapshot = fetched.value;
    const documentHash = createHash(snapshot.rawBytes);
    let extracted;
    try {
      extracted = await extractDocument(snapshot);
    } catch (error) {
      if (error instanceof ResearchSourceError) {
        throw new ResearchSourceError(error.code, error.message, { snapshot, documentHash });
      }
      throw error;
    }
    const canonicalTextHash = createHash(extracted.canonicalText);
    const candidates = candidateOverrides ?? extractDeterministicCandidates(extracted, assumption, ticker);
    const verifiedEvidence: VerifiedEvidence[] = [];

    for (const candidate of candidates) {
      try {
        const verificationStatus = candidate.verificationStatus;
        if (verificationStatus === 'exact_verified') {
          verifyExactMatch(candidate.quote, extracted.canonicalText);
          if (candidate.pageNumber !== null) verifyPageExactMatch(candidate.quote, extracted.pages, candidate.pageNumber);
        } else if (verificationStatus === 'ocr_matched') {
          verifyExactMatch(candidate.quote, candidate.ocrText);
        } else if (!candidate.metadata?.method || candidate.metadata.inputs === undefined) {
          throw new Error('Derived evidence is missing deterministic derivation metadata.');
        }

        verifiedEvidence.push({
          sourceUrl: snapshot.sourceUrl,
          sourceName: snapshot.sourceName,
          sourceTier: snapshot.sourceTier,
          sourceFormat: snapshot.sourceFormat,
          sourceVariant: verificationStatus === 'exact_verified' && snapshot.sourceFormat === 'pdf' ? 'text_layer' : candidate.sourceVariant ?? null,
          contentKind: candidate.contentKind ?? 'text',
          publishDate: snapshot.publishDate,
          retrievalTimestamp: snapshot.retrievalTimestamp,
          extractionMethod: verificationStatus === 'exact_verified' ? extracted.extractionMethod : candidate.extractionMethod ?? 'ocr',
          verificationStatus,
          pageNumber: candidate.pageNumber,
          boundingBox: candidate.boundingBox ?? null,
          documentHash,
          canonicalTextHash: verificationStatus === 'exact_verified' ? canonicalTextHash : null,
          exactQuote: candidate.quote,
          impactSummary: candidate.impactSummary,
          metadata: verificationStatus === 'exact_verified'
            ? { parserVersion: extracted.parserVersion }
            : candidate.metadata ?? {},
        });
      } catch {
        // Rejected candidates remain diagnostic artifacts and never become Evidence.
      }
    }

    return { snapshot, documentHash, evidence: verifiedEvidence };
  }
}
