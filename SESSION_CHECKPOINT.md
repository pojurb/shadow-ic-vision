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
- Added a repository-owned Playwright Edge harness for deterministic desktop and
  responsive browser verification.

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
- Chrome desktop browser verification:
  - empty workspace and conversation creation: pass
  - unsupported input feedback: pass
  - PLTR confirmation, exact evidence, provenance, and reload persistence: pass
  - BBRI Indonesian evidence and IDX provenance: pass
  - altered citation degraded state, zero Evidence, Retry and attempt increment: pass
  - screenshots: blocked by repeated `Page.captureScreenshot` timeout
  - narrow responsive drawer: blocked by viewport-emulation timeout
  - Chrome control was stopped when a later lightweight tab-list call also became
    unresponsive; no native-host configuration was changed
- Playwright Edge fallback verification:
  - desktop three-column geometry and verified PLTR evidence: pass
  - retained desktop screenshot: pass
  - 800 x 900 fixed Research drawer geometry: pass
  - drawer close and reopen behavior: pass
  - retained narrow screenshot: pass

## Remaining Boundaries

- This is synthetic local research only. No live SEC/IDX or secondary calls exist.
- Full PDF/OCR/vision/XBRL processing remains deferred.
- Decision Library completion, export/import, and the final M001 evaluator remain
  deferred.
- No real model/provider is approved or connected.
- `npm audit` reports six moderate dependency findings; no forced breaking upgrade
  was applied during this feature slice.

## Exact Resume Point

The deterministic local vertical slice is closed. Plan live official-source
adapters next while preserving the mock provider for deterministic tests. Do not
reopen cloud-provider selection until a separate provider/security gate is
explicitly approved.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
