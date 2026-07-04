# M001 Live Official-Source Implementation Evidence

Date: 2026-07-04

Base commit: `ebacecc` (verification performed on an uncommitted working tree)

Outcome: `implementation-verified; live validation partial`

## Scope

- Live SEC and fail-closed IDX source adapters.
- Allowlisted outbound HTTP behavior and immutable source snapshots.
- Deterministic HTML and text-layer PDF extraction.
- Exact source matching with pending interpretation and unchanged assumption status.
- Mock sources retained as the default deterministic QA path.

## Verification

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | Pass |
| ESLint `eslint .` | Pass |
| Vitest | 36 pass; 2 opt-in live tests skipped by default |
| Next.js production build | Pass; no trace warnings |
| Playwright Edge mock success | Pass |
| Playwright Edge live-IDX degraded UI | Pass; Retry visible; zero Evidence |
| Live IDX official-page request | HTTP 403; mapped to `idx_source_unavailable` as designed |
| Live SEC request | Not run; real `SEC_USER_AGENT` contact not supplied |

## Retained Browser Evidence

- [Desktop deterministic exact evidence](desktop-pltr-verified.png)
- [Narrow Research drawer](narrow-research-drawer.png)
- [Live IDX fail-closed state](live-idx-degraded.png)

## Known Limits

- The live-source phase remains open until SEC succeeds in the opt-in smoke and a
  stable permitted anonymous IDX disclosure route is validated.
- Secondary fallback, OCR, vision, XBRL, model interpretation, provider approval,
  Decision Library, and export/import remain deferred.
- `npm audit` still reports six moderate dependency findings; no forced breaking
  upgrade was applied.

## Rollback

Return `RESEARCH_SOURCE_MODE` to `mock`. If code rollback is required, revert the
live-source adapters and migration together; preserve existing snapshot bytes and
database backups until rollback integrity is verified.
