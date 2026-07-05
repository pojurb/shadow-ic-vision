# M001 Live Official-Source Implementation Evidence

Updated: 2026-07-05

Base commit: `bb8e8c8` (verification performed on an uncommitted working tree)

Outcome: `implementation-verified; SEC/IDX/issuer retrieval live-validated`

## Scope

- Live SEC and official IDX source adapters.
- Bounded official issuer investor-relations fallback.
- Allowlisted outbound HTTP behavior and immutable source snapshots.
- Deterministic HTML and text-layer PDF extraction.
- Exact source matching with pending interpretation and unchanged assumptions.
- Incremental daily local ingestion with cursors, leases, deduplication, and
  discovery provenance.
- Protected cron/manual refresh endpoints and Windows Task Scheduler-compatible CLI.

## Verification

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | Pass |
| ESLint `eslint .` | Pass |
| Vitest | 40 pass; 3 live checks skipped by default |
| Next.js production build | Pass |
| Playwright Edge | 2 pass |
| Live SEC filing retrieval and SHA-256 | Pass |
| Live IDX attachment retrieval and SHA-256 | Pass |
| Live official BRI fallback retrieval and SHA-256 | Pass |
| Incremental refresh and snapshot deduplication | Pass |
| Cursor, lease, overlap rejection, and unchanged assumptions | Pass |
| Direct local scheduler command against temporary SQLite | Pass |
| Intended local database refresh | Pass; zero tracked companies present |
| Windows task registration and manual execution | Pass; result code `0`, next run 2026-07-06 08:00 Asia/Jakarta |

## Retained Browser Evidence

- [Desktop deterministic exact evidence](desktop-pltr-verified.png)
- [Narrow Research drawer](narrow-research-drawer.png)
- [Earlier IDX fail-closed state](live-idx-degraded.png)

The IDX degradation screenshot is retained as historical recovery-state evidence;
the current official IDX API now passes live retrieval.

## Known Limits

- The local scheduled task passed a manual Task Scheduler execution; its first
  automatic execution has not yet occurred.
- Secondary sources, OCR, vision, XBRL, model interpretation, provider approval,
  Decision Library, and export/import remain incomplete or deferred as governed.
- `npm audit` reports six moderate dependency findings; no forced breaking
  upgrade was applied.

## Rollback

Disable or remove the Windows scheduled task and return
`RESEARCH_SOURCE_MODE` to `mock`. If code rollback is required, revert the
periodic-ingestion adapters and migration together; preserve existing snapshot
bytes and database backups until rollback integrity is verified.
