# Active Milestone

Status: `planning`

Active Packet: [`docs/milestones/M004-multi-thesis-briefing.md`](docs/milestones/M004-multi-thesis-briefing.md) (proposed)

## Current Phase

M001 (Existing Thesis Loop), M002 (Portfolio Positions & Ingestion Alerts), and M003 (Explore-To-Tracked Loop) are 100% completed, verified, and merged. 

We are now entering the planning phase for Milestone 4 (Multi-Thesis Briefing), designed to scale holding tracking up to 100 assets with priority ranking queues and a comprehensive status index.

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

Latest full verification: 2026-07-11.

Latest targeted provider-package verification: 2026-07-11.

- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- `npm run context:check`: pass
- `npm run status:check`: pass
- TypeScript `tsc --noEmit`: pass
- ESLint `eslint`: pass
- Vitest: 76 pass; 3 opt-in live checks skipped
- Next.js production build: pass
- Playwright: 3 pass
  - deterministic PLTR desktop and narrow Research drawer
  - live-labelled IDX fail-closed UI without a network request
  - OCR and derived trust-class labels visible in the Research drawer
- `npm run verify:full`: pass
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

- M001 is not fully closed because real OCR/vision provider eligibility,
  provider-specific current-source approval, and production confidential-data
  provider approval remain unapproved.
- [`DEC-0010`](docs/decisions/DEC-0010-ollama-cloud-poc-approval.md) is an
  accepted Ollama Cloud POC approval package. The app now exposes an
  allowlisted selector for `gemini-3-flash-preview`, `kimi-k2.7-code:cloud`,
  `qwen3.5:cloud`, `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`, and
  `minimax-m3:cloud`. All 6 models are now verified and promoted to `accepted_for_poc`.
  Real confidential POC traffic is authorized through the project-owned
  provider boundary under the accepted scopes.
- [`DEC-0009`](docs/decisions/DEC-0009-provider-security-gate.md) is accepted
  and implemented as the POC provider/security gate. It permits local POC
  workflow confidential routing through the project-owned provider boundary,
  but does not approve production external processing or selectable model
  eligibility. Portfolio/position data, credentials, account screenshots, raw
  database exports, identity documents, and unrelated personal files remain
  blocked unless a later explicit decision allows them.
- The deterministic multimodal evaluator proves first-slice application and
  provider-boundary gates; it does not approve a model, provider, cloud
  processor, or native browsing capability.
- Secondary-source and general-news ingestion remain deferred.
- `npm audit` previously reported six moderate dependency findings; no forced
  breaking upgrade was applied in this slice.

## Next Steps (Milestone 4 Planning & Core Steps)

1. **Milestone 4 Planning:** Draft functional specification packet `docs/milestones/M004-multi-thesis-briefing.md`.
2. **Top-10 Priority Queue:** Implement priority ranking rules based on recent filing alerts, last-reviewed timestamps, and assumption changes.
3. **Comprehensive Status Index:** Expand UI to list, sort, and filter all watchlisted and active portfolio companies.
4. **Review History Retention:** Support storing outcome selections, action changes (Buy/Hold/Exit), and user reasoning logs across multiple evaluation cycles.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260708-001`
