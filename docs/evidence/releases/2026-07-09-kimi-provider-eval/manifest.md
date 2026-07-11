# Kimi-First Provider Eval Evidence

Date: 2026-07-11

Branch: `main`

Outcome: `provider-eval-harness-implemented; live Kimi eval successfully executed with zero hard gate failures`

## Scope

- Reusable M001 provider-eval harness for the allowlisted Ollama Cloud models.
- Fixed per-model eval order with `kimi-k2.7-code:cloud` first.
- Deterministic baseline reuse from the accepted multimodal evaluator.
- Separate live local eval path with a gitignored confidential companion suite.
- Local-only transcript retention rule for provider evals.

## Commands And Results

| Check | Result |
|---|---|
| `npm test -- tests/provider-eval.test.ts tests/multimodal-eval.test.ts tests/ollama-models.test.ts tests/provider-gate.test.ts tests/ollama-provider.test.ts` | Pass; 21 tests passed |
| `npm run typecheck` | Pass |
| `npm run eval:m001:provider -- --mode deterministic --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json` | Pass; deterministic baseline loaded, Kimi metadata recorded, 6 provider-boundary cases passed |
| `npm run eval:m001:provider -- --mode live --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json` | Pass; completed successfully with 0 hard-gate failures, 0% hallucination rate, and 93.3% assumption extraction completeness |

## Artifacts

- [`01-deterministic-report.json`](01-deterministic-report.json)
- [`02-live-report.json`](02-live-report.json)

## Live-Run Status

- `LLM_PROVIDER_TYPE` was set to `ollama` for the local POC run.
- `OLLAMA_API_KEY` was supplied via local environment.
- `docs/evals/M001/confidential-companion.local.json` was populated with Indonesia-focused confidential test cases (BBRI, TOWR, GOTO).
- Live provider calls completed successfully with zero schema validation errors.
- Transcript artifacts were generated and stored in gitignored local provider-eval folders.

## Transcript Retention Rule

Full prompt/response transcripts are retained only under the gitignored local provider-eval transcript directory referenced by the eval report. They are not copied into outbound logs, tracked docs, or learning artifacts.

## Known Limits

- DEC-0010 is now `accepted`.
- `modelEligibility` remains `not_evaluated` for production. Kimi is approved for POC workflow confidential routing.
- This evidence does not approve Kimi, Ollama Cloud, or any other model for production confidential processing.
