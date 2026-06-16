# Browser QA Harness

This note captures the canonical browser QA path for the workspace.

## Purpose

Browser QA can fail for two very different reasons:

- the app is broken
- the harness, browser, or environment is broken

Those need explicit classification. The runner now writes a structured report
with `app`, `data`, or `tooling` as the failure kind, plus the exact failed
step, console/runtime errors, and screenshot artifact paths.

## Canonical Command

- `npm run qa`

That command:

- runs `npm run build` in `app`
- starts the built app on `127.0.0.1:3002`
- launches a fresh Microsoft Edge profile
- seeds the browser from checked-in QA fixtures through a test-only import path
- uses mock provider responses when `qaMode=mock`
- writes a JSON report under `issues/qa/<run-id>/report.json`
- cleans the temporary browser profile before exit

## Classification Rules

- `app`: UI/runtime failure, bad selector/state, or app exception
- `data`: fixture content, seeded records, or compatibility data caused the failure
- `tooling`: browser launch, debug port, server reachability, or harness failure

## Fixture Strategy

- Do not poke IndexedDB directly from the harness.
- Seed scenarios through the app-level QA import path.
- Prefer fixture-backed saved state over hand-built browser mutations.
- For provider-dependent flows, keep QA deterministic with mocked responses.

The shipped fixtures cover:

- `m2`: manual asset entry and portfolio-picker exclusion
- `m3`: stock field provenance
- `m4`: Evidence Locker
- `m6`: analysis and portfolio decision ledgers
- `broken-m4`: intentionally broken evidence seed for failure classification

## Triage Order

1. Run `npm test` and `npm run build` in `app`.
2. Run the browser harness.
3. If the harness fails, classify the failure before changing product code.

## UI Acceptance Pattern

For each touched surface, check:

- empty state
- invalid form state
- successful commit state
- derived badge/status update
- history/order behavior if applicable
- legacy/back-compat rendering if applicable

## Legacy QA Rule

If a legacy-path test is needed:

- start from a real persisted current record
- downgrade only the intended compatibility fields
- avoid inventing old records from scratch unless the fixture is schema-checked

This avoids false negatives caused by malformed seed data instead of real
compatibility bugs.

## Documentation Rule

When browser QA passes through a fallback path, record:

- that browser QA passed
- which path was used
- why the fallback was needed
- whether the remaining issue is product code or local tooling

## QA Closure Plan - 2026-06-15

This is the current closure plan for the outstanding browser-QA sweep after the
M3 and isolated M4 passes.

### Goal

Close the remaining QA gap so roadmap/status docs can treat the canonical
browser harness as the current verification source instead of a partially
completed transition.

### Preflight

Run from the repo root unless noted otherwise.

1. Confirm the app quality gates are still green:
   - `cd app`
   - `npm test`
   - `npm run lint`
   - `npm run build`
2. Return to the repo root.
3. Inspect stale QA build residue under `app/` before new runs. If old
   `.next-qa-*` directories are present, remove them only after confirming no QA
   server or Edge session is still using them.

### Execution Order

1. Isolated M6 pass
   - Command: `node scripts/run.js qa m6`
   - Expected result: pass
   - Evidence: new `issues/qa/<run-id>/report.json`
2. Expected-failure classification pass
   - Command: `node scripts/run.js qa broken-m4 --expect-failure --expect-kind data`
   - Expected result: the run exits successfully because the failure is
     intentional and classified as `data`
   - Evidence: new `issues/qa/<run-id>/report.json`
3. Full canonical sweep
   - Command: `node scripts/run.js qa`
   - Expected result: pass for `m3`, `m4`, and `m6`
   - Evidence: new `issues/qa/<run-id>/report.json`

### Triage Rules

- If preflight fails, stop and fix the product/build issue before browser work.
- If isolated `m6` fails, classify the failure from `report.json` before
  changing code:
  - `app`: fix product/runtime/UI behavior
  - `data`: fix the `m6` fixture or compatibility seed
  - `tooling`: fix harness/browser/server startup and rerun without changing
    product scope
- If `broken-m4` does not fail as `data`, treat that as a harness/classification
  regression and fix the QA path before trusting the full sweep.
- If the full sweep fails after isolated passes succeeded, prioritize shared
  harness/state leakage causes before changing milestone code.

### Closure Criteria

QA closure is complete only when all of the following are true:

- `npm test`, `npm run lint`, and `npm run build` are green
- isolated `m6` browser QA passes
- `broken-m4` succeeds as an expected `data` failure
- the full canonical `node scripts/run.js qa` sweep passes
- the latest artifact paths are recorded in `PROGRESS.md`
- `BUILD_PLAN.md` is updated if M4 should move from `Implemented, QA sweep in progress`
  to `Implemented, verified`

### Documentation Closeout

After the closure criteria pass:

1. Update `PROGRESS.md` with:
   - exact commands run
   - latest artifact paths
   - whether fallback browser tooling was needed
   - the next build step after QA closure
2. Update `BUILD_PLAN.md` milestone notes/status if the M4 verification gap is
   fully closed.
