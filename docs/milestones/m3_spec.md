# Milestone M3 Specification: Stock Intake Trust + Field Provenance

## Summary

- Outcome: prevent weak or uncited stock numbers from becoming locked valuation
  inputs.
- Scope: public-equity intake plus the stock confirm-and-lock flow.
- Status: Slice 1 and Slice 2 are now implemented and verified.
- Non-goals:
  - do not build the full qualitative Evidence Locker here
  - do not expand M3 into broader non-stock asset intake

## Product And UX Contract

- Stock intake must distinguish:
  - user-provided facts
  - sourced facts
  - confirmation candidates
  - derived helper values
  - legacy non-audited values
- Search snippets alone must never become lockable stock figures.
- Auto-filled stock values with incomplete provenance or weak confidence must
  stay candidates until the user explicitly confirms them as user-provided.
- The stock confirm card must show provenance context inline before values are
  locked.
- Saved stock analyses must remain readable even when they predate field-level
  provenance.

## Engineering Contract

- Add stock field domain types for provenance, confidence, source kind, origin,
  and lockability.
- Extend intake schema so stock fields can carry provenance.
- Keep `finalizeIntake()` as the validation seam for:
  - stock key allowlists
  - numeric coercion and unit normalization
  - provenance normalization
  - lockable sourced-fact classification
  - candidate fallback when provenance is incomplete
- Persist stock field records on analyses.
- Normalize legacy saved stock analyses into non-audited stock field records on
  read.

## Implementation Slices

### Slice 1 - Implemented

- Added stock field provenance/domain helpers and persisted `analysis.stockFields`.
- Extended intake schema and `finalizeIntake()` for stock provenance-aware
  classification.
- Kept incomplete or low-confidence stock figures out of locked engine params.
- Stored derived stock `invested` as a derived candidate.
- Wired stock field records through the confirm flow, including manual promotion
  to user-provided locked values.
- Updated intake tests, repo normalization tests, and eval fixtures.
- Verification passed:
  - `npm test`
  - `npm run build`

### Slice 2 - Implemented

- Ran browser QA for:
  - clean cited stock evidence
  - price-only / partial-evidence stock intake
  - explicit user confirmation of uncited candidates
  - reload persistence of saved stock provenance
- Tightened the stock confirm card so sourced, candidate, and user-provided
  rows now read as distinct provenance states before lock.
- Tightened the saved-analysis inspector so stock fields render with origin
  badges, readable source context, and compact provenance metadata on desktop
  and mobile.

## Verification

- Unit/integration:
  - stock provenance payload normalization
  - incomplete provenance downgraded to candidates
  - sourced stock facts lock only with complete provenance
  - legacy stock analyses normalize safely
- Regression:
  - `npm test`
  - `npm run build`
- Browser QA passed on the built app using local Microsoft Edge headless via
  CDP against `http://127.0.0.1:3002`, because the existing `127.0.0.1:3000`
  dev-session/HMR path was noisy for automation in this environment.
- Acceptance evidence:
  - cited `price` and `eps` rendered as `cited source`, showed source context
    inline before lock, and persisted as `sourced_fact`
  - incomplete `price` provenance stayed `needs confirmation`, offered explicit
    promotion, and did not overwrite the locked engine `price` parameter when
    left unconfirmed
  - manual promotion of an uncited `price` converted that field into
    `user_fact` / `user provided` and locked it into engine parameters
  - reload preserved saved `stockFields` provenance in the inspector,
    including `user provided`, `cited source`, and derived-helper rows

## Assumptions And Deferrals

- `price`, `eps`, and `roe` are the primary stock fields for provenance in this
  slice; `invested` is derived when needed.
- Full evidence-linking workflows remain in M4.
- Additional stock fields can be added to this provenance model later if M3 QA
  shows they are needed.
