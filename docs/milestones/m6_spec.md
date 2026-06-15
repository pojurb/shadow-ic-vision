# Milestone 6 Specification: Decision Ledger + Review Loop

## Summary

M6 replaces the current single legacy `decision` record with an append-only
decision history for analyses and portfolios. Each committed decision captures
the action, rationale, required review trigger, optional pre-mortem, frozen
decision-time context, and one later outcome review.

Implementation status as of 2026-06-15: implemented and verified.
The domain model, helper tests, analysis ledger, portfolio ledger, Library
status derivation, legacy normalization, and backup round-trip coverage are in
place. `npm run lint -- --quiet`, `npm test` (19 files / 151 tests),
`npm run build`, and browser QA passed. Browser QA was completed through local
Playwright + Edge because the in-app browser helper still crashed during setup
after the local dev server reached ready state.

Non-goals for M6:

- Do not build the top-level IC Agenda or dashboard queue. That belongs to M5.
- Do not add automated monitoring, news alerts, or price triggers.
- Do not migrate old `APPROVE` / `HOLD` / `REJECT` actions into new `ICAction`
  values.

## Product And UX Contract

### Workflows

- In `AnalysisView` and `PortfolioView`, replace the legacy decision card with a
  Decision Ledger card.
- The user selects an `ICAction`, enters required rationale, and commits a new
  entry to `decisionHistory`.
- `add_increase_position` requires a pre-mortem before commit.
- Every action except `archive` requires a review trigger date and trigger note.
- `archive` stores `trigger: null`; the UI must not ask for a trigger.
- Decision history is shown newest-first. Each entry shows action, rationale,
  trigger state, snapshot summary, legacy label when applicable, and review
  state.
- A decision whose `trigger.dueAt` is in the past and has no `review` is marked
  as review due on its analysis/portfolio detail surface and any existing
  Library badge/filter surface touched by M6.
- The user can add exactly one outcome review to a decision entry:
  - outcome: `worked` | `mixed` | `did_not_work` | `unresolved`
  - reasoning assessment: `right_right_reason` | `wrong_right_reason` |
    `lucky` | `unclear`
  - notes: required free text

### Action Vocabulary

Use the existing `ICAction` vocabulary:

- `no_action`
- `watch`
- `research_more`
- `increase_conviction`
- `decrease_conviction`
- `add_increase_position`
- `trim_reduce_position`
- `exit`
- `archive`

### Derived Status

Status is derived from the newest decision entry. Do not store a separate status
field on `PortfolioAnalysis`.

- No entries -> `draft`
- Latest current action is `watch` -> `watching`
- Latest current action is `archive` -> `archived`
- Latest current action is any other `ICAction` -> `decided`
- Latest legacy-only action preserves `legacyAction` for display and derives a
  compatibility badge/status:
  - `APPROVE` -> `decided`
  - `HOLD` -> `watching`
  - `REJECT` -> `archived`

## Engineering Contract

### Domain Types

Add decision-history types in `app/src/lib/domain/types.ts` and attach
`decisionHistory: DecisionEntry[]` to both `Analysis` and `PortfolioAnalysis`.
Keep the legacy `decision` field readable for compatibility until older records
are normalized.

```typescript
export interface DecisionOutcomeReview {
  reviewedAt: number;
  outcome: "worked" | "mixed" | "did_not_work" | "unresolved";
  reasoningAssessment: "right_right_reason" | "wrong_right_reason" | "lucky" | "unclear";
  notes: string;
}

export type DecisionSnapshot =
  | { kind: "analysis"; data: AnalysisDecisionSnapshot }
  | { kind: "portfolio"; data: PortfolioDecisionSnapshot }
  | { kind: "legacy"; data: LegacyDecisionSnapshot };

export interface DecisionEntry {
  id: string;
  decidedAt: number;
  action: ICAction | null;
  legacyAction?: DecisionAction;
  rationale: string;
  preMortem?: string;
  trigger: { dueAt: number; note: string } | null;
  snapshot: DecisionSnapshot;
  review: DecisionOutcomeReview | null;
}
```

