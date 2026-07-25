# LC-20260725-003 - Deployment Contract Prerequisites

Status: `candidate`

Captured: `2026-07-25`

Milestone: `M006`

Task type: `planning`

Classification: `process`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

When scoping the original M006 milestone ("Production Confidential-Data Provider Approval"), a blocking architectural conflict was discovered: ADR-0006 §1 binds the application strictly to a local-only deployment contract and requires a dedicated ADR covering managed persistence and authentication before any hosted production deployment can occur.

Because no managed deployment architecture existed, provider approval questions (data retention, region, subprocessor compliance) were unanswerable. This required drafting DEC-0014 to reaffirm local-only scope, withdraw the production provider approval topic, and re-plan M006 to focus on in-pipeline vision extraction.

## Evidence

- Commit, run, or evidence ID:
  - `DEC-0014` (accepted 2026-07-25)
  - `ACTIVE_MILESTONE.md` (M006 slot re-plan)
- Commands or checks:
  - Architectural review of ADR-0006 §1 vs ROADMAP M006 proposal
- Exact result:
  - Production provider approval could not proceed without violating or amending ADR-0006's local-only contract.

## Proposed Reusable Lesson

Before placing production security, compliance, or provider sign-off tasks on a milestone roadmap, verify that the underlying deployment and persistence architecture (ADRs) already supports that deployment model. If the application is bound to a local-only contract, cloud/production compliance sign-offs must be preceded by a formal architecture amendment rather than scoped as standalone approvals.

## Scope And Risks

- Applies to:
  - Product milestone planning, roadmap sequencing, and ADR boundary changes.
- Does not apply to:
  - Local POC provider eligibility evaluations (such as DEC-0010/DEC-0012).
- Known failure modes:
  - Scheduling compliance reviews for non-existent infrastructure topologies.
- Conflicting authority checked:
  - `AGENTS.md`
  - `docs/decisions/ADR-0006-m001-stack.md`
  - `docs/decisions/DEC-0014-local-only-scope-reaffirmation.md`

## Independent Review

- Reviewer:
- Review date:
- Evidence reproduced: `no`
- Duplicate or conflict check:
- Privacy check:
- Disposition: `needs-more-evidence`
- Reason: Candidate captured during DEC-0014 roadmap re-planning; awaits independent review.

## Promotion Or Supersession

- Decision authority:
- Decision date:
- Promotion target: `.agents/PLANNING.md`
- Promotion registry entry:
- Supersedes:
- Superseded by:
- Rollback path:
