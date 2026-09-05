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

### Playwright Navigation Synchronization

When a Playwright browser test relies on client-side navigation triggered by an API mutation (such as creating or deleting a resource and calling `router.push`), synchronize the test on the app-owned request and response before asserting the destination route. Assert the created resource ID from the response payload and match the final route from that ID. Do not classify a navigation timeout as a product regression until the API response and route side effects have been verified.

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

## Open-Ended Pipeline Extraction Seams

When adding visual or multimodal document capabilities to an ingestion pipeline, clearly separate **transcription-first seams** (open-ended document extraction) from **quote-verification seams** (targeted claim verification). Do not attempt to reuse quote-verifying helper functions in open-ended ingestion flows without providing the preceding transcription step.

## Deployment Contract Prerequisites

Before placing production security, compliance, or provider sign-off tasks on a milestone roadmap, verify that the underlying deployment and persistence architecture (ADRs) already supports that deployment model. If the application is bound to a local-only contract, cloud/production compliance sign-offs must be preceded by a formal architecture amendment rather than scoped as standalone approvals.

## SQLite WAL Backup And Restore Proof

When SQLite may run in WAL mode, create backups through a database-aware
snapshot mechanism such as SQLite's Online Backup API, or through an explicitly
controlled checkpoint and copy procedure whose concurrency guarantees are
known. A backup is not verified until a clean restore opens successfully and
deterministic sentinel data committed before the backup is readable with its
relationships intact.

Do not infer backup completeness from file existence, copy success, file size,
or the ability to open the copied main file. Apply this check to migration,
maintenance, cleanup, restore, and disaster-recovery procedures. Logical
exports with a deliberately narrower contract must be tested against their
named contract instead.

## Semantic Round-Trip Verification

For logical export/import, schema migration, synchronization, and entity
cloning, verify semantic equivalence at the domain boundary. Compare the
relationships, provenance, user-owned classifications, version fields, and
material derived results that the application shows or uses after restoration.
When IDs are regenerated, remap and test every internal reference.

Schema validity and row counts remain structural checks; they do not prove that
the restored object retains the same coverage, assessment, or history. WAL
specific database backup safety is governed by the SQLite backup guidance above.

## Multi-Lane Run Outcomes

When one command or worker orchestrates multiple independently failing lanes,
record an explicit outcome for every enabled lane and define how those
outcomes form the aggregate run state. Machine-readable and user-facing output
must make partial execution diagnosable, including the distinction between
attempted, succeeded, degraded, failed, unavailable, and skipped where those
states have materially different meaning.

Do not present a primary lane's `succeeded` status as proof that the entire
orchestration succeeded. Retain a run identifier and enough per-lane metadata
to diagnose partial results and retry only affected work. This guidance does
not prescribe product-facing status vocabulary or require a soft-failure lane
to change the primary job status without an explicit product decision.

## Cross-Surface Workflow Handles

Before accepting a workflow that crosses CLI, browser, API, or worker
boundaries, prove that the artifact returned by each stage is directly accepted
by the next stage. Prefer one stable user-facing handle. If entity creation
changes the canonical internal ID, provide a deterministic resolver from the
original handle and expose the relationship in human and machine-readable
output.

Verify the complete handoff with real surface boundaries. Service-level tests
of individual stages do not establish that a user can complete the workflow.

## Document Extractor Threshold Isolation Across Web Sources

When expanding document extraction from formal, dense report documents (SEC/IDX filings) to raw web HTML (press releases, news articles, search results), isolate extraction thresholds and HTML DOM cleaning:

1. **Strip DOM structural boilerplate** (`nav`, `header`, `footer`, `aside`, cookie/legal banners) at HTML ingestion time before sentence splitting.
2. **Isolate thresholds across source tiers**: Do not rely solely on low token-matching thresholds tuned for clean financial filings when processing raw web HTML; apply phrase-level denylists and DOM pre-cleaning to prevent site-wide boilerplate promotion.

## Verifying AI-Reported Examples Against Primary Sources

When an AI reviewer's report cites a specific example as coming from real data (a database row, a document quote, a computed value) as part of a review or verification task, treat that example as unverified until checked against the primary source directly — not against the reporting AI's own restated summary of it, and not by comparing it to a second AI's account instead of the source. This applies even inside a report whose stated purpose is verification, sitting next to findings that are otherwise correct: a fabricated specific value can be written with the same confident, unflagged phrasing as genuinely verified findings. The same discipline applies to specific claims made by static source documents, not only live AI output — a document can be equally wrong about what a real system contains, and needs the same primary-source check. Verify the load-bearing or surprising claims and the specific examples used to justify a conclusion, not exhaustively, but enough to catch fabrication before it informs a decision or another document.

