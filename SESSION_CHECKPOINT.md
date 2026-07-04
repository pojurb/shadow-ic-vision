# Session Checkpoint — 2026-07-04

## Repository State

- Branch: `shadow-ic-vision`
- Phase: M001 implementation
- Working scope: verified local Intake → Research → Verify vertical slice
- Cloud provider decision `DEC-0009`: deferred

## Implemented

- Lazy server-only SQLite initialization; `next build` no longer opens a database.
- External database directory creation, committed migrations, foreign keys, and
  backup-before-migration behavior.
- Additive migration `0001_vengeful_tombstone.sql` covering M001 thesis,
  assumption, message, evidence, and research-job fields.
- Typed Zod boundaries for chat, confirmation, research execution, and retry.
- Project-owned provider capabilities and streaming boundary; deterministic PLTR
  and BBRI mock fixtures; unsupported and unsafe requests fail closed.
- Explicit confirmation before durable thesis/assumption creation.
- Idempotent transactional confirmation and persisted research-job states.
- Case-sensitive, whitespace-canonicalized citation verification. Rejected
  candidates are degraded diagnostics and never durable Evidence.
- Read-only research endpoint plus explicit run/retry mutation endpoints.
- Three-column conversation workspace with persistent desktop Research panel and
  narrow-screen drawer behavior.
- Visible empty, confirmation, queued, running, verified, degraded, failed,
  invalid-input, and retry states.
- Replaced the old scratch script with an actual Vitest suite.

## Verification Evidence

- `tsc --noEmit`: pass
- `eslint .`: pass
- `vitest run`: 21 assertions pass
- `next build`: pass without a configured or pre-existing database
- Live local API verification:
  - PLTR draft → confirm → `exact_verified`: pass
  - BBRI Indonesian fixture → confirm → `exact_verified`: pass
  - duplicate confirmation returns the existing thesis/jobs: pass
  - altered PLTR quote produces `degraded` and zero Evidence: pass
  - Retry returns the degraded job to `queued`: pass
  - subsequent GET restores succeeded persisted state: pass
- Visual/browser checklist: not run; in-app browser unavailable after connection
  and retry attempts

## Remaining Boundaries

- This is synthetic local research only. No live SEC/IDX or secondary calls exist.
- Full PDF/OCR/vision/XBRL processing remains deferred.
- Decision Library completion, export/import, and the final M001 evaluator remain
  deferred.
- No real model/provider is approved or connected.
- `npm audit` reports six moderate dependency findings; no forced breaking upgrade
  was applied during this feature slice.

## Exact Resume Point

Run the browser checklist when browser tooling is available. If it passes, retain
evidence and close this vertical slice. Then plan live official-source adapters;
do not reopen cloud-provider selection until the local workflow is closed.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
