# Delivery Policy

This file defines how work becomes ready, active, verified, and closed. Root
`AGENTS.md` owns the lifecycle; this module owns the detailed delivery gates.

## Status Vocabulary

- `proposed`: drafted but not approved
- `ready`: decision-complete and approved for the next gate
- `in_progress`: authorized work has started
- `blocked`: progress requires a user decision or external state change
- `implemented`: behavior exists but all closure evidence is not complete
- `verified`: all required checks and acceptance criteria passed
- `released`: verified behavior is deployed to its intended environment

Do not use `done` because it hides whether work was merely implemented,
verified, or released.

## Gate 1 - Vision Approval

Required:

- target user and core problem
- product promise and explicit boundaries
- initial wedge and longer-term horizons kept distinct
- success measures that do not reward harmful behavior
- explicit user approval recorded in a decision file

No product implementation is authorized before this gate passes.

## Gate 2 - Strategy Readiness

`docs/PRODUCT_STRATEGY.md` must define the first wedge, main workflow, non-goals,
outcome metrics, and sequencing. `docs/RISK_REGISTER.md` must identify material
product, data, model, security, legal, and operational risks with owners and
mitigations.

## Gate 3 - Milestone Readiness

Each milestone receives an immutable identifier such as `M001`. Its packet must
define:

- user-visible outcome and non-goals
- entry point, main path, edge cases, and failure/recovery states
- data inputs, outputs, persistence, compatibility, and deletion behavior
- implementation slices in dependency order
- test, eval, browser, security, and acceptance requirements
- assumptions and explicit deferrals

The packet is `ready` only when an implementer does not need to invent a product
or data rule. `ACTIVE_MILESTONE.md` points to exactly one active packet.

## Gate 4 - Evaluation And Architecture Readiness

- Evaluation cases derive from the approved behavior contract.
- The Golden Dataset includes normal, boundary, adversarial, missing-data, and
  provider-failure cases where relevant.
- Material architecture decisions record context, options, decision,
  consequences, and rollback or migration considerations.
- Technology is selected only to satisfy the approved slice.

## Gate 5 - Implementation And Closure

Implement in small vertical slices that include behavior, data handling, and
verification. A milestone may be marked `verified` only when:

- every acceptance criterion has evidence
- required automated and user-visible checks pass
- security and data-handling requirements pass
- migrations and import/export round trips pass when applicable
- unresolved risks and deferrals are recorded
- the active pointer and repository status are current

## Change And Handoff Rules

- Material scope changes require updating and re-approving the milestone before
  implementation continues.
- Do not rewrite a completed milestone packet to hide history; add a decision or
  follow-up milestone.
- Every stop point records completed work, failed checks, blockers, evidence
  paths, and the exact next step in `ACTIVE_MILESTONE.md`.

## Document Ownership

- `README.md` is a stable project introduction and links to current status; it
  must not duplicate volatile implementation state.
- `ACTIVE_MILESTONE.md` owns the current phase, open boundaries, and next actions.
- `SESSION_CHECKPOINT.md` owns the detailed handoff and latest verified results.
- Release manifests are immutable retained evidence for a specific commit/run;
  later status changes require a new record rather than rewriting history.
- Decision and learning indexes navigate authority but do not replace their
  source records.
- `docs/CODEBASE_MAP.md` owns human-readable code orientation; generated context
  is derived and must pass its freshness check.
