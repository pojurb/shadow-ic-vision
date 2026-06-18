# Milestone 1 Specification: IC Primitives + Frictionless Thesis Intake

## Summary

M1 closes the core IC memory foundation for engine-backed analyses. Every
public equity, startup, and conventional business analysis should carry the same
asset-agnostic thesis memory and review state, and legacy saved records should
normalize into that shape without a schema migration.

Non-goals:

- Do not add a new review-history system, review notes, or dedicated review
  mode.
- Do not redesign Library or Agenda surfaces in this slice.
- Do not add automated data feeds or new valuation behavior.

## Product And UX Contract

- The analysis inspector shows saved thesis memory from confirmed intake:
  summary, assumptions, breakers, watch items, valuation assumptions, catalysts,
  open questions, evidence candidates, and conviction.
- The existing review cadence card remains the editing surface for cadence,
  next review due, and last reviewed.
- The review card must make review state visible at a glance with an upcoming,
  due today, overdue, or no-date label.
- "Mark reviewed today" updates `lastReviewedAt`.
- Weekly, monthly, and quarterly cadence advance `nextReviewDue` by their fixed
  review windows.
- `event_driven` is manual due-date mode: it has no automatic recurrence, but a
  user-set due date remains valid and continues to feed Agenda.

## Engineering Contract

- Keep `Analysis.ic` as the canonical persisted IC memory object.
- Keep `ICState.review` shape unchanged: `cadence`, `lastReviewedAt`, and
  `nextReviewDue`.
- Add only pure helper logic for review recurrence and normalization hardening;
  no Dexie version bump is required.
- Normalize old or malformed `ic`, `thesis`, and `review` values into the
  current safe shape on read.
- Preserve all existing M2-M6 fields, evidence, stock provenance, manual
  metadata, and decision history during normalization.

## Implementation Slices

1. Add the missing M1 packet and make M1 a first-class milestone in QA.
2. Extract/test review recurrence behavior, including manual `event_driven`
   due dates.
3. Polish the review card status and date context in `AnalysisView`.
4. Harden IC normalization tests for missing and malformed legacy records.
5. Add a canonical `m1` fixture and browser QA scenario, then include it in the
   full QA sweep.

## Verification

- Unit tests:
  - missing IC state backfills default thesis memory and weekly review
  - malformed thesis/review values normalize safely
  - recurring cadence advances after marking reviewed
  - `event_driven` preserves the manually set due date
  - `normalizeAnalysis` remains idempotent and preserves later milestone data
- Browser QA:
  - `node scripts/run.js qa m1`
  - full `node scripts/run.js qa`
  - verify thesis memory renders, review status is visible, review edits persist
    after reload, and `event_driven` due date remains manual
- Global gates:
  - `npm test`
  - `npm run lint`
  - `npm run build`

## Assumptions And Deferrals

- Browser QA may use the documented fallback Edge/CDP harness because the
  in-app browser helper is intentionally deferred.
- Review history and outcome-quality tracking remain M6 territory.
- Cross-workspace ranking and monitoring remain M5 territory; M1 only makes the
  review state clean and reliable enough to feed later surfaces.
