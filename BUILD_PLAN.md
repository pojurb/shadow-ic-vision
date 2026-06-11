# AI Investment Committee Build Plan

Source of truth: `PRODUCT_STRATEGY.md`.

This plan turns the current single-asset cockpit into the broader AI Investment
Committee product while preserving the local-first Next.js/Dexie architecture.

## Latest Status - 2026-06-11

The app has moved beyond the original single-asset cockpit. It now supports
thesis intake, IC thesis memory, grounded debate, portfolio composition,
cross-asset chat, export/import, and improved stock-intake guardrails.

Current milestone status:

| Milestone | Status | Notes |
|---|---|---|
| M1 - IC Primitives + Frictionless Thesis Intake | Mostly implemented | IC state, thesis memory, review defaults, intake extraction, user confirmation, and inspector display exist. |
| M2 - Manual Private Asset IC Entry | Not implemented | Asset-type enums/labels exist, but the UI still creates only the three valuation verticals. |
| M3 - Stock Intake Trust + Field Provenance | Partial | Ticker search and weak-value guardrails improved, but lockable figures still do not carry full cited provenance. |
| M4 - Evidence Locker Primitives | Partial primitives only | Evidence candidates exist in thesis memory; no first-class evidence locker/table/workflow yet. |
| M5 - Watchlist IC Agenda + Assumption Monitoring | Not implemented | Review cadence is stored, but there is no agenda ranking or monitoring engine. |
| M6 - Decision Ledger + Review Loop | Not implemented | `ICAction` exists in types, but the live UI/storage still use legacy `APPROVE/HOLD/REJECT`. |

Recommended next build order:

1. Finish this documentation/status alignment.
2. Implement M6 Decision Ledger + Review Loop.
3. Finish M3 field-level stock provenance so decisions can link to trustworthy facts.
4. Promote M4 evidence candidates into a first-class Evidence Locker.
5. Build M5 IC Agenda and assumption monitoring on top of decisions/evidence.

## Milestone 1 - IC Primitives + Frictionless Thesis Intake

Status: mostly implemented.

Goal: make every analysis carry asset-agnostic investment committee memory.

Implemented:

- IC primitives for asset type, thesis memory, assumptions, thesis breakers,
  watch items, valuation assumptions, catalysts, open questions, evidence
  candidates, conviction, and review state.
- `assetType` exists beside the valuation `vertical`.
- Paste-first intake extracts thesis memory and valuation candidates.
- User confirmation is required before thesis memory and figures are saved.
- Saved thesis memory is surfaced in the analysis inspector.
- Legacy analyses normalize into the new IC shape.

Remaining:

- Polish review-state editing and visibility.
- Continue hardening old-record normalization as new IC fields are added.

Exit criteria:

- Public equities, startups, and conventional businesses share the same IC
  memory shape.
- Legacy saved analyses normalize into the new shape.
- Intake can produce a confirmed thesis record even when valuation figures are
  incomplete.

## Milestone 2 - Manual Private Asset IC Entry

Status: not implemented.

Goal: support non-public/manual assets in the same workflow without pretending
automated data coverage exists.

Deliverables:

- Add manual asset-type flow for Conventional Business, Startup, Real Estate,
  Crypto, Macro View, and Other.
- Capture manual valuation, valuation date, valuation source, pricing freshness,
  liquidity, duration, portfolio role, sizing intent, and macro dependencies.
- Add risk-officer prompts by asset type.
- Keep automated feeds disabled for non-public/manual assets.

Exit criteria:

- Manual assets can appear beside public equities in the same IC agenda data
  structure.
- The UI clearly labels manual valuation freshness, liquidity, and duration.

## Milestone 3 - Stock Intake Trust + Field Provenance

Status: partial.

Goal: prevent weak or uncited numbers from becoming locked valuation figures.

Implemented:

- Indonesian ticker shorthand is normalized into focused IDX-style search
  queries where possible.
- Search result snippets are no longer the only context; the intake path can
  fetch market quote/chart data and top search-result pages.
- Partial public-equity data no longer automatically becomes a valuation; stock
  intake stays in scoping unless required fields survive extraction.
- `discountRate`, `terminalMult`, and buy price remain user assumptions unless
  explicitly supplied.

Remaining:

- Add field-level provenance for market price, EPS, ROE, and other auto-filled
  stock figures.
- Separate sourced facts, inferred candidates, user assumptions, and defaults in
  stored data, not only in prompt behavior.
- Require source title, URL, period/timestamp, confidence, and value type before
  a figure can be locked.

Exit criteria:

- Search snippets cannot lock valuation numbers.
- Low-confidence values become confirmation candidates, not facts.
- Every lockable stock figure has auditable provenance.

## Milestone 4 - Evidence Locker Primitives

Status: partial primitives only.

Goal: reframe the library as evidence tied to theses.

Implemented:

- Thesis memory can store evidence candidates with type, relation, reliability,
  URL, and notes.
- Files and links can be attached to analyses.

Remaining:

- Store evidence items as first-class records with type, source, date,
  reliability, and linked thesis.
- Classify evidence as supporting, contradictory, neutral, or unresolved.
- Link files, URLs, notes, screenshots, PDFs, pitch decks, and memos to thesis
  memory.
- Show evidence linkage in the thesis detail page.

Exit criteria:

- Every confirmed thesis can point to the evidence supporting or challenging it.
- Evidence can exist before a full valuation model exists.

## Milestone 5 - Watchlist IC Agenda + Assumption Monitoring

Status: not implemented.

Goal: make the dashboard answer what deserves attention.

Deliverables:

- Aggregate analyses into an IC agenda queue.
- Add review cadence, last reviewed date, next review due, stale threshold, and
  assumption-pressure signals.
- Flag thesis breakers, stale theses, contradiction pressure, valuation drift,
  and shared macro exposure.
- Avoid generic news or price alerts unless they intersect with a thesis object.

Exit criteria:

- The top-level view ranks attention needs across public and manual assets.
- Monitoring reasons cite the relevant assumption, breaker, valuation condition,
  or exposure.

## Milestone 6 - Decision Ledger + Review Loop

Status: not implemented.

Goal: preserve decisions and evaluate decision quality over time.

Current state:

- `ICAction` exists in the domain types.
- The live decision UI still uses legacy `APPROVE`, `HOLD`, and `REJECT`.
- The persisted `Decision` shape only stores action, rationale, and timestamp.
- There is no pre-mortem, linked thesis/evidence snapshot, review trigger, or
  outcome review workflow.

Deliverables:

- Replace the old approve/hold/reject UI with IC action vocabulary.
- Require pre-mortem for Add / Increase Position decisions.
- Track decision rationale, linked thesis state, linked evidence, and review
  trigger.
- Add outcome review so decisions can be judged against later thesis evolution.

Exit criteria:

- Every committed decision stores why it was made and what would falsify it.
- The app can show whether the thesis was right for the right reason, wrong for
  the right reason, or merely lucky.
