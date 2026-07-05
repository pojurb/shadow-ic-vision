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

## Repository-Owned Browser Gates

When browser behavior is a required milestone or release gate, implement the
acceptance checks in a repository-owned, repeatable browser harness. The harness
must use isolated synthetic state, assert required behavior and layout, retain
the minimum required artifacts, and run through a documented repository command.

Interactive Chrome or in-app browser control may supplement required evidence,
but it must not be the only closure mechanism. Classify interactive-control
failures as tooling failures before changing product code or browser
registration.

This requirement does not apply to exploratory design review without a
repeatable acceptance gate or to usability research requiring human judgment.

## Scheduled Worker Verification

Before approving a scheduled worker, map its execution environment to the
application's authorized persistence and security boundary. Reject a worker
runtime that cannot access the approved durable store or would cross an
unauthorized deployment boundary.

Before closure:

1. use a scheduler inside the approved boundary;
2. verify its registered executable, arguments, working directory, and identity
   are durable rather than temporary tooling paths;
3. execute the registered job through the real scheduler; and
4. retain the scheduler result, next-run state, and corresponding application
   run-state evidence.

This guidance does not prescribe a specific scheduler. Cloud scheduling is
valid when the approved architecture provides authenticated access and durable
managed persistence in the same authorized environment.

## Architecture ADR Completeness

Before claiming an Architecture Decision Record (ADR) draft is complete and ready for approval, the builder must ensure the document explicitly defines the following:

1. **Deployment contract** - Specifying where the runtime runs (e.g. bound to loopback `127.0.0.1`), hosting limitations, and environment-specific persistence rules.
2. **Persistence durability** - Explicitly mapping database files outside the repo and defining transactional boundaries.
3. **Pipeline stages** - Clearly structuring multi-step async workflows (e.g. citation verifications) into distinct stages with intermediate artifact outputs.
4. **Source adapter contracts** - Defining rate limits, user-agents, caching, backoff, and fallbacks for external resource fetching.
5. **Security provider status** - Disclosing and separating "candidate" providers from approved ones, and enforcing data classification boundaries.
6. **Testing architecture** - Including a table of required test categories (unit, database, integration, migration, mock, evals, browser checks).
