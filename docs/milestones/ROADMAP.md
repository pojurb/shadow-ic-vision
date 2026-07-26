# Milestone Roadmap: M005 → M006 → M007 → M008 → M009

This note sequences the deferred areas named in `ACTIVE_MILESTONE.md`'s
"Remaining Boundaries" after Milestone 4. Per R-005 ("V1 becomes one
oversized milestone"), these are scoped as separate vertical milestones
rather than one bundled packet.

**Re-planned 2026-07-25.** The M006 slot originally held "Production
Confidential-Data Provider Approval." Scoping it surfaced a blocking
dependency: `ADR-0006` §1 binds the app to a local-only deployment contract and
requires a *new ADR* covering managed persistence and authentication before any
hosted deployment exists. A production provider approval therefore had no
subject to govern, and its checklist (retention, region, subprocessors) is not
answerable without a chosen deployment shape.
[`DEC-0014`](../decisions/DEC-0014-local-only-scope-reaffirmation.md) withdrew
that subject and reaffirmed local-only scope; the M006 slot is re-planned to
the work below. See DEC-0014's "Reactivation Path" for what would revive the
withdrawn subject.

## Ordering Rationale

| Milestone | Area | Readiness | Why this position |
|---|---|---|---|
| M005 | OCR/vision provider eligibility | Highest — evaluator scaffolding already models `vision` capability flags (`scripts/eval-m001-provider.ts`) and `exact_verified`/`ocr_matched`/`derived` evidence classes (`scripts/eval-m001-multimodal.ts`) | Went first: closed DEC-0008's deferred multimodal requirement with the least new scaffolding, and established which model (`minimax-m3:cloud`) later work can use |
| M006 | In-pipeline vision extraction & injection hardening | High — the provider seam, eligible model, and eval harness all exist from M005; the gap is wiring, not capability | Goes next: M005 proved a capability the product cannot reach, and opening that path requires R-018 enforcement to exist in product code rather than only in the evaluator. Two `Open`/Critical risks (R-017, R-018) are in scope |
| M007 | Secondary-source/general-news ingestion | Lowest — no ADR or evaluator scaffolding exists yet; two open risks (R-010, R-013) | Went last of the three original candidates: needed its own upstream product decision (source allowlist, trust/licensing rules) before a packet could even be drafted (`DEC-0015`) |
| M008 | Web search discovery (Class C) | Not scoped — no search-provider integration exists; `discoveryCandidates` table exists but is inert | Deliberately deferred out of M007 per R-005: Class A/B already deliver full secondary-source functionality without a search-API dependency, and Class C's cost (provider keys/quota, a separate promotion workflow, new UI) is disproportionate to its narrow incremental value. R-013 stays `Open` until this ships |
| — | Production confidential-data provider approval | Withdrawn | Deferred out of scope by `DEC-0014`; blocked on a hosted-deployment ADR that does not exist and is not currently intended |

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

## M006: In-Pipeline Vision Extraction & Injection Hardening

Status: `complete` (2026-07-25) — packet at
[`M006-in-pipeline-vision-extraction.md`](M006-in-pipeline-vision-extraction.md).

Makes M005's proven OCR/vision capability reachable from the product, and
moves R-018's mitigation out of the evaluator into the extraction path.

Two findings drive it. First, `extractVisionOcrCandidate` is built, tested, and
eval-backed but is called by nothing in `lib/research/` — `extractDocument`
still throws `unsupported_visual` for every image source. Second,
`scanEmbeddedInstructions` is referenced only by `tests/multimodal-helpers.test.ts`
and `scripts/eval-m001-multimodal.ts`; the production extraction path performs
no injection scanning at all. Opening a vision path without closing that gap
would route attacker-controllable image text into the pipeline unscanned, so
the two ship together.

Scanned-PDF rasterization is explicitly out of scope (needs a new native
rasterization dependency). Addresses R-017 and R-018.

## Withdrawn: Production Confidential-Data Provider Approval

Status: withdrawn by
[`DEC-0014`](../decisions/DEC-0014-local-only-scope-reaffirmation.md)
(2026-07-25).

Originally planned as M006: complete DEC-0009's "Provider Approval
Requirements" checklist (retention, deletion, training-use, logging,
subprocessor, region terms) from current primary vendor sources, addressing
R-003's production leg and R-020.

