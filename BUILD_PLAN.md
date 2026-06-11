# AI Investment Committee Build Plan

Source of truth: `PRODUCT_STRATEGY.md`.

This plan turns the current single-asset cockpit into the broader AI Investment
Committee product while preserving the local-first Next.js/Dexie architecture.

## Milestone 1 - IC Primitives + Frictionless Thesis Intake

Goal: make every analysis carry asset-agnostic investment committee memory.

Deliverables:
- Add IC primitives for Asset Type, Thesis, Assumption, Thesis Breaker, Evidence,
  Decision, Review, and IC Agenda readiness.
- Add asset type to each analysis without replacing the existing valuation
  vertical.
- Extend paste-first intake so it extracts thesis summary, assumptions, thesis
  breakers, watch items, valuation assumptions, catalysts, open questions, and
  evidence candidates.
- Require user confirmation before extracted thesis memory is saved.
- Surface saved thesis memory in the existing cockpit inspector.

Exit criteria:
- Public equities, startups, and conventional businesses share the same IC
  memory shape.
- Legacy saved analyses normalize into the new shape.
- Intake can produce a confirmed thesis record even when valuation figures are
  incomplete.

## Milestone 2 - Manual Private Asset IC Entry

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

Goal: prevent weak or uncited numbers from becoming locked valuation figures.

Deliverables:
- Add field-level provenance for market price, EPS, ROE, and other auto-filled
  stock figures.
- Separate sourced facts, inferred candidates, user assumptions, and defaults.
- Normalize Indonesian tickers to IDX conventions where needed.
- Require source title, URL, period/timestamp, confidence, and value type before
  a figure can be locked.

Exit criteria:
- Search snippets cannot lock valuation numbers.
- Low-confidence values become confirmation candidates, not facts.

## Milestone 4 - Evidence Locker Primitives

Goal: reframe the library as evidence tied to theses.

Deliverables:
- Store evidence items with type, source, date, reliability, and linked thesis.
- Classify evidence as supporting, contradictory, neutral, or unresolved.
- Link files, URLs, notes, screenshots, PDFs, pitch decks, and memos to thesis
  memory.
- Show evidence linkage in the thesis detail page.

Exit criteria:
- Every confirmed thesis can point to the evidence supporting or challenging it.
- Evidence can exist before a full valuation model exists.

## Milestone 5 - Watchlist IC Agenda + Assumption Monitoring

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

Goal: preserve decisions and evaluate decision quality over time.

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
