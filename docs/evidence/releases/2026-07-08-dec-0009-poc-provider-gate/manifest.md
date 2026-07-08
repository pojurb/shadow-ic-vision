# DEC-0009 POC Provider Gate Evidence

Date: 2026-07-08

Branch: `main`

Base commit before provider-gate implementation:
`00dd1fe97f0de9740e8868b9b9c1015870533254`

Remote: `https://github.com/pojurb/shadow-ic-vision.git`

Outcome: `implementation-verified; DEC-0009 local POC provider gate passed`

## Scope

- Required provider-call context on `LLMProvider` calls: route, data class, and
  runtime facts.
- DEC-0009 data-class gate for external provider calls.
- Single gated provider HTTP helper with sanitized outbound JSONL logging.
- `OllamaProvider` external fetches routed through the helper.
- Chat and decision-recommendation callsites classified as
  `poc_workflow_confidential`.
- Evaluator coverage for allowed POC classes and blocked restricted classes.

## Commands And Results

| Check | Result |
|---|---|
| `npm run context:check` | Pass; code index current |
| `npm run status:check` | Pass; repository status contracts consistent |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass; 76 pass, 3 opt-in live checks skipped |
| `npm run build` | Pass |
| `npm run test:e2e` | Pass; 3 Playwright checks |
| `npm run verify:full` | Pass |
| `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json` | Pass; 16 base cases, 16 multimodal addendum cases, 6 provider-boundary cases |
| `git diff --check` | Pass |

## Provider Boundary Result

- Allowed in local POC context:
  `public_market_data`, `synthetic_fixture`, `poc_workflow_confidential`.
- Blocked before external fetch:
  `portfolio_position_data`, `restricted_personal_financial_secret`,
  `production_confidential_processing`.
- Outbound provider logs include provider, model, route, endpoint, data class,
  outcome, reason code, status, and duration.
- Outbound provider logs do not store prompt text, conversation text, evidence
  text, API keys, request bodies, or response bodies.
- Static boundary tests keep provider endpoint fetches behind `lib/ai`.

## Known Limits

- This evidence does not approve Ollama Cloud or any other provider as
  production eligible.
- This evidence does not mark any provider or model selectable.
- This evidence does not run a live confidential provider call.
- Provider/model eligibility remains `not_evaluated`.
- Production, demo, hosted, or multi-user confidential external processing
  remains blocked until a later production provider decision is accepted.

## Rollback

Revert this provider-gate implementation as a unit if DEC-0009 is superseded or
if M001 returns to deterministic-only provider behavior. Preserve historical
decision records and do not retroactively approve any provider processing that
occurred before an accepted provider-specific decision.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
