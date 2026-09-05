# LC-20260905-003 - Multi-Lane Runs Need Explicit Outcomes

Status: `promoted`

Captured: `2026-09-05`

Milestone: `cross-cutting`

Task type: `review`

Classification: `quality`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

The `research:queue` workflow invokes multiple research lanes, including
secondary sources, XBRL, discovery/promotion, and the official citation
pipeline. Several auxiliary lanes catch failures and continue, while the
official job owns the visible `research_jobs.status`. A visible `succeeded`
state can therefore coexist with auxiliary lanes that failed, were unavailable,
or were skipped without an equivalent per-lane outcome being presented.

This confirms that one component's terminal status is being used as a proxy for
an aggregate operation with a wider execution scope.

## Evidence

- Commit, run, or evidence ID: CLI workflow audit against
  `0ab929500c586d97ef96cfb4e1c48ae990d9bc4f`, 2026-09-05
- Commands or checks: static call-chain trace from CLI entry points through
  research orchestration, lane error handling, and `research_jobs.status`
  ownership; full project verification also passed
- Exact result: multiple soft-failure lanes were identified that do not own or
  degrade the primary job's terminal status
- Related review finding or incident:
  `outputs/reviews/cli-workflow-review-2026-09-05.md`, research queue
  documentation/status and observability findings

No confidential investment data, restricted data, or secrets are included.

## Proposed Reusable Lesson

When one command or worker orchestrates multiple lanes, record an explicit
outcome for every enabled lane and define how those outcomes form the aggregate
run state. User-facing and machine-readable output should distinguish at least
attempted, succeeded, degraded, failed, unavailable, and skipped where those
states have materially different meaning.

Do not present a primary lane's `succeeded` status as evidence that the entire
orchestration succeeded. Retain a run identifier and enough per-lane metadata
to diagnose partial results and retry only the affected work.

## Scope And Risks

- Applies to: research orchestration, scheduled refresh, import pipelines,
  batch processing, and commands with independently failing sub-operations
- Does not apply to: a single atomic operation whose success necessarily proves
  every required step completed
- Known failure modes: swallowed exceptions; one status column shared by
  operations with different owners; treating an empty result as success without
  recording why it was empty; documentation describing only the primary lane
- Conflicting authority checked: `AGENTS.md`, `.agents/QUALITY.md`,
  `docs/CLI_WORKFLOW.md`, and `DEC-0017`; the exact product status vocabulary
  remains an implementation/product decision outside this candidate

## Independent Review

- Reviewer: independent review agent (separate agent session)
- Review date: 2026-09-05
- Evidence reproduced: `yes`
- Duplicate or conflict check: no existing learning candidate governs aggregate
  status semantics for multi-lane operations
- Privacy check: public code-path observations only
- Disposition: `validated`
- Reason: independent reviewer confirmed the call-chain and soft-failure
  behavior. The lesson is valid as quality guidance, while product-facing
  status vocabulary remains a separate product decision.

## Promotion Or Supersession

- Decision authority: user for changes to quality policy or product-visible
  status semantics
- Decision date: 2026-09-05
- Promotion target: `.agents/QUALITY.md`
- Promotion registry entry: `PROMOTIONS.md`, active promotion for
  `LC-20260905-003`
- Supersedes: none
- Superseded by:
- Rollback path: remove any promoted quality guidance and mark this candidate
  superseded; retain the audit evidence
