import type { ResearchMarket, ResearchSourceMode, SourceAdapter, SourceSnapshot } from './adapters/types';
import { createSourceAdapters } from './adapters/factory';
import { ResearchSourceError } from './errors';
import { extractDeterministicCandidates, type EvidenceCandidate } from './extractors/candidate';
import { extractDocument } from './extractors/document';
import { createHash, verifyExactMatch } from './verifier';

export interface VerifiedEvidence {
  sourceUrl: string;
  documentHash: string;
  canonicalTextHash: string;
  exactQuote: string;
  impactSummary: string;
  sourceName: string;
  sourceTier: 'official' | 'secondary';
  sourceFormat: 'html' | 'pdf' | 'image' | 'xbrl';
  publishDate: string | null;
  retrievalTimestamp: string;
  parserVersion: string;
  extractionMethod: 'html_parser' | 'pdf_text';
  pageNumber: number | null;
}

export type ResearchExecution = {
  snapshot: SourceSnapshot;
  documentHash: string;
  evidence: VerifiedEvidence[];
};

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
  ): Promise<ResearchExecution> {
    const adapter = this.adapters[market];
    const discovery = await adapter.discover({ market, ticker, documentTypes: ['10-Q', '10-K'] });
    if (discovery.kind !== 'found') {
      throw new ResearchSourceError(discovery.code, discovery.message);
    }
    if (discovery.value.length === 0) {
      throw new ResearchSourceError('source_not_found', 'Official source returned no eligible documents.');
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
        verifyExactMatch(candidate.quote, extracted.canonicalText);
        verifiedEvidence.push({
          sourceUrl: snapshot.sourceUrl,
          sourceName: snapshot.sourceName,
          sourceTier: snapshot.sourceTier,
          sourceFormat: snapshot.sourceFormat,
          publishDate: snapshot.publishDate,
          retrievalTimestamp: snapshot.retrievalTimestamp,
          parserVersion: extracted.parserVersion,
          extractionMethod: extracted.extractionMethod,
          pageNumber: candidate.pageNumber,
          documentHash,
          canonicalTextHash,
          exactQuote: candidate.quote,
          impactSummary: candidate.impactSummary,
        });
      } catch {
        // Rejected candidates remain diagnostic artifacts and never become Evidence.
      }
    }

    return { snapshot, documentHash, evidence: verifiedEvidence };
  }
}
