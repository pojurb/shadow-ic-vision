# Milestone Roadmap: M005 → M006 → M007

This note sequences the three deferred areas named in `ACTIVE_MILESTONE.md`'s
"Remaining Boundaries" after Milestone 4. Per R-005 ("V1 becomes one
oversized milestone"), these are scoped as three separate vertical milestones
rather than one bundled packet.

## Ordering Rationale

| Milestone | Area | Readiness | Why this position |
|---|---|---|---|
| M005 | OCR/vision provider eligibility | Highest — evaluator scaffolding already models `vision` capability flags (`scripts/eval-m001-provider.ts`) and `exact_verified`/`ocr_matched`/`derived` evidence classes (`scripts/eval-m001-multimodal.ts`) | Goes first: closes DEC-0008's deferred multimodal requirement with the least new scaffolding, and its outcome (which provider/model, if any) determines what M006 needs to cover |
| M006 | Production confidential-data provider approval | Medium — DEC-0009's "Provider Approval Requirements" (lines 85-104) is already a concrete checklist for the currently-used Ollama Cloud provider | Goes second: sequencing after M005 avoids running the vendor-terms checklist twice (once for text-only, again after an OCR/vision provider is added) |
| M007 | Secondary-source/general-news ingestion | Lowest — no ADR or evaluator scaffolding exists yet; two open risks (R-010, R-013) | Goes last: needs its own upstream product decision (source allowlist, trust/licensing rules) before a packet can even be drafted |

## M005: OCR/Vision Provider Eligibility

Status: `complete` — packet accepted at
[`M005-ocr-vision-provider-eligibility.md`](M005-ocr-vision-provider-eligibility.md).

Ran a real OCR/vision provider through the existing multimodal evaluator
harness (extended with real image-attachment support) and recorded an
eligibility decision, following the same pattern DEC-0010 used for the
text-only Kimi provider eval. The primary candidate, `gemini-3-flash-preview`,
was found retired by the provider mid-eval ([`DEC-0013`](../decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
removed it from the allowlist); the fallback, `minimax-m3:cloud`, passed
cleanly and is accepted via [`DEC-0012`](../decisions/DEC-0012-ocr-vision-provider-eligibility.md).
Addressed R-017 (OCR/derived output mistaken for source-exact), R-018
(embedded document injection), and R-019 (multimodal scope creep).

## M006: Production Confidential-Data Provider Approval

Status: not yet scoped as a packet.

Complete DEC-0009's "Provider Approval Requirements" checklist for every
provider in active use after M005 (Ollama Cloud, and any OCR/vision provider
approved there): record retention, deletion, training-use, logging,
subprocessor, and region terms verified from current primary sources, not
marketing claims. This is largely a vendor-terms verification and
decision-record task rather than new application code. Addresses R-003
(confidential data to an unapproved model) and R-020 (POC approval mistaken
for production approval).

## M007: Secondary-Source/General-News Ingestion

Status: not yet scoped as a packet.

Needs a preceding product-scoping decision on which secondary sources are
admissible and what trust/licensing rules apply before implementation
scoping can start — no existing ADR or evaluator scaffolding covers this
area. Addresses R-010 (secondary evidence mistaken for official fact) and
R-013 (search snippets treated as evidence).
