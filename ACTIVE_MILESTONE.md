# Active Milestone

Status: `implementation`

Active Packet: [`docs/milestones/M001-existing-thesis-loop.md`](docs/milestones/M001-existing-thesis-loop.md)

## Current Phase

M001 implementation - governed multimodal first slice is implemented and
verified with deterministic fixtures.

The deterministic mock workflow remains the default QA path. The live research
slice already provides SEC filing retrieval, official IDX announcement
retrieval, bounded official issuer fallback, immutable snapshots and
provenance, exact verification, incremental cursors, idempotent refresh, and
local daily scheduling.

The multimodal slice now preserves distinct evidence classes through extraction,
verification, persistence, export/import, API DTOs, and the Research UI:

- `exact_verified` for HTML and text-layer PDF source text matched against
  canonical extracted text.
- `ocr_matched` for retained OCR or screenshot text, never promoted to exact
  source text.
- `derived` for table, chart, XBRL, and deterministic calculation outputs with
  retained inputs, units, method, page, and provenance.

The evaluator scaffold reads the accepted base and multimodal M001 suites and
records deterministic first-slice readiness without approving or connecting any
real provider. No private thesis, assumption, decision, portfolio, or user data
is sent to an unapproved provider.

Periodic ingestion remains local-only under ADR-0006. It runs through
`npm run research:refresh` or Windows Task Scheduler and writes to the external
SQLite database. No private research data or SQLite worker is deployed to
Vercel.

## Fresh Verification

Latest full verification: 2026-07-07.

- Pushed commit:
  `c08aae19a311ab44c488bc87cba759d43795b970`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- Branch state: local `main` and `origin/main` aligned
- `npm run context:check`: pass
- `npm run status:check`: pass
- TypeScript `tsc --noEmit`: pass
- ESLint `eslint`: pass
- Vitest: 64 pass; 3 opt-in live checks skipped
- Next.js production build: pass
- Playwright: 3 pass
  - deterministic PLTR desktop and narrow Research drawer
  - live-labelled IDX fail-closed UI without a network request
  - OCR and derived trust-class labels visible in the Research drawer
- `npm run verify:full`: pass
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`: pass
  - base case count: 16
  - multimodal addendum case count: 16
  - all 16 deterministic multimodal addendum cases: pass
  - hard-gate failures: none
  - model eligibility: `not_evaluated`
- `git diff --check`: pass

Release evidence: [`docs/evidence/releases/2026-07-07-m001-multimodal-deterministic-slice/manifest.md`](docs/evidence/releases/2026-07-07-m001-multimodal-deterministic-slice/manifest.md)

## Remaining Boundaries

- M001 is not fully closed because real OCR/vision provider eligibility and
  production confidential-data provider approval remain unapproved and
  unconnected.
- [`DEC-0009`](docs/decisions/DEC-0009-provider-security-gate.md) is accepted
  as the POC provider/security gate. It makes external provider processing the
  default POC path, but does not approve production external processing or
  selectable model eligibility. Portfolio/position data, credentials, account
  screenshots, raw database exports, identity documents, and unrelated
  personal files remain blocked unless a later explicit decision allows them.
- The deterministic multimodal evaluator proves first-slice application gates;
  it does not approve a model, provider, cloud processor, or native browsing
  capability.
- Secondary-source and general-news ingestion remain deferred.
- `npm audit` previously reported six moderate dependency findings; no forced
  breaking upgrade was applied in this slice.

## Next Step

1. Implement the accepted DEC-0009 controlled POC external-provider gate with
   outbound logging, blocked secret classes, and evaluator coverage for the
   allowed data boundary.
2. Keep provider/model eligibility as `not_evaluated` until a later full eval
   report and production provider decision are recorded.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
