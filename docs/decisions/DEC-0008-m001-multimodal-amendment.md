# DEC-0008 - Expand M001 With Governed Multimodal Research

Status: `accepted`

Date proposed: 2026-07-03

Date accepted: 2026-07-03

Approving authority: user

## Context

The accepted M001 packet and the evaluation baseline approved by DEC-0005
cover conversational thesis intake, text research, exact citation checks,
provider failures, safety boundaries, and persistence. They do not define how
the product handles text PDFs, scanned documents, screenshots, tables, charts,
OCR output, or structured XBRL facts.

M001 must research both US and Indonesian public companies. Relevant IDX
disclosures are often distributed as PDFs, and material evidence may appear in
tables, charts, scans, or screenshots. Treating those formats as ordinary text
would blur the distinction between exact source text, OCR output, and model
interpretation. That would violate the product's evidence and uncertainty
promises.

This amendment adds a capability contract before any product model is selected.
It preserves the original 16 cases in `docs/evals/M001/cases.json` and adds a
separate proposed multimodal evaluation package.

## Decision Requested

Expand M001 to require governed multimodal research with the following
ownership boundary.

| Capability | Owner | M001 requirement |
|---|---|---|
| SEC/IDX search and crawling | Application source adapters | Required |
| Restricted general-web discovery | Application discovery adapter | Required fallback |
| HTML extraction | Deterministic parser | Required |
| Text PDF extraction | PDF parser | Required |
| Scanned PDF and image OCR | OCR pipeline | Required |
| Screenshots, tables, and charts | Vision model plus application validation | Required |
| XBRL facts and financial calculations | Deterministic tools | Required where available |
| Citation exact matching | Deterministic verifier | Required |
| Freshness, date, and source-tier checks | Application | Required |
| Conversation history and model-run provenance | Application database | Required |
| Thesis reasoning and challenges | Model | Required |
| Evidence interpretation | Model | Required |
| Investment decision | User | Always |

The model may not independently crawl arbitrary sites, treat search snippets as
evidence, calculate material financial values without deterministic
verification, bypass source adapters, or promote its own visual interpretation
to verified evidence.

## Required Model Capability Contract

Every model exposed for product use must pass the approved M001 baseline and
multimodal addendum and demonstrate:

- English and Bahasa Indonesia understanding;
- persistent multi-turn conversational coherence;
- thesis and assumption decomposition;
- focused clarification and intellectual challenge;
- structured JSON output that passes external schema validation;
- vision input for scans, screenshots, tables, and charts;
- evidence-grounded summaries that do not alter quoted text;
- contradictory-source detection and official-source priority;
- explicit uncertainty, missing-data, and stale-source reporting;
- prompt-injection resistance across user and document content;
- refusal of buy, hold, sell, execution, or autonomous-portfolio advice;
- at least a 128K context window, with application-side chunking for larger
  documents;
- streaming responses; and
- reproducible provider, model, prompt, settings, latency, and outcome
  metadata.

Tool calling and context above 128K are preferred but are not M001 hard
requirements because the application, not the model, orchestrates research.

## Multimodal Evidence Contract

Evidence records gain the following fields in addition to the accepted M001
schema:

- `source_format`: `html` | `pdf` | `image` | `xbrl`;
- `content_kind`: `text` | `table` | `chart` | `screenshot` |
  `structured_fact`;
- `source_variant`: optional format detail such as `text_layer`, `scanned`,
  `encrypted`, `corrupt`, or `unsupported`;
- `extraction_method`: `html_parser` | `pdf_text` | `ocr` | `vision` |
  `table_parser` | `xbrl_parser` | `deterministic_calculation`;
- `verification_status`: `exact_verified` | `ocr_matched` | `derived`;
- `document_hash`: SHA-256 of the immutable raw source bytes;
- `canonical_text_hash`: SHA-256 of canonical extracted text when exact-text
  verification applies;
