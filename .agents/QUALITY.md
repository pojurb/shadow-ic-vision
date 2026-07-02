# Quality And Evaluation Policy

This file defines verification expectations. Evals measure behavior; they do
not mathematically prove correctness.

## Verification Layers

Use the layers relevant to the active milestone:

1. **Static checks** - formatting, lint, types, schema validation, dependency and
   secret scanning.
2. **Deterministic tests** - unit, integration, contract, migration, and
   import/export round-trip tests.
3. **Model evaluations** - versioned Golden Dataset, explicit rubric, thresholds,
   structured grader outputs, and regression comparison.
4. **Adversarial evaluation** - prompt injection, misleading sources, missing or
   stale data, contradictory evidence, and unsafe action pressure.
5. **User-visible verification** - browser or interface checks for loading,
   empty, success, invalid, degraded, and recovery states.
6. **Operational verification** - deployment health, observability, rollback,
   and provider-failure behavior.

## Eval Requirements

- Every case maps to an acceptance criterion or named risk.
- Separate hard safety gates from quality scores. A strong average cannot offset
  a citation, privacy, destructive-action, or data-integrity failure.
- Define pass thresholds before implementation to prevent grader gaming.
- Keep held-out and adversarial cases separate from the builder's repair loop.
- Record provider, model identifier, prompt/rubric version, settings that affect
  reproducibility, date, latency, cost when available, and raw outcome.
- Use deterministic graders where possible. Model graders require calibrated
  examples and periodic human review.

## Independence

- The builder may self-correct against development tests.
- High-risk model behavior requires independent review by a different model or
  provider plus deterministic evidence.
- Model consensus never overrides primary-source evidence, test failures, or
  user-approved requirements.

## Failure Classification

Classify failures before changing product code:

- `product`: implementation or UX behavior is wrong
- `data`: fixture, source, migration, or persisted state is wrong
- `model`: provider output or prompt behavior misses the contract
- `tooling`: harness, browser, runner, or local environment failed
- `provider`: external API, quota, authentication, or outage failed
- `security`: privacy, authorization, injection, or secret-handling failed

Retain enough diagnostic evidence to reproduce or explain the classification.

## Evidence And Definition Of Done

Evidence belongs under `docs/evidence/releases/<release-or-run-id>/` and must
identify the commit, commands, results, environment, model metadata where
relevant, failures, and artifact paths.

Work is not `verified` when required checks were skipped, blocked, or only
reported from memory. State those limits explicitly.
