# Session Checkpoint - 2026-07-07

## Repository State

- Branch: `main`
- Base commit before this working slice: `75b8d026ddcb77f3e1d7636f2c7869db7eb6ed6b`
- Published commit:
  `c08aae19a311ab44c488bc87cba759d43795b970`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- Phase: M001 implementation
- Working scope: governed multimodal deterministic first slice
- Cloud provider/security decision `DEC-0009`: accepted for POC only
- Provider/model eligibility: `not_evaluated`
- Working tree: clean after push; local `main` and `origin/main` are aligned

## Implemented This Session

- Added typed multimodal evidence candidates and pipeline results for
  `exact_verified`, `ocr_matched`, and `derived`.
- Added page-level quote provenance checking so a correct quote on the wrong
  page is blocked.
- Added deterministic helper boundaries for:
  - fixture OCR and screenshot OCR
  - chart/table-derived evidence
  - XBRL gross-margin calculation
  - large-document chunk selection with page provenance
  - embedded document/image instruction detection
  - mixed-language uncertainty handling
- Preserved multimodal fields through persistence, DTOs, export/import, and
  Research UI display: `contentKind`, `sourceVariant`, `boundingBox`, metadata,
  document hash, canonical text hash, source format, extraction method, and
  verification class.
- Updated the Research drawer to show distinct `Exact source match`,
  `OCR matched`, and `Derived` badges plus warnings for OCR/derived evidence.
- Added `npm run eval:m001:multimodal` and the deterministic M001 multimodal
  evaluator scaffold.
- Expanded browser QA to cover OCR and derived trust-class rendering.
- Regenerated `docs/generated/code-index.json`.
- Added release evidence manifest:
  [`docs/evidence/releases/2026-07-07-m001-multimodal-deterministic-slice/manifest.md`](docs/evidence/releases/2026-07-07-m001-multimodal-deterministic-slice/manifest.md)

## Verification Evidence

Latest full verification: 2026-07-07.

- `npm run context:check`: pass
- `npm run status:check`: pass
- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: pass
  - 64 tests passed
  - 3 opt-in live checks skipped
- `npm run build`: pass
- `npm run test:e2e`: pass
  - 3 Playwright checks passed
  - deterministic PLTR desktop and narrow drawer
  - live-labelled IDX fail-closed state
  - OCR and derived trust-class labels
- `npm run verify:full`: pass
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`: pass
  - base case count: 16
  - multimodal addendum case count: 16
  - all 16 deterministic multimodal addendum cases passed
  - `hardGateFailures: []`
  - `modelEligibility: not_evaluated`
- `git diff --check`: pass

## Remaining Boundaries

- No real OCR engine, vision model, local model, or production cloud provider
  was approved or connected in this slice.
- [`DEC-0009`](docs/decisions/DEC-0009-provider-security-gate.md) is accepted
  as the POC provider/security gate. It authorizes external provider
  processing as the POC default, while keeping production use and selectable
  model eligibility separately gated.
- The multimodal evaluator currently proves deterministic application gates and
  fixture behavior only. It does not approve selectable product models.
- DEC-0009 proposes POC external processing for workflow confidential data
  through the configured provider boundary only. Portfolio/position data,
  credentials, account screenshots, raw database exports, identity documents,
  unrelated personal files, production external processing, and selectable
  model eligibility remain blocked until later explicit decisions.
- Secondary-source and general-news ingestion remain deferred.
- `npm audit` previously reported six moderate dependency findings; no forced
  breaking upgrade was applied in this slice.

## Exact Resume Point

1. Implement the accepted DEC-0009 controlled POC external-provider gate with
   outbound logging, blocked secret classes, and evaluator coverage.
2. Keep `modelEligibility: not_evaluated` and do not carry POC external
   processing into production until a production provider decision is accepted.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
