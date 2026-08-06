import type { ResearchMarket, ResearchSourceMode, SourceAdapter, SourceSnapshot } from './adapters/types';
import { createSourceAdapters } from './adapters/factory';
import { ResearchSourceError } from './errors';
import { extractDeterministicCandidates, extractSecondaryCandidates, type EvidenceCandidate, type EvidenceContentKind, type EvidenceExtractionMethod, type EvidenceVerificationStatus } from './extractors/candidate';
import { extractDocument, type VisionTranscriber } from './extractors/document';
import type { InstructionClassifier } from './extractors/safety';
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
  // M007 Slice 2: type widened to match EvidenceVerificationStatus. The
  // pipeline's own branching bug that would reject secondary candidates at
  // runtime is fixed in Slice 4, not here — this is a type-only change.
  verificationStatus: EvidenceVerificationStatus;
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

  /**
   * `visionTranscriber` is optional and absent by default: image sources keep
   * failing closed with `unsupported_visual` unless a caller opts in with a
   * DEC-0012-eligible vision provider.
   *
   * `instructionClassifier` is likewise optional and absent by default (M006
   * follow-on, 2026-07-25): without one, R-018 detection is the free regex
   * only. Configuring one adds a provider call at extraction time as a second
   * opinion for languages the regex cannot match.
   */
  constructor(
    private readonly adapters: Record<ResearchMarket, SourceAdapter> = createSourceAdapters(),
    private readonly visionTranscriber?: VisionTranscriber,
    private readonly instructionClassifier?: InstructionClassifier,
  ) {
    this.sourceMode = adapters.US.mode === 'live' || adapters.ID.mode === 'live' ? 'live' : 'mock';
  }

  /**
   * `evidenceClass` (M007 Slice 4) selects which extraction path runs when
   * `candidateOverrides` is absent: `'official'` (default, unchanged
   * behavior) calls `extractDeterministicCandidates`; the two secondary
   * classes call `extractSecondaryCandidates`. Callers making a secondary
   * call construct a separate `CitationPipeline` instance wired with the
   * relevant secondary adapter (see `lib/research/service.ts`) — this
   * method does not switch adapters mid-call, only extraction behavior.
   */
  async executeResearchJob(
    market: ResearchMarket,
    ticker: string,
    assumption: string,
    candidateOverrides?: EvidenceCandidate[],
    knownDocumentIds: ReadonlySet<string> = new Set(),
    evidenceClass: 'official' | 'secondary_issuer' | 'secondary_news' = 'official',
    identity = '',
  ): Promise<ResearchExecution> {
    const adapter = this.adapters[market];
    const discovery = await adapter.discover({ market, ticker, documentTypes: ['10-Q', '10-K'] });
    if (discovery.kind !== 'found') {
      throw new ResearchSourceError(discovery.code, discovery.message);
    }
    if (discovery.value.length === 0) {
      throw new ResearchSourceError('source_not_found', `${evidenceClass === 'official' ? 'Official' : 'Secondary'} source returned no eligible documents.`);
    }
    /*
     * Was `discovery.value[0]` alone, both for the change check and the fetch.
     * Adapters return up to 20 discovered documents, so 19 were discarded
     * unconditionally — and because `knownDocumentIds` is scoped by
     * market/ticker rather than by assumption (see `processResearchJobs`), one
     * sibling job snapshotting a document made every other assumption's job
     * short-circuit to `unchanged` within the same run. Verified against the
     * real TLKM thesis on 2026-08-05: five of six jobs flipped from `degraded`
     * to `succeeded` in under four seconds while adding no evidence at all,
     * and the issuer's annual report sat unfetched behind a quarterly filing
     * that happened to appear first in DOM order.
     *
     * Now the sweep advances to the first document not already seen, so a
     * known leading document no longer ends the job. `unchanged` is reserved
     * for its true meaning: every discovered document has already been
     * retrieved, so there is nothing new to process.
     */
    const nextDocument = discovery.value.find((document) => !knownDocumentIds.has(document.documentId));
    if (!nextDocument) {
      return { unchanged: true, documentId: discovery.value[0].documentId };
    }

    const fetched = await adapter.fetchSnapshot(nextDocument);
    if (fetched.kind !== 'found') throw new ResearchSourceError(fetched.code, fetched.message);

    const snapshot = fetched.value;
    const documentHash = createHash(snapshot.rawBytes);
    let extracted;
    try {
      extracted = await extractDocument(snapshot, {
        visionTranscriber: this.visionTranscriber,
        instructionClassifier: this.instructionClassifier,
      });
    } catch (error) {
      if (error instanceof ResearchSourceError) {
        throw new ResearchSourceError(error.code, error.message, { snapshot, documentHash });
      }
      throw error;
    }
    const canonicalTextHash = createHash(extracted.canonicalText);
    const candidates = candidateOverrides ?? (
      evidenceClass === 'official'
        ? extractDeterministicCandidates(extracted, assumption, ticker)
        : extractSecondaryCandidates(extracted, assumption, ticker, evidenceClass === 'secondary_issuer' ? 'issuer' : 'news', 3, identity)
    );
    const verifiedEvidence: VerifiedEvidence[] = [];

    for (const candidate of candidates) {
      try {
        const verificationStatus = candidate.verificationStatus;
        if (verificationStatus === 'exact_verified') {
          verifyExactMatch(candidate.quote, extracted.canonicalText);
          if (candidate.pageNumber !== null) verifyPageExactMatch(candidate.quote, extracted.pages, candidate.pageNumber);
        } else if (verificationStatus === 'ocr_matched') {
          verifyExactMatch(candidate.quote, candidate.ocrText);
        } else if (verificationStatus === 'derived') {
          // Confirmed pre-existing bug (M007 Slice 4): this branch used to be
          // an unconditional `else`, so it also ran for secondary_issuer/
          // secondary_news candidates — which have no metadata.method and
          // would always throw here, silently discarding every secondary
          // candidate through the catch below. Narrowed to 'derived' only.
          if (!candidate.metadata?.method || candidate.metadata.inputs === undefined) {
            throw new Error('Derived evidence is missing deterministic derivation metadata.');
          }
        } else {
          // secondary_issuer / secondary_news (M007): the quote must still
          // appear verbatim in the retained document text — proves it wasn't
          // hallucinated — but this NEVER sets canonicalTextHash below and
          // NEVER promotes verificationStatus; that distinction is reserved
          // for exact_verified alone (R-017/R-010).
          verifyExactMatch(candidate.quote, extracted.canonicalText);
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
          // R-018: the flag rides in the existing `metadata` JSON column, so no
          // schema migration is needed. It is recorded on every evidence class,
          // not just the vision path — any source document can carry an
          // embedded instruction.
          metadata: {
            ...(verificationStatus === 'exact_verified'
              ? { parserVersion: extracted.parserVersion }
              : candidate.metadata ?? {}),
            untrustedInstructionFlagged: extracted.untrustedInstructionFlagged,
          },
        });
      } catch {
        // Rejected candidates remain diagnostic artifacts and never become Evidence.
      }
    }

    return { snapshot, documentHash, evidence: verifiedEvidence };
  }
}