Withdrawn — not completed, and not rejected on the merits. `ADR-0006` §1's
local-only deployment contract means there is no production deployment for such
an approval to govern, and no accepted ADR that would create one. The checklist
also depends on a concrete deployment shape (host, managed persistence, auth
boundary) that has not been chosen. DEC-0014 records production confidential
processing as explicitly out of scope and defines the Reactivation Path: a
hosted deployment must actually be intended *and* a new managed-persistence /
authentication ADR accepted, after which a production provider decision should
be drafted fresh.

## M007: Secondary-Source/General-News Ingestion

Status: `complete` (2026-07-25) — packet at [`M007-secondary-source-ingestion.md`](M007-secondary-source-ingestion.md). Product-scoping decision accepted at [`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md) (2026-07-25).

Shipped Class A (issuer press releases) and Class B (curated financial news
wires) with structural `secondary_issuer`/`secondary_news` trust classes
that can never be promoted to `exact_verified`/`ocr_matched`, and the
`pending_confirmation`/`user_confirmed_secondary` assumption gate. R-010
moved to `Mitigated`. Class C (web search discovery) was deliberately
deferred in full — no search-provider code exists — so R-013 stays `Open`;
see the packet's "Slice Outcomes" and `docs/RISK_REGISTER.md`.

## M008: Web Search Discovery (Class C)

Status: `complete` (2026-07-26) — packet at
[`M008-web-search-discovery.md`](M008-web-search-discovery.md), governed by
the already-accepted [`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md).

Deliberately deferred out of M007 (see that packet's "Options Considered").
Provider selection was evaluated with real live data ahead of drafting (12
live runs against Tavily, a rejected Google News RSS candidate with a
documented technical reason, an untested Serper fallback) rather than chosen
by reputation. Shipped search-provider discovery producing `discoveryCandidates`
rows (pre-fetch candidate URLs, structurally excluding snippet/title text —
proven adversarially) and a mandatory fetch-and-classify promotion step,
domain-gated per DEC-0015 §3.2, before anything can become evidence — the
schema existed since M007 Slice 1 but was inert until this milestone
populated and consumed it. Promotion runs automatically inside
`processResearchJobs`, plus an explicit `npm run research:promote-discoveries`
CLI for re-evaluating candidates after `.env` allowlist changes. A real
review-time gap (Tavily's outbound calls weren't logged to
`logs/outbound.log`, unlike every other external call in this codebase) was
found and fixed before shipping, not left as a known issue. Addresses R-013
(search snippets treated as evidence), moved to `Mitigated` — the mechanism
is proven structurally and by test (`docs/RISK_REGISTER.md`).
Load-bearing caveat recorded honestly in the packet and the risk register:
`ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS` remain unconfigured in the
live environment, so the domain gate promotes zero candidates today
regardless of discovery quality — a bootstrapping gap, not a defect, and not
yet exercised end-to-end outside test fixtures.

**Update, 2026-07-26 (later same day):** the bootstrapping gap above is
closed — the allowlists were populated and a real TLKM thesis was run
end-to-end for the first time. Promotion worked exactly as designed (2 of 10
Tavily candidates matched and were promoted). That run surfaced a new,
previously-untested problem, scoped as M009 below.

## M009: Secondary Evidence Boilerplate Filtering

Status: `proposed` (2026-07-26) — packet at
[`M009-secondary-evidence-boilerplate-filtering.md`](M009-secondary-evidence-boilerplate-filtering.md).
No new decision record required; governed by the already-accepted
[`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md).

Found during M008's first live run (2026-07-26, real TLKM thesis): several
of the 15 `secondary_issuer` evidence rows persisted were site-wide
boilerplate — cookie/privacy policy text, an unrelated CSR press release,
and a repeated nav-menu paragraph reused verbatim as "evidence" for three
different assumptions. Root cause: `rankSentenceCandidates`'s token-overlap
threshold (`lib/research/extractors/candidate.ts`) was tuned for dense,
boilerplate-free official filings (M001–M006) and reused unchanged when
M007/M008 opened raw web HTML into the same path; `extractHtml`
(`lib/research/extractors/document.ts`) strips `script/style/noscript/
template/svg` but not `nav/header/footer/aside`. R-010's structural
trust-tier gate still holds — nothing was mislabeled `exact_verified`/
`ocr_matched` — this is a precision problem within the correctly-tiered
`secondary_issuer` class, not a classification failure. Addresses newly
opened R-025. Not yet accepted or implemented — awaiting review.


