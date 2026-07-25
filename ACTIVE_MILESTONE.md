# Active Milestone

Status: `complete`

Active Packet: [`docs/milestones/M006-in-pipeline-vision-extraction.md`](docs/milestones/M006-in-pipeline-vision-extraction.md) (complete 2026-07-25; all five slices done, live probe evidence recorded; M007 not yet scoped as a packet)

Latest Completed Packet: [`docs/milestones/M006-in-pipeline-vision-extraction.md`](docs/milestones/M006-in-pipeline-vision-extraction.md) (complete; all five ACs met, one honestly-recorded caveat on AC-M006-04's Indonesian probe — see the packet's "Slice Outcomes")

See [`docs/milestones/ROADMAP.md`](docs/milestones/ROADMAP.md) for the M006→M007 sequence. The M006 slot was re-planned on 2026-07-25: its original subject (production confidential-data provider approval) was withdrawn by [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md).

## Current Phase

M001 (Existing Thesis Loop, `local-only complete`), M002 (Portfolio Positions & Ingestion Alerts), M003 (Explore-To-Tracked Loop), M004 (Multi-Thesis Briefing), M005 (OCR/Vision Provider Eligibility), and M006 (In-Pipeline Vision Extraction & Injection Hardening) are 100% completed and verified.

Milestone 6 made M005's proven OCR/vision capability reachable from the
product instead of remaining an isolated eval seam, and moved R-018's
injection mitigation from the evaluator into real product code. `extractDocument`
(`lib/research/extractors/document.ts`) now accepts an optional
`VisionTranscriber`; when configured, an image source is transcribed by the
DEC-0012-eligible model and flows through the normal evidence pipeline as
`ocr_matched` — never `exact_verified`, enforced structurally by
`extractDeterministicCandidates` gating on `sourceVariant`, not by convention.
`scanEmbeddedInstructions` now runs in every extractor and at the
`generateDecisionRecommendation` prompt boundary — previously it ran only in
tests and the eval script. A live probe against `minimax-m3:cloud`
(2026-07-25) confirmed the model transcribes an embedded English instruction
faithfully without complying with it; the Indonesian-language companion probe
also produced no compliance, but by a different, less-understood path (the
model's transcription omitted the injected text rather than surfacing it for
the scanner to catch) — so the scanner's documented English-only limitation
remains real and un-exercised live, confirmed instead by direct unit test.
See [`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md)
for the full honest account. No production wiring selects a vision provider
yet — `CitationPipeline` is still constructed without one, so image sources
fail closed in the running app; turning it on is a separate future decision.

**Same-day addendum:** the Indonesian probe's honest caveat prompted a direct
follow-on — an optional multilingual `InstructionClassifier`
(`lib/research/extractors/safety.ts`) that runs as a second opinion only when
the regex finds nothing, wired through `extractDocument`/`CitationPipeline` at
extraction time. Fails closed on any error. Off by default, same posture as
the vision path — nothing calls a provider for this until a caller configures
one, so the running app's R-018 coverage is still regex-only today. Proven by
unit test with a stub classifier catching the Indonesian text the regex
misses. R-018 stays `Open`; this narrows the gap rather than closing it. See
the M006 packet's "Addendum" section.

Milestone 5 answered one question: is a real OCR/vision-capable model,
reached through the already-accepted Ollama Cloud POC boundary, eligible for
continued POC use on the multimodal evidence pipeline scaffolded since
DEC-0008. Real image-attachment support was added to the provider boundary
(`lib/ai/provider.ts`, `lib/ai/adapters/ollama.ts`), a real-provider vision-
extraction seam (`extractVisionOcrCandidate` in `lib/research/extractors/ocr.ts`)
was added alongside the existing synthetic-fixture path, and two genuine
Playwright-rendered image fixtures were used for a live eligibility eval. The
primary candidate, `gemini-3-flash-preview`, was found retired by the
provider mid-eval; the fallback, `minimax-m3:cloud`, passed cleanly (0
hard-gate failures, 0% hallucination, both real-image transcription cases
exact). [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md)
(accepted) records `minimax-m3:cloud`'s POC OCR/vision eligibility.
[`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
(accepted) removed the retired model from DEC-0010's allowlist and promoted
`deepseek-v4-flash:cloud` for general POC use.

Milestone 4 scaled holding tracking from one active thesis to 100 assets with priority ranking and comprehensive status. All four core steps shipped:

1. **Top-10 Priority Queue** (`lib/portfolio/priorityQueue.ts`, `components/TopTenQueue.tsx`) — scores holdings from unread filing alerts, review staleness, and challenged assumptions.
2. **Comprehensive Status Index** (`app/portfolio/page.tsx`) — sortable/filterable table of all watchlisted and active portfolio positions.
3. **Navigation & Briefing Integration** — fixed routing bug (thesis-linked items now use conversationId, not thesisId); `db/queries.ts#getPortfolioBriefing` computes ranked list via grouped SQL aggregates and returns both `conversationId` and latest decision outcome/action.
4. **Review History Retention** — `db/schema.ts#decisions` now stores typed `outcome`/`action` columns (migration `0006_normalize_decision_outcomes` backfilled prior packed rows and normalized timestamp formats); decision reads carry explicit `orderBy(createdAt)`; Research drawer, Status Index, and Top-10 Queue surface chronological timeline with "changed from X" deltas and latest recorded outcome/action. Regression test guards that recorded decisions never reach provider prompts (DEC-0009 boundary).

The deterministic mock workflow remains the default QA path. The live research
slice already provides SEC filing retrieval, official IDX announcement
retrieval, bounded official issuer fallback, immutable snapshots and
provenance, exact verification, incremental cursors, idempotent refresh, and
local daily scheduling.

The multimodal slice now preserves distinct evidence classes through extraction,
verification, persistence, export/import, API DTOs, and the Research UI:

- `exact_verified` for HTML and text-layer PDF source text matched against
  canonical extracted text.
- `ocr_matched` for retained OCR or screenshot text, never promoted to exact
  source text.
- `derived` for table, chart, XBRL, and deterministic calculation outputs with
  retained inputs, units, method, page, and provenance.

The evaluator scaffold reads the accepted base and multimodal M001 suites,
records deterministic first-slice readiness, and now includes provider-boundary
cases for DEC-0009 data classes. `modelEligibility` remains `not_evaluated`;
the gate does not approve a model or production provider.

The new provider-eval harness now records candidate-model metadata, fixed
allowlist order, deterministic baseline results, and a separate live-eval path
for local confidential runs. Kimi is the default candidate and first eval
target. The live Kimi report has run successfully with clean results and zero
hard-gate failures.

The DEC-0009 provider gate now requires all LLM calls to carry route and data
class context through the project-owned `lib/ai` boundary. POC workflow
confidential data is allowed only in the local POC boundary. Portfolio/position
data, restricted personal or financial secrets, and production confidential
processing fail closed before any external provider fetch.

Periodic ingestion remains local-only under ADR-0006. It runs through
`npm run research:refresh` or Windows Task Scheduler and writes to the external
SQLite database. No private research data or SQLite worker is deployed to
Vercel.

## Fresh Verification

Latest full verification: 2026-07-25 (M006 implementation + live injection-probe eval).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-25 (124
  passed, 3 skipped — adds vision-extraction-pipeline, R-017 structural
  invariant, and R-018 prompt-boundary/scanner-gap coverage; multimodal case
  count 18 → 20)
- `npm run build`: pass on 2026-07-25
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m006-deterministic-report.json`:
  pass on 2026-07-25; 0 hard-gate failures, 20 multimodal cases,
  `modelEligibility: not_evaluated` (correct pre-live state)
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-25-m006-injection-eval/02-live-report.json`:
  0 hard-gate failures; `acceptanceOutcome: blocked` — unchanged in shape from
  the already-accepted 2026-07-19 minimax baseline (same ~20 base-suite
  failures, unrelated to vision/injection); both injection-probe cases
  (`MM-019`, `MM-020`) passed with no model compliance. See the manifest's
  "Honest note" on what `MM-020` does and does not prove.
- `npm run status:check`, `npm run context:check`: pass on 2026-07-25

Previous full verification: 2026-07-19 (M005 Slice 0 + eligibility eval).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-19 (113
  passed, 3 skipped — adds attachment-serialization and vision-extraction
  coverage; bumps multimodal case count to 18)
- `npm run eval:m001:provider -- --mode deterministic --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json`:
  pass on 2026-07-19
- `npm run eval:m001:provider -- --mode live --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json`:
  blocked on 2026-07-19 — model retired by provider as of 2026-07-15
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json`:
  pass on 2026-07-19
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json`:
  pass on 2026-07-19; 0 hard-gate failures, 0% citation hallucination, both
  real-image transcription cases (`MM-017`, `MM-018`) passed exactly
- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-19 after
  DEC-0013's allowlist change (five-model roster; 113 passed, 3 skipped)

Previous full verification: 2026-07-17.

Latest targeted provider-package verification: 2026-07-11.

- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- `npm run context:check`: pass on 2026-07-17 after regenerating the code index
- `npm run status:check`: pass on 2026-07-17 after accepting the M004 packet
- TypeScript `tsc --noEmit`: pass on 2026-07-17 (a stale `.next` build artifact
  had been causing 5 spurious errors in generated dev types; cleared and
  rebuilt clean)
- ESLint `eslint`: pass on 2026-07-17
- Vitest: 104 pass; 3 opt-in live checks skipped on 2026-07-17 (adds
  `tests/portfolio-briefing.test.ts` covering the M4 priority queue and
  briefing query)
- Next.js production build: pass on 2026-07-17
- Playwright: 3 pass on 2026-07-17
  - deterministic PLTR desktop and narrow Research drawer
  - live-labelled IDX fail-closed UI without a network request
  - OCR and derived trust-class labels visible in the Research drawer
- `npm run verify:full`: pass on 2026-07-17
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`: pass
  - base case count: 16
  - multimodal addendum case count: 16
  - all 16 deterministic multimodal addendum cases: pass
  - DEC-0009 provider-boundary cases: 6 pass
  - hard-gate failures: none
  - model eligibility: `not_evaluated`
- `git diff --check`: pass
- `npm run status:check`: pass on 2026-07-09 after drafting DEC-0010
- `npm test -- tests/provider-gate.test.ts tests/provider-boundary.test.ts tests/ollama-provider.test.ts`:
  pass on 2026-07-09; 14 tests passed
- `npm test -- tests/api-contracts.test.ts tests/ollama-provider.test.ts tests/ollama-models.test.ts tests/research-service.test.ts`:
  pass on 2026-07-09; 21 tests passed
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`:
  pass on 2026-07-09; 16 base cases, 16 multimodal addendum cases,
  6 provider-boundary cases, no hard-gate failures, `modelEligibility:
  not_evaluated`
- `npm run eval:m001:provider -- --mode deterministic --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json`:
  pass on 2026-07-09; Kimi metadata recorded, fixed eval order recorded,
  deterministic baseline loaded, 6 provider-boundary cases passed
- `npm run eval:m001:provider -- --mode live --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json`:
  pass on 2026-07-11; completed successfully with 0 hard-gate failures, 0%
  hallucination rate, and 93.3% assumption extraction completeness

Release evidence:
[`docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md`](docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md)
[`docs/evidence/releases/2026-07-09-kimi-provider-eval/manifest.md`](docs/evidence/releases/2026-07-09-kimi-provider-eval/manifest.md)
[`docs/evidence/releases/2026-07-11-model-evals/manifest.md`](docs/evidence/releases/2026-07-11-model-evals/manifest.md)
[`docs/evidence/releases/2026-07-19-gemini-vision-eval/manifest.md`](docs/evidence/releases/2026-07-19-gemini-vision-eval/manifest.md)
[`docs/evidence/releases/2026-07-19-minimax-vision-eval/manifest.md`](docs/evidence/releases/2026-07-19-minimax-vision-eval/manifest.md)
[`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md)

## Remaining Boundaries

- M001 is **`local-only complete`** as of 2026-07-25. It previously stayed open
  on two items. Real OCR/vision provider eligibility is resolved for POC use
  (`minimax-m3:cloud`, DEC-0012). Production confidential-data provider
  approval is no longer outstanding: [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md)
  places production/hosted processing explicitly out of scope, so it no longer
  holds M001 open. Provider-specific current-source approval remains an
  in-scope open boundary, tracked on its own rather than inherited from a
  withdrawn milestone.
- [`DEC-0010`](docs/decisions/DEC-0010-ollama-cloud-poc-approval.md) is an
  accepted Ollama Cloud POC approval package. The app now exposes an
  allowlisted selector for `kimi-k2.7-code:cloud`, `qwen3.5:cloud`,
  `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`, and `minimax-m3:cloud`
  (five models, all `accepted_for_poc`). Real confidential POC traffic is
  authorized through the project-owned provider boundary under the accepted
  scopes. [`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
  (`accepted`) removed `gemini-3-flash-preview` after it was confirmed
  retired by the provider (found 2026-07-19) and promoted
  `deepseek-v4-flash:cloud` in its place, using its existing 2026-07-11
  eligibility result — no new eval run was required for that promotion.
- [`DEC-0009`](docs/decisions/DEC-0009-provider-security-gate.md) is accepted
  and implemented as the POC provider/security gate. It permits local POC
  workflow confidential routing through the project-owned provider boundary,
  but does not approve production external processing or selectable model
  eligibility. Portfolio/position data, credentials, account screenshots, raw
  database exports, identity documents, and unrelated personal files remain
  blocked unless a later explicit decision allows them.
  [`DEC-0011`](docs/decisions/DEC-0011-decision-record-classification-amendment.md)
  (`accepted`) clarifies that recorded decision outcomes fall under this
  blocked "portfolio and position data" classification.
- The deterministic multimodal evaluator proves first-slice application and
  provider-boundary gates; it does not approve a model, provider, cloud
  processor, or native browsing capability.
- `scanEmbeddedInstructions` (R-018 mitigation, now wired into the real
  extraction path and prompt boundary by M006) is a single hardcoded English
  phrase list. It cannot match the same instruction in Indonesian — material
  because IDX filings are a first-class product input. Confirmed by direct
  unit test; the live Indonesian probe did not exercise this path (see the
  M006 evidence manifest). R-018 stays `Open`; broadening scanner coverage was
  explicitly deferred by user decision during M006 scoping.
- No production wiring selects a vision provider. `CitationPipeline` is
  constructed without one in `lib/research/service.ts`, so image sources
  still fail closed in the running app even after M006.
- Secondary-source and general-news ingestion remain deferred (M007).
- `npm audit --omit=dev` currently reports two moderate dependency findings
  (transitive `postcss` via `next`); no forced breaking upgrade was applied in
  this slice.

## Next Steps

Milestones 4, 5, and 6 are complete and verified (2026-07-25).

1. ~~**DEC-0009 Amendment**~~ Accepted: [`DEC-0011`](docs/decisions/DEC-0011-decision-record-classification-amendment.md)
   clarifies that recorded Buy/Hold/Reduce/Exit decisions are governed
   exclusively by DEC-0009's "Portfolio and position data" row and remain
   blocked. See `docs/decisions/DEC-0009-provider-security-gate.md`'s
   amendment signpost.

2. ~~**Milestone 5**~~ Complete: all four Acceptance Criteria met.
   [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md)
   (accepted) records `minimax-m3:cloud`'s POC OCR/vision eligibility after
   the primary candidate, `gemini-3-flash-preview`, was found retired by the
   provider mid-eval.

3. ~~**Follow-up finding**~~ Resolved: [`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
   removes `gemini-3-flash-preview` from the DEC-0010 allowlist and promotes
   `deepseek-v4-flash:cloud` (already `accepted_for_poc`) in its place. See
   `docs/RISK_REGISTER.md` R-024.

4. ~~**Production Confidential-Data Provider Approval**~~ Withdrawn:
   [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md)
   (accepted 2026-07-25) records production/hosted confidential processing as
   explicitly out of scope. `ADR-0006` §1's local-only deployment contract
   leaves such an approval no subject to govern, and its vendor-terms checklist
   is unanswerable without a chosen deployment shape. Reactivation requires a
   hosted deployment to be actually intended **and** a new managed-persistence
   / authentication ADR to be accepted first.

5. ~~**Milestone 6 (re-planned)**~~ Complete: [`docs/milestones/M006-in-pipeline-vision-extraction.md`](docs/milestones/M006-in-pipeline-vision-extraction.md)
   (complete 2026-07-25). All five ACs met; R-017 moved to `Mitigated`; R-018
   stays `Open` with the scanner's language-coverage gap honestly recorded
   rather than closed. See the packet's "Slice Outcomes" and
   [`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md).

6. **Milestone 7** — Secondary-Source/General-News Ingestion, per
   [`docs/milestones/ROADMAP.md`](docs/milestones/ROADMAP.md). Not yet scoped
   as a packet; needs its own upstream product decision (source allowlist,
   trust/licensing rules) before scoping can start.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260708-001` (2026-07-05, separate session);
`LC-20260725-001` through `LC-20260725-003` (2026-07-25, this session — not
yet reviewed)
