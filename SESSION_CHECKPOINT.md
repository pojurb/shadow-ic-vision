# Session Checkpoint — 2026-07-05

## Repository State

- Branch: `shadow-ic-vision`
- Implementation commit: `5376c59` (`feat: add periodic official-source ingestion`)
- Phase: M001 implementation
- Working scope: periodic local official-source ingestion
- Cloud provider decision `DEC-0009`: deferred
- Repository state after implementation commit: clean

## Implemented

- Preserved `RESEARCH_SOURCE_MODE=mock|live`; deterministic QA remains mock-first.
- Replaced the legacy IDX page scraper with the anonymous official
  `idx.id/primary/ListedCompany/GetAnnouncement` API.
- Added strict IDX attachment normalization from approved `idx.co.id/StaticData`
  paths to `idx.id`, with all other host/path rewrites rejected.
- Added bounded issuer investor-relations fallback for explicitly configured,
  official domains. Same-site report redirects are unwrapped only when their
  final PDF remains on the configured issuer domain.
- Added incremental refresh state: source cursors, immutable snapshot
  deduplication, discovery provenance, ingestion runs, and database-backed lease.
- Refreshes reuse research jobs, skip already-known source documents, suppress
  duplicate Evidence, and leave assumptions `untested` with interpretation
  `pending`.
- Added protected `/api/internal/research/cron`, manual
  `/api/research/refresh`, visible refresh status, and structured failure states.
- Added `npm run research:refresh` for a server-independent local run and a
  Windows Task Scheduler installer defaulting to 08:00 local time.
- Added backed-up additive migration `0003_typical_doomsday.sql`.
- Updated ADR-0006 to clarify that periodic ingestion remains local-only. No
  Vercel Cron or cloud SQLite worker is authorized.

## Verification Evidence

- `tsc --noEmit`: pass
- `eslint .`: pass
- `vitest run`: 40 pass; 3 opt-in live checks skipped by default
- `next build`: pass
- Playwright Edge: 2 pass
  - deterministic PLTR desktop and narrow Research drawer
  - live-labelled IDX fail-closed UI without a network request
- Opt-in live official-source smoke: 3 pass
  - SEC retrieved and hashed a current public PLTR filing
  - IDX retrieved and hashed an official BBRI disclosure attachment
  - BRI Investor Relations fallback retrieved and hashed an official report
- Migration integration: pass on temporary SQLite, including new ingestion tables,
  foreign keys, backup behavior, snapshot deduplication, and unchanged assumptions
- Scheduler behavior: idempotent refresh, cursor persistence, overlapping-run
  rejection, and cron bearer authentication pass deterministic tests
- Direct `npm run research:refresh` smoke against temporary SQLite: pass; no
  Next.js server required

## Remaining Boundaries

- The Windows scheduled task is installed. A manual Task Scheduler execution
  completed with result code `0`; the next automatic run is scheduled for
  2026-07-06 08:00 Asia/Jakarta.
- M001 remains open for Decision Library completion, export/import, final evaluator,
  and the accepted multimodal OCR/vision/XBRL work.
- No real model/provider is approved or connected.
- Secondary-source and general-news ingestion remain deferred.
- `npm audit` reports six moderate dependency findings; no forced breaking upgrade
  was applied.

## Exact Resume Point

1. Observe the first automatic task run on 2026-07-06 at 08:00 Asia/Jakarta.
2. Confirm the retained ingestion-run status.
3. Continue the remaining M001 scope.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260704-001`
