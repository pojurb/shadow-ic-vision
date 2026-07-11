# DEC-0010 - Ollama Cloud POC Provider Approval Package

Status: `accepted`

Date proposed: 2026-07-09
Date accepted: 2026-07-11

Approving authority: user

Supersedes: none

Depends on: [`DEC-0009`](DEC-0009-provider-security-gate.md)

## Context

DEC-0009 accepts external provider processing as the default M001 POC path only
through the project-owned provider boundary. It still requires a
provider-specific approval package before real confidential POC workflow data is
sent to that provider.

The configured external provider path in this repository is Ollama Cloud:

- provider: Ollama Inc.
- product: Ollama Cloud / ollama.com API
- adapter: `lib/ai/adapters/ollama.ts`
- boundary helper: `lib/ai/provider-http.ts`
- default endpoint: `https://ollama.com/api`
- model selector: explicit allowlist in the app UI and request contract
- approved model ids in the allowlist:
  - `gemini-3-flash-preview`
  - `kimi-k2.7-code:cloud`
  - `qwen3.5:cloud`
  - `deepseek-v4-pro:cloud`
  - `deepseek-v4-flash:cloud`
  - `minimax-m3:cloud`
- direct API endpoint used by the adapter: `POST /api/chat`

This decision is a provider-specific approval package draft. It does not become
authorization until accepted by the user.

## Current Primary Sources Reviewed

Primary sources reviewed on 2026-07-09:

- Ollama Privacy Policy, last updated March 2026:
  `https://ollama.com/privacy`
- Ollama Terms of Service, last updated May 2026:
  `https://ollama.com/terms`
- Ollama Cloud documentation:
  `https://docs.ollama.com/cloud`
- Ollama API introduction:
  `https://docs.ollama.com/api/introduction`

Material findings from those sources:

- Ollama states local Ollama prompts and responses remain on the local machine.
- For cloud-hosted models, Ollama states prompts and responses are processed
  transiently to provide the service and are not used to train models.
- Ollama collects account, payment, support, device, usage, diagnostic,
  security, and operational metadata; its policy says diagnostic metadata does
  not include prompt or response content.
- Ollama says cloud prompt and response content is not stored beyond the time
  required to fulfill the request.
- Ollama says personal information may be processed by third parties that help
  operate the service, including cloud infrastructure providers and model
  inference providers.
- Ollama says data may be transferred to and processed in the United States.
- Ollama says users can delete their account and request deletion of associated
  data, subject to legal obligations.
- Ollama Cloud documentation identifies `https://ollama.com/api` as the cloud
  API base URL and states that direct API access uses bearer-token
  authentication.
- Ollama API documentation says the API is not strictly versioned.
- Ollama Cloud documentation lists `deepseek-v3.1:671b-cloud` for retirement on
  2026-07-15, with `deepseek-v4-flash` as the recommended alternative.

## Decision Requested

Approve Ollama Cloud as a POC-only external provider for the M001 thesis loop,
subject to all conditions below.

This approval would allow only `poc_workflow_confidential` thesis-loop data
needed to exercise M001 through the project-owned provider boundary. It would
not approve portfolio/position data, restricted personal or financial secrets,
production confidential processing, hosted demo processing, selectable product
models, native provider browsing, native PDF parsing, or model-generated
arithmetic as evidence.

## Blocking Issue Before Activation

This package remains `proposed` until Kimi completes a live local provider-eval
run with the required local prerequisites in place. The allowlist and fixed
evaluation order are now implemented in the app and harness:

1. `kimi-k2.7-code:cloud`
2. `gemini-3-flash-preview`
3. `deepseek-v4-pro:cloud`
4. `deepseek-v4-flash:cloud`
5. `qwen3.5:cloud`
6. `minimax-m3:cloud`

The app does not allow arbitrary model ids. Unsupported ids fail validation
before the provider call. Every selected model remains `not_evaluated` until it
produces its own accepted provider-eval result.

## Approved Scope If Accepted

Allowed data classes:

- `public_market_data`
- `synthetic_fixture`
- `poc_workflow_confidential`

Blocked data classes:

- `portfolio_position_data`
- `restricted_personal_financial_secret`
- `production_confidential_processing`

Runtime scope:

- local POC only;
- loopback or explicitly local POC runtime only;
- no production, hosted demo, multi-user, or shared runtime;
- no direct provider calls outside `lib/ai`.

Model scope:

- UI switching is allowed only among the approved model ids in this decision;
- the active model must be recorded with each provider call;
- `modelEligibility` stays `not_evaluated` until each model receives its own
  accepted eval result.

## Provider Configuration To Record Before Use

Required local configuration before any confidential POC call:

