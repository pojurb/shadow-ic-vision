# DEC-0005 - Approve M001 Evaluation Assets and Gate 4 Readiness

Status: `proposed`

Date proposed: 2026-07-02

Approving authority: user

## Context

Before technology selection or code implementation is authorized, `ACTIVE_MILESTONE.md` must pass Gate 4: Evaluation and Architecture Readiness.
The M001 Evaluation Package under `docs/evals/M001/` has been revised to satisfy the full coverage contract.

The revised evaluation assets establish:
- **Comprehensive Coverage:** 13 total test cases mapping directly to M001 risks (`docs/RISK_REGISTER.md`) and acceptance criteria (`docs/milestones/M001-existing-thesis-loop.md`).
- **Adversarial / Safety Verification:** Concrete test fixtures for Prompt Injection mitigation (`TC-009`) and Provider Failure/Degraded States (`TC-006`).
- **High-Signal Data Feeds:** Clear examples for Indonesian IDX evidence retrieval in Indonesian language (`TC-004`) and US SEC Form 10-Q retrieval (`TC-005`), both populated with correct source metadata.
- **Strict Verification Checks:** Positive and mutated character citation fixtures (`TC-010`, `TC-011`, `TC-012`) to test the deterministic 100% exact substring match gate.
- **Deterministic Persistence Checks:** Cascade delete testing scenario (`TC-013`).
- **Reproducible Grader Framework:** Frozen grader execution command, exact math formulas, explicit semantic evaluation prompt configurations with calibration examples, and a manual/E2E UI checklist.

## Decision Requested

Approve the M001 evaluation package (`cases.json` and `EVAL_GUIDE.md`) as the behavior verification contract for Milestone 1.

Approval closes Gate 4's evaluation requirement. It authorizes proceeding to Milestone-specific technology stack and architecture decisions (drafting `ADR-0006`). It does not authorize product code implementation.

## Options

1. Accept the evaluation package and unblock Milestone 1 architecture decisions.
2. Request further test coverage or rubric adjustments.

## Consequences If Accepted

- `docs/evals/M001/cases.json` and `EVAL_GUIDE.md` become the authorized test baseline.
- `ACTIVE_MILESTONE.md` status remains accepted, pointing to evaluation-ready status.
- Authorization is granted to draft the first Architecture Decision Record (`ADR-0006-m001-stack.md`).

## Affected Files

- `docs/evals/M001/cases.json`
- `docs/evals/M001/EVAL_GUIDE.md`
- `ACTIVE_MILESTONE.md`
- `README.md`
