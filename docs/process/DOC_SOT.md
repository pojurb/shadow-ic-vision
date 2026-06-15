# Documentation Source of Truth

This document defines which project files are authoritative for roadmap state,
implementation scope, process, QA evidence, and session handoff.

Use these rules at the end of every meaningful work session and before resuming
work on another device or in another agent session.

## Authority Order

### 1. Roadmap and Milestone State

`BUILD_PLAN.md` is the source of truth for:

- current milestone ordering
- milestone status (`not implemented`, `in progress`, `implemented`, `verified`)
- recommended next build order

If milestone status changes during a session, update `BUILD_PLAN.md` before
ending the session.

### 2. Active Milestone Scope

`docs/milestones/m[X]_spec.md` is the source of truth for the active
milestone's:

- scope boundaries
- product and UX contract
- engineering contract
- implementation slices
- milestone-specific verification and acceptance criteria

If implementation decisions change the active milestone's contract, update the
active milestone spec before ending the session.

### 3. Milestone Process and Quality Gates

`EXECUTION_PLAN.md` is the source of truth for:

- milestone lifecycle
- Product Trio workflow
- packet structure
- global quality gates
- milestone pipeline summary

Do not use `PROGRESS.md` to redefine lifecycle or quality-gate rules.

### 4. Session Handoff and Stop Point

`PROGRESS.md` is the source of truth for:

- latest session snapshot
- exact stop point
- what passed
- what failed
- what is still pending
- exact next commands to run
- latest verified artifact paths

When stopping work midstream, update `PROGRESS.md` with enough detail that the
next session can resume without reading chat history.

### 5. QA Evidence

`issues/qa/<run-id>/report.json` is the source of truth for browser QA results.

If `PROGRESS.md`, `BUILD_PLAN.md`, or `EXECUTION_PLAN.md` say a browser QA flow
passed, they should point to the relevant artifact path or be consistent with a
stored report.

## Conflict Resolution

If these documents conflict, resolve them in this order:

1. `issues/qa/<run-id>/report.json` for factual QA outcome
2. `docs/milestones/m[X]_spec.md` for the active milestone's intended contract
3. `BUILD_PLAN.md` for milestone state
4. `EXECUTION_PLAN.md` for process and quality gates
5. `PROGRESS.md` for current handoff narrative

Then update the stale document before ending the session.

## Session-End Update Rule

Before ending a work session, update the minimum necessary documents:

- update `PROGRESS.md` when the stop point, next commands, blockers, or latest
  artifacts changed
- update `BUILD_PLAN.md` when milestone status or recommended next order changed
- update `docs/milestones/m[X]_spec.md` when the active milestone contract
  changed
- update `EXECUTION_PLAN.md` only when lifecycle, milestone pipeline, or global
  quality-gate policy changed

Do not treat chat history as project source of truth.

## Cross-Device Continuity

To keep these rules consistent across devices:

- keep this file committed in git
- keep `AGENTS.md` and `CLAUDE.md` as thin entrypoints that reference this file
- prefer updating the canonical document instead of duplicating policy text in
  multiple places

## Required Resume Read Order

When resuming work after interruption or on another device, read in this order:

1. `AGENTS.md`
2. this file: `docs/process/DOC_SOT.md`
3. `BUILD_PLAN.md`
4. active `docs/milestones/m[X]_spec.md` if a milestone is in progress
5. `EXECUTION_PLAN.md`
6. `PROGRESS.md`
7. referenced QA artifacts under `issues/qa/`