- `page_number`: one-based page number when the source is paginated;
- `bounding_box`: optional `[x_min, y_min, x_max, y_max]` coordinates normalized
  to `0..1` from the page's top-left origin;
- `parser_version`, `ocr_version`, and model metadata when applicable; and
- `source_url` and retrieval timestamp.

Rules:

1. Only HTML and text-layer PDF strings that match canonical extracted text may
   be labelled `exact_verified`.
2. OCR-derived strings may be labelled only `ocr_matched`; they are not
   source-exact facts.
3. Chart interpretations, table normalization, XBRL transformations, and
   calculations are labelled `derived` and retain their inputs and method.
4. Unverified output is blocked from the Evidence table and retained only as a
   diagnostic research artifact.
5. Corrupt, encrypted, unreadable, oversized, or unsupported content produces
   a visible degraded state rather than a silent omission.
6. Model vision output never becomes evidence without the applicable
   deterministic or human validation step.

## Added Acceptance Criteria

- **AC-M001-MM-01 - Document ingestion and provenance:** HTML, text PDFs,
  scans, images, tables, charts, and XBRL retain source hash, retrieval time,
  extraction method, and page-level provenance.
- **AC-M001-MM-02 - Verification-class integrity:** Exact text, OCR text, and
  derived values cannot be confused or promoted across verification classes.
- **AC-M001-MM-03 - Multimodal degraded states:** Corrupt, encrypted,
  unsupported, or unreadable content is visible and recoverable.
- **AC-M001-MM-04 - Document safety:** Instructions embedded in documents or
  images cannot override product policy or trigger investment advice.
- **AC-M001-MM-05 - Large-document handling:** Chunking preserves document,
  page, and section provenance and does not invent missing context.
- **AC-M001-MM-06 - Model eligibility:** A selectable model passes both the
  original 16 cases and every applicable multimodal hard gate.

## Options Considered

1. Keep M001 text-only and accept reduced IDX coverage.
2. Support text-layer PDFs but degrade all scans and images.
3. Add governed full-multimodal handling with distinct evidence classes
   (selected proposal).

## Consequences If Accepted

- DEC-0005 remains the accepted baseline for its original 16 cases.
- `docs/evals/M001/multimodal-cases.json` and
  `MULTIMODAL_EVAL_GUIDE.md` become an additive Gate 4 contract.
- M001 architecture must include document classification, PDF extraction, OCR,
  vision validation, deterministic calculations, and provenance retention.
- Model selection is constrained by measured multilingual, vision, safety, and
  evidence behavior rather than provider reputation.
- M001 implementation, test cost, latency, and dependency review increase.
- Ollama Cloud remains unapproved for confidential data until a later provider
  decision is accepted.

## Approval And Gate Sequence

1. Review and explicitly accept this decision and its additive eval package.
2. Finalize ADR-0006 against the accepted capability contract.
3. Explicitly accept ADR-0006.
4. Begin implementation with deterministic mocks and synthetic fixtures.
5. Evaluate candidate models using public or synthetic data only.
6. Record a separate provider decision before confidential thesis data is sent
   to Ollama Cloud or another cloud processor.

Until steps 1-3 are complete, product implementation remains blocked.

## Reversal Or Supersession

If full multimodal support makes M001 too large or unreliable, supersede this
decision with either a text-PDF-only boundary or a new follow-up milestone.
Preserve the addendum cases and results as historical evidence, remove
multimodal requirements from the active pointer and ADR, and do not relabel
OCR- or vision-derived records as exact evidence.

## Affected Files

- `ACTIVE_MILESTONE.md`
- `README.md`
- `SESSION_CHECKPOINT.md`
- `docs/RISK_REGISTER.md`
- `docs/decisions/ADR-0006-m001-stack.md`
- `docs/evals/M001/multimodal-cases.json`
- `docs/evals/M001/MULTIMODAL_EVAL_GUIDE.md`
