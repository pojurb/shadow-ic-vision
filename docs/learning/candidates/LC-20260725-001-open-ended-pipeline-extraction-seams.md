# LC-20260725-001 - Open-Ended Pipeline Extraction Seams

Status: `promoted`

Captured: `2026-07-25`

Milestone: `M006`

Task type: `implementation`

Classification: `quality`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

During M006 research pipeline scoping, `extractVisionOcrCandidate` (`lib/research/extractors/ocr.ts`) was found to be implemented and tested, but never called by the pipeline in `lib/research/`. `extractDocument` continued to throw `unsupported_visual` for all image sources.

Detailed inspection revealed that `extractVisionOcrCandidate` evaluates and verifies a *known* `candidateQuote`. Because open-ended ingestion pipelines operate on un-queried source documents without a pre-existing quote to match, wiring `extractVisionOcrCandidate` directly into `extractDocument` was architecturally incorrect. The pipeline required a transcribe-first seam at `extractDocument`, preserving `extractVisionOcrCandidate` specifically as the quote verification seam.

## Evidence

- Commit, run, or evidence ID:
  - M006 packet planning & `SESSION_CHECKPOINT.md` (2026-07-25)
- Commands or checks:
  - Code inspection of `lib/research/extractors/ocr.ts`, `lib/research/extractors/index.ts`
- Exact result:
  - `extractVisionOcrCandidate` requires a target string parameter (`candidateQuote`).
  - Open-ended visual document ingestion has no `candidateQuote` prior to transcription.
- Related review finding or incident:
  - M006 extraction seam architectural review (2026-07-25)

## Proposed Reusable Lesson

When adding visual or multimodal capabilities to an ingestion pipeline, clearly separate **transcription-first seams** (open-ended document extraction) from **quote-verification seams** (targeted claim verification). Do not attempt to reuse quote-verifying helper functions in open-ended ingestion flows without providing the preceding transcription step.

## Scope And Risks

- Applies to:
  - Ingestion pipeline architectures with visual, OCR, or multimodal document sources.
- Does not apply to:
  - Targeted verification where a specific candidate quote is already asserted by a thesis or user assumption.
- Known failure modes:
  - Calling quote verification functions without a target quote leads to runtime type errors or forced dummy string parameters.
- Conflicting authority checked:
  - `AGENTS.md`
  - `docs/CODEBASE_MAP.md`

## Independent Review

- Reviewer: Antigravity (Gemini 3.6 Flash)
- Review date: 2026-07-26
- Evidence reproduced: `yes`
- Duplicate or conflict check: `clean`
- Privacy check: `clean`
- Disposition: `validated`
- Reason: M006 implementation verified transcribe-first seam in `extractDocument` via `VisionTranscriber` while preserving `extractVisionOcrCandidate` as the verification seam.

## Promotion Or Supersession

- Decision authority: user
- Decision date: 2026-07-26
- Promotion target: [.agents/QUALITY.md](../../.agents/QUALITY.md)
- Promotion registry entry: LC-20260725-001
- Supersedes: none
- Superseded by: none
- Rollback path: Remove section from `.agents/QUALITY.md` and mark entry superseded.