- `LLM_PROVIDER_TYPE=ollama`
- `OLLAMA_API_URL=https://ollama.com/api`
- `OLLAMA_MODEL=<approved model id>`
- `OLLAMA_API_KEY=<local secret only>`
- `docs/evals/M001/confidential-companion.local.json` as a gitignored local
  companion suite using the same JSON schema as `cases.json` or
  `multimodal-cases.json`

Do not commit `.env` or API keys. Do not copy secrets into logs, release
evidence, decision records, or learning candidates.

## Boundary And Logging Requirements

All Ollama Cloud calls must use:

- `LLMProvider` from `lib/ai/provider.ts`;
- `OllamaProvider` from `lib/ai/adapters/ollama.ts`;
- `providerFetch` from `lib/ai/provider-http.ts`;
- `evaluateProviderGate` from `lib/ai/provider-gate.ts`.

Outbound logs must include provider, model, route, endpoint, data class,
timestamp, allowed or blocked outcome, reason code, HTTP status when available,
and duration.

Outbound logs must not include prompt text, conversation text, evidence text,
request body, response body, API keys, credentials, account details, or other
secrets.

Full prompt/response transcripts are allowed only for the local provider-eval
workflow introduced in this slice. Those transcripts must live only in the
gitignored `test-results/provider-evals/...` directory referenced by the
sanitized eval report. They must not be copied into outbound logs, tracked
release manifests, decision records, learning candidates, or other repo-owned
artifacts.

## Terms And Security Constraints

This POC approval relies on Ollama's published statements as of 2026-07-09 that
cloud prompts and responses are transiently processed to provide the service,
are not used for model training, and are not retained beyond the time needed to
fulfill the request.

Residual constraints:

- Ollama's policy still permits collection and use of operational metadata.
- Ollama identifies third-party operators such as cloud infrastructure and model
  inference providers.
- Region is not pinned to Indonesia or the user's local machine; Ollama states
  data may be transferred to and processed in the United States.
- The API is not strictly versioned.
- Provider terms can change and must be rechecked before production approval or
  any later model switch.

## Eval And Verification Path

Before activation:

- `npm run status:check`
- `npm test -- tests/provider-gate.test.ts tests/provider-boundary.test.ts tests/ollama-provider.test.ts`
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`
- `npm run eval:m001:provider -- --mode deterministic --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json`
- `npm run eval:m001:provider -- --mode live --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json`
- `git diff --check`

Acceptance evidence must show:

- restricted classes fail closed before external fetch;
- provider endpoint fetches remain behind `lib/ai/provider-http.ts`;
- outbound logs are sanitized;
- evaluator provider-boundary cases pass;
- the deterministic provider-eval report records the selected model metadata and
  fixed eval order;
- the live provider-eval report completes without `api_key_missing`,
  `confidential_suite_missing`, or other hard-gate failures; and
- `modelEligibility` remains `not_evaluated` until acceptance is explicitly
  recorded.

## Current Kimi-First Eval State

Current retained evidence for the Kimi-first slice:

- [`docs/evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json`](../evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json):
  pass; deterministic baseline loaded 16 base cases, 16 multimodal cases, and
  all 6 provider-boundary checks passed for `kimi-k2.7-code:cloud`.
- [`docs/evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json`](../evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json):
  blocked before provider calls because this checkout did not have
  `OLLAMA_API_KEY` or `docs/evals/M001/confidential-companion.local.json`.

## UI Disclosure Language

When Ollama Cloud is active, the product should disclose:

> Ollama Cloud is active for this local POC. Thesis-loop text may be sent to
> Ollama's hosted API through the JP Invest provider boundary. Portfolio data,
> credentials, account screenshots, raw database exports, identity documents,
> production use, and hosted demo use remain blocked.

## Revocation And Incident Response

Revoke this approval if:

- a provider call bypasses `lib/ai`;
- restricted data leaves the local runtime;
- Ollama terms materially change;
- the configured model is retired without an approved replacement;
- logs contain payload text or secrets;
- the app is deployed beyond local POC scope.

Immediate actions after revocation:

- set `LLM_PROVIDER_TYPE=mock`;
- remove or rotate `OLLAMA_API_KEY`;
- stop real provider calls;
- preserve sanitized outbound logs;
- record the incident or blocker in `SESSION_CHECKPOINT.md`;
- add or update a risk register entry if residual risk changes.

## Acceptance Criteria

- This record is accepted by the user or remains explicitly blocked.
- The allowlisted model set is accepted and the app selector is usable.
- `docs/decisions/INDEX.md` matches this record's status.
- `docs/RISK_REGISTER.md` references this approval package.
- Verification commands pass and retained evidence records the exact command
  output.
- The app exposes only the approved model allowlist and blocks unsupported ids.
- Live confidential eval transcripts, if retained, stay only under the
  gitignored local provider-eval transcript directory.
- `modelEligibility` remains `not_evaluated`.
- No production confidential processing is approved by this record.
