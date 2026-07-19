# Active Milestone

Status: `in_progress`

Active Packet: [`docs/milestones/M005-ocr-vision-provider-eligibility.md`](docs/milestones/M005-ocr-vision-provider-eligibility.md) (accepted; live eval complete, eligibility decision [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md) `proposed` pending user acceptance)

Latest Completed Packet: [`docs/milestones/M004-multi-thesis-briefing.md`](docs/milestones/M004-multi-thesis-briefing.md) (accepted)

See [`docs/milestones/ROADMAP.md`](docs/milestones/ROADMAP.md) for the full M005→M006→M007 sequence.

## Current Phase

M001 (Existing Thesis Loop), M002 (Portfolio Positions & Ingestion Alerts), M003 (Explore-To-Tracked Loop), and M004 (Multi-Thesis Briefing) are 100% completed, verified, and merged.

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

Latest full verification: 2026-07-19 (M005 Slice 0 + eligibility eval).

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

## Remaining Boundaries

- M001 is not fully closed because real OCR/vision provider eligibility
  (evaluated, pending acceptance — see DEC-0012), provider-specific
  current-source approval, and production confidential-data provider approval
  remain unapproved.
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
- Secondary-source and general-news ingestion remain deferred.
- `npm audit --omit=dev` currently reports two moderate dependency findings
  (transitive `postcss` via `next`); no forced breaking upgrade was applied in
  this slice.

## Next Steps

Milestone 4 is complete and verified (2026-07-19).

1. ~~**DEC-0009 Amendment**~~ Accepted: [`DEC-0011`](docs/decisions/DEC-0011-decision-record-classification-amendment.md)
   clarifies that recorded Buy/Hold/Reduce/Exit decisions are governed
   exclusively by DEC-0009's "Portfolio and position data" row and remain
   blocked. See `docs/decisions/DEC-0009-provider-security-gate.md`'s
   amendment signpost.

2. **Milestone 5 (in progress, eval complete)** — Slice 0 (image/attachment
   plumbing in `lib/ai/`, a real-provider `extractVisionOcrCandidate` seam in
   `lib/research/extractors/ocr.ts`, and two Playwright-rendered image
   fixtures under `docs/evals/M001/fixtures/vision/`) is implemented and
   tested. The primary candidate, `gemini-3-flash-preview`, was found
   **retired by the provider as of 2026-07-15** — its live pass failed
   uniformly (34/37 cases) with that exact error, not a vision-capability
   failure. Pivoted to the fallback, `minimax-m3:cloud`: live pass completed
   with 0 hard-gate failures, 0% citation hallucination, and both real-image
   transcription cases passing exactly. [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md)
   (`proposed`) records this outcome and awaits user acceptance. See
   [`docs/milestones/ROADMAP.md`](docs/milestones/ROADMAP.md) for the
   M005→M006→M007 sequence.

3. ~~**Follow-up finding**~~ Resolved: [`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
   removes `gemini-3-flash-preview` from the DEC-0010 allowlist and promotes
   `deepseek-v4-flash:cloud` (already `accepted_for_poc`) in its place. See
   `docs/RISK_REGISTER.md` R-024.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260708-001`
