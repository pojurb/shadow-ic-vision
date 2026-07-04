# Active Milestone

Status: `implementation`

Active Packet: [`docs/milestones/M001-existing-thesis-loop.md`](docs/milestones/M001-existing-thesis-loop.md)

## Current Phase

M001 implementation — live official-source adapter slice, partially live-validated.

All product, evaluation, multimodal-amendment, and architecture gates through
ADR-0006 are accepted. The previously closed deterministic mock workflow remains
the default QA path. The implementation now also provides:

1. a `mock`/`live` research-source boundary with mock as the safe default;
2. SEC ticker-to-CIK, submissions, and primary-filing retrieval;
3. a fail-closed IDX official-page adapter with no guessed or secondary endpoint;
4. allowlisted, rate-limited, retried, logged, size-bounded outbound requests;
5. immutable content-addressed source snapshots outside the repository;
6. deterministic HTML and text-PDF extraction with exact citation verification;
7. explicit pending interpretation without auto-verifying an assumption; and
8. visible live/synthetic, source-error, page, extraction, and interpretation states.

## Fresh Verification

- TypeScript: pass
- ESLint: pass
- Vitest: 36 assertions pass; 2 opt-in live assertions skipped by default
- Next.js production build without a pre-existing database: pass
- Playwright Edge: deterministic PLTR success plus synthetic live-IDX fail-closed
  UI, narrow drawer, retry visibility, and retained screenshots pass
- Live IDX smoke: official page returned HTTP 403; adapter returned
  `idx_source_unavailable` with zero Evidence as designed
- Live SEC smoke: not run because no real `SEC_USER_AGENT` contact was supplied

These results verify the implementation and the IDX fail-closed boundary. They
do not close the live-source phase because SEC has not been live-smoke verified
and IDX has no validated anonymous disclosure route. M001 remains open.

## Next Step

1. Set a real `SEC_USER_AGENT` contact locally and run `npm run test:live-sources`
   to validate current SEC retrieval.
2. Validate a stable, permitted anonymous IDX disclosure route; until then keep
   the visible `idx_source_unavailable` degraded state.
3. Retain mock sources for deterministic QA and keep DEC-0009 deferred.
4. Treat secondary fallback, provider evaluation, OCR/vision/XBRL, Decision
   Library, export/import, and final M001 evaluation as separate phases.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260704-001`