Snapshot shape:

- `AnalysisDecisionSnapshot` stores the real decision-time analysis state needed
  for later review: title, asset type, vertical, thesis memory, review state,
  locked metrics, stance, sources, and current evidence candidates/source refs.
- `PortfolioDecisionSnapshot` stores title, members, member capital, derived
  weights, linked analysis ids, member stance labels, portfolio metrics,
  portfolio stance, and tags.
- `LegacyDecisionSnapshot` stores only known legacy context:
  `reason: "legacy_decision_without_snapshot"` and `capturedAt`. Do not invent
  metrics, verticals, thesis text, or sources for legacy entries.

### Helpers

Add pure helpers for:

- validating decision input
- building analysis and portfolio decision snapshots
- normalizing legacy/current decision history
- deriving latest decision and display status
- adding one outcome review to a decision entry

Validation defaults:

- trim strings before validation
- rationale is required for every new decision
- pre-mortem is required only for `add_increase_position`
- trigger date and note are required for every action except `archive`
- review notes are required
- a decision with an existing review rejects a second review

### Normalization And Compatibility

- Normalization must be idempotent.
- If `decisionHistory` exists, preserve it and normalize malformed missing
  optional fields conservatively.
- If only legacy `decision` exists, expose a one-entry legacy history with:
  `action: null`, preserved `legacyAction`, preserved rationale, preserved
  `decidedAt`, `trigger: null`, `review: null`, and a legacy snapshot.
- Read normalization must not write back to IndexedDB by itself. Persistent
  write-back can happen only through explicit save/import/migration flows.
- All timestamps are UTC epoch milliseconds.
- Export/import must preserve `decisionHistory`, snapshots, triggers, and
  outcome reviews.

## Implementation Slices

1. Domain and helper slice:
   Add types, validation helpers, snapshot builders, status derivation, and
   normalization tests.
2. Analysis ledger slice:
   Replace the analysis decision UI, append new entries, render history, and add
   outcome review flow.
3. Portfolio ledger slice:
   Add the same ledger behavior to portfolios using portfolio snapshots and
   derived portfolio status badges.
4. Persistence and library slice:
   Ensure export/import round-trip, Library badges/filters, and due-review
   indicators use decision history.
5. Verification slice:
   Complete unit tests, integration coverage, and browser QA for analysis,
   portfolio, and legacy scenarios.

## Verification

Automated tests:

- legacy `decision` normalizes into one history entry without fabricated facts
- normalization is idempotent for legacy and current records
- validation rejects missing rationale, missing pre-mortem, missing required
  trigger, and second outcome review
- `archive` commits with `trigger: null`
- status derivation works for current and legacy entries
- analysis snapshots freeze thesis, review state, metrics, stance, sources, and
  evidence candidate refs
- portfolio snapshots freeze members, weights, metrics, stance, and linked
  analysis ids
- export/import preserves decision history, snapshots, triggers, and reviews

Browser checks:

- commit an analysis decision and see newest-first history
- commit a portfolio decision and see derived status/badge behavior
- add an outcome review to a due decision
- verify invalid forms block commit with clear field-level feedback
- confirm legacy decisions render as legacy entries without new-action mapping

Acceptance criteria:

- No live UI path still creates legacy `APPROVE` / `HOLD` / `REJECT` decisions.
- Analyses and portfolios can both commit, display, and review decisions.
- Due-review state is visible without relying on the future M5 agenda.
- Backup/export/import preserves M6 data losslessly.
- M6 passes the global quality gates in `EXECUTION_PLAN.md`.

## Assumptions And Deferrals

- M6 uses the current local-first Dexie architecture.
- M6 does not require a Dexie version bump unless implementation proves
  normalize-on-read plus explicit save/import handling is insufficient.
- M6 does not change runtime AI model/provider configuration.
- Top-level agenda ranking, cross-asset prioritization, and portfolio-wide
  attention queue behavior are deferred to M5.
