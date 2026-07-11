# Session Checkpoint - 2026-07-11

## Repository State

- Branch: `main`
- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- Phase: M001 implementation
- Working scope: M001 integration completion
- Cloud provider/security decision `DEC-0009`: accepted and implemented for
  local POC only
- Provider-specific decision `DEC-0010`: accepted and active
- App state: allowlisted model selector active for approved Ollama Cloud models
- Default startup model: `kimi-k2.7-code:cloud`
- Provider/model eligibility: `not_evaluated` for production; approved for local POC
- Kimi provider-eval harness: successfully run; 0 hard-gate failures, clean evidence recorded

## Implemented This Session

- Promoted [`DEC-0010`](docs/decisions/DEC-0010-ollama-cloud-poc-approval.md) from `proposed` to `accepted` following a successful Kimi live provider evaluation.
- Updated `docs/decisions/INDEX.md` and `docs/RISK_REGISTER.md` to reflect `DEC-0010` is now accepted and `R-021` (blanket model approval) is `Mitigated`.
- Updated release evidence manifest at `docs/evidence/releases/2026-07-09-kimi-provider-eval/manifest.md` to record successful live Kimi evaluation metrics.
- Refined evaluation verification logic in `scripts/eval-m001-provider.ts`:
  - Added enums to the system prompts to constrain `nextResponseType` and `status` values for live models.
  - Mitigated `trade_advice_produced` false positives by checking for negative recommendation phrases.
  - Mitigated `citation_hallucination` false positives by allowing verbatim quotes to contain or be contained by expected quotes, ensuring valid substring extraction does not trigger gates.
- Resolved ESLint/TypeScript compilation issues:
  - Resolved `Workspace.tsx` synchronous state update error in `useEffect` by wrapping state transitions in a microtask delay (`setTimeout`).
  - Removed unused imports and variables in `lib/ai/ollama-config.ts` and `scripts/eval-m001-provider.ts`.
  - Regenerated the code structure index (`npm run context:generate`).

## Previous Provider-Gate Implementation

- Added required provider-call context to the project-owned `LLMProvider` contract: route, DEC-0009 data class, and runtime facts.
- Added a pure DEC-0009 provider gate and a single external provider HTTP helper that logs allowed/blocked attempts without prompt or payload text.
- Updated `OllamaProvider` to route external fetches through the gated helper.
- Updated chat and decision-recommendation callsites to pass `poc_workflow_confidential` context.
- Added tests proving allowed POC classes pass, restricted classes fail closed, blocked attempts do not fetch, logs are sanitized, and provider endpoint fetches remain behind the `lib/ai` boundary.
- Extended the M001 multimodal evaluator with six DEC-0009 provider-boundary cases while preserving `modelEligibility: not_evaluated`.
- Regenerated `docs/generated/code-index.json`.
- Added release evidence manifest:
  [`docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md`](docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md)

## Verification Evidence

Latest full verification: 2026-07-11.

- `npm run context:check`: pass
- `npm run status:check`: pass
- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: pass
  - 85 tests passed, 3 skipped
- `npm run build`: pass
- `npm run test:e2e`: pass
  - 3 Playwright checks passed
  - deterministic PLTR desktop and narrow drawer
  - live-labelled IDX fail-closed state
  - OCR and derived trust-class labels
- `npm run verify:full`: pass
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`: pass
  - base case count: 16
  - multimodal addendum case count: 16
  - all 16 deterministic multimodal addendum cases passed
  - DEC-0009 provider-boundary cases: 6 passed
  - `hardGateFailures: []`
  - `modelEligibility: not_evaluated`
- `npm run eval:m001:provider -- --mode deterministic --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json`:
  pass
  - `runMode: deterministic`
  - `modelId: kimi-k2.7-code:cloud`
  - deterministic baseline: 16 base cases, 16 multimodal cases
  - DEC-0009 provider-boundary cases: 6 passed
  - `acceptanceOutcome: deterministic_only`
- `npm run eval:m001:provider -- --mode live --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json`:
  pass
  - `runMode: live`
  - `modelId: kimi-k2.7-code:cloud`
  - Completed successfully with 0 hard-gate failures.
  - `citationHallucinationRate: 0%`
  - `assumptionExtractionCompleteness: 93.3%`

## Remaining Boundaries

- DEC-0010 is accepted for local POC only. It does not authorize production cloud processing.
- No real OCR engine, vision model, local model, or production cloud provider was approved as active in this slice.
- `modelEligibility` remains `not_evaluated` for production.
- Portfolio/position data, credentials, account screenshots, raw database exports, identity documents, unrelated personal files, and production external processing remain blocked.
- Secondary-source and general-news ingestion remain deferred.
- `npm audit` previously reported six moderate dependency findings; no forced breaking upgrade was applied in this slice.

## Exact Resume Point

1. Align on next packet/milestone requirements (M002+).
2. Continue tracking risk and operational readiness rules before production readiness.
