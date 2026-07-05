# Active Milestone

Status: `implementation`

Active Packet: [`docs/milestones/M001-existing-thesis-loop.md`](docs/milestones/M001-existing-thesis-loop.md)

## Current Phase

M001 implementation — periodic local official-source ingestion is implemented
and live-validated.

The deterministic mock workflow remains the default QA path. The live research
slice now provides SEC filing retrieval, official IDX announcement retrieval,
bounded official issuer fallback, immutable snapshots and provenance, exact
verification, incremental cursors, idempotent refresh, and local daily scheduling.

Periodic ingestion is local-only under ADR-0006. It runs through
`npm run research:refresh` or Windows Task Scheduler and writes to the external
SQLite database. No private research data or SQLite worker is deployed to Vercel.

## Fresh Verification

- TypeScript: pass
- ESLint: pass
- Vitest: 40 pass; 3 live checks skipped in the default suite
- Next.js production build: pass
- Playwright Edge: 2 pass
- Live smoke: SEC, IDX, and official BRI issuer fallback all retrieved and hashed
- Migration and scheduler integration: pass, including deduplication, cursors,
  leases, recovery, and unchanged assumption status
- Direct local scheduler command against temporary SQLite: pass
- Intended local database refresh: pass; zero tracked companies were present
- Windows task registration and manual Task Scheduler execution: pass; result
  code `0`, next run 2026-07-06 08:00 Asia/Jakarta

These results close the SEC/IDX/issuer retrieval validation gap. M001 remains
open because the Decision Library, export/import, final evaluator, and accepted
multimodal OCR/vision/XBRL scope are not complete.

## Next Step

1. Commit the verified periodic-ingestion checkpoint.
2. Observe the first automatic Windows task execution.
3. Continue the remaining M001 scope without connecting an unapproved provider.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260704-001`
