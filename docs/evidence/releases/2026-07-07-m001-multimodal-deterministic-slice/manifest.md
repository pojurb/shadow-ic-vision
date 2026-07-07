# M001 Multimodal Deterministic Slice Evidence

Date: 2026-07-07

Branch: `main`

Base commit before working slice: `75b8d026ddcb77f3e1d7636f2c7869db7eb6ed6b`

Outcome: `implementation-verified; deterministic multimodal first slice passed`

## Scope

- Typed multimodal evidence classes: `exact_verified`, `ocr_matched`, and
  `derived`.
- Deterministic fixture-backed OCR, screenshot OCR, table/chart derivation,
  XBRL calculation, page-level quote provenance, large-document chunk
  provenance, embedded instruction detection, and mixed-language uncertainty.
- Persistence, DTO, export/import, and Research UI preservation of multimodal
  provenance fields.
- Deterministic M001 multimodal evaluator scaffold.
- No real OCR engine, vision model, cloud model, or provider approval.

## Commands And Results

| Check | Result |
|---|---|
| `npm run context:check` | Pass; code index current |
| `npm run status:check` | Pass; repository status contracts consistent |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass; 64 pass, 3 opt-in live checks skipped |
| `npm run build` | Pass |
| `npm run test:e2e` | Pass; 3 Playwright checks |
| `npm run verify:full` | Pass |
| `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json` | Pass; 16 base cases loaded, 16 multimodal addendum cases loaded, all 16 deterministic addendum cases passed |
| `git diff --check` | Pass |

## Browser Coverage

- Deterministic PLTR desktop and narrow Research drawer.
- Live-labelled IDX fail-closed UI without making a network request.
- OCR and derived trust-class labels visible in the Research drawer.

## Multimodal Evaluator Result

- Base M001 suite count: 16
- Multimodal addendum suite count: 16
- Deterministic addendum cases passed: 16
- Hard-gate failures: none
- Model eligibility: `not_evaluated`

## Known Limits

- This evidence proves deterministic application gates and fixture behavior.
- It does not approve a real model, OCR engine, vision engine, cloud provider,
  native browsing capability, or confidential-data processor.
- Confidential thesis, assumption, decision, portfolio, and user-provided data
  remain blocked from unapproved cloud providers.
- Secondary-source and general-news ingestion remain deferred.
- `test-results/` contains regenerated local run artifacts and is intentionally
  ignored by git; this manifest is the tracked evidence pointer.

## Rollback

Revert this working slice as a unit if multimodal deterministic handling must be
removed. Preserve existing live official-source ingestion and periodic scheduler
code unless rollback specifically targets those earlier verified features.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
