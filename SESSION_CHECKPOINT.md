# Session Checkpoint — 2026-07-04

## Repository State

- Branch: `shadow-ic-vision`
- Phase: M001 implementation
- Working scope: live SEC/IDX official-source adapter implementation
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
- Added `RESEARCH_SOURCE_MODE=mock|live`; mock remains the default for QA.
- Added live SEC discovery through ticker mapping, submissions history, and the
  primary 10-Q/10-K filing document.
- Added a fail-closed IDX adapter that accepts only anonymous official links with
  ticker, date, and document identity; current live access returns HTTP 403.
- Added allowlisted outbound HTTP handling with timeout, bounded retry, rate
  limiting, redirect validation, size limits, short application cache, and JSONL logging.
- Added additive migration `0002_live_official_sources.sql` for immutable source
  snapshots, job-source provenance, error codes, source mode, and interpretation state.
- Added deterministic HTML and text-layer PDF extraction. Scanned, encrypted,
  corrupt, and unsupported documents degrade explicitly.
- Exact source matching now leaves assumptions `untested`; interpretation remains
  `pending` until a separate interpretation or user-confirmation step exists.

## Verification Evidence

- `tsc --noEmit`: pass
- `eslint .`: pass
- `vitest run`: 36 assertions pass; 2 opt-in live assertions skipped by default
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
  - live-source label and `idx_source_unavailable` degraded UI: pass
  - Retry visible and zero Evidence in fail-closed state: pass
- Live official-source smoke:
  - IDX official reports page returned HTTP 403: confirmed
  - adapter converted that response to `idx_source_unavailable`: pass
  - SEC smoke: not run; a real `SEC_USER_AGENT` contact is required

## Remaining Boundaries

- SEC code is implemented but not yet live-smoke verified.
- IDX correctly fails closed, but no stable anonymous disclosure route is validated.
- Secondary-source fallback remains deferred.
- Text-layer PDF extraction is implemented; OCR/vision/XBRL remain deferred.
- Decision Library completion, export/import, and the final M001 evaluator remain
  deferred.
- No real model/provider is approved or connected.
- `npm audit` reports six moderate dependency findings; no forced breaking upgrade
  was applied during this feature slice.

## Exact Resume Point

Provide a real local `SEC_USER_AGENT`, run the opt-in live-source smoke, and retain
its evidence. Continue IDX endpoint validation without guessed endpoints or
access-control workarounds. Do not reopen cloud-provider selection until a
separate provider/security gate is explicitly approved.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260704-001`
