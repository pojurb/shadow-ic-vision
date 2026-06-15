# Browser QA Harness

This note captures the repeatable QA process learned while closing M6
verification on 2026-06-15.

## Why This Exists

Browser QA can fail for two very different reasons:

- the app is broken
- the browser tooling is broken

These must be separated early. M6 was delayed because the app was healthy, but
the Codex in-app browser path failed during setup.

## Core Learnings

- Treat `test` / `build` health and browser-QA health as separate gates.
- Classify blockers as `app`, `data`, or `tooling` before changing code.
- Do not rely on the in-app browser as the only QA path on this Windows setup.
- Keep a fallback browser automation path ready when the primary helper fails.
- For legacy compatibility QA, prefer cloning a real saved record and degrading
  only the legacy fields instead of hand-writing an old-shape fixture.
- When a QA blocker is tooling-only, record the workaround and continue
  verification instead of leaving the milestone ambiguous.

## Triage Order

1. Confirm the repo state first with `npm test` and `npm run build` in `app`.
2. Check whether the local app is reachable on `http://127.0.0.1:3000`.
3. Test the primary browser path.
4. If the primary path fails, classify the failure before touching app code.

Use these labels:

- `app`: page fails to load, UI errors, API errors, bad runtime behavior
- `data`: seeded data or legacy fixtures crash the UI or misrepresent behavior
- `tooling`: browser helper, runtime, PATH, sandbox, or automation failure

## Preferred QA Paths

Primary path:

- Codex in-app Browser

Fallback path used for M6:

- local Next dev server on `127.0.0.1:3000`
- local Playwright runtime
- installed Microsoft Edge as the executable browser

## M6-Proven Workflow

1. Start the app locally.
2. Verify the app responds over HTTP before opening a browser.
3. If the in-app browser helper crashes, switch to Playwright + Edge.
4. Run the milestone acceptance flow end to end in a real browser.
5. Save the verification result in milestone/status docs, including the method
   used.

## Acceptance Pattern For UI Milestones

For each touched surface, check:

- empty state
- invalid form state
- successful commit state
- derived badge/status update
- history/order behavior if applicable
- legacy/back-compat rendering if applicable

For M6 specifically, the browser pass covered:

- analysis decision commit
- invalid required-field blocking
- due-review flow
- newest-first history rendering
- portfolio decision commit
- legacy decision rendering without remapping

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

## Current Next Step

After M6, the next build item is M3 Stock Intake Trust + Field Provenance.
That is the next place where decision quality and data trust improve
meaningfully.
