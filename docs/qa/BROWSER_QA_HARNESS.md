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
