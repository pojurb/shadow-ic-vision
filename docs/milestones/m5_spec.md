# Milestone 5 Specification: IC Agenda Dashboard + Assumption Monitoring

## Summary

M5 makes the workspace answer what deserves attention now. It adds a derived,
explainable IC Agenda that ranks analyses and portfolios using the thesis,
evidence, review cadence, stance, and decision data already saved in the local
workspace.

M5 is intentionally schema-light. The agenda is a read model computed on demand
 from current analyses and portfolios. It does not add background jobs,
 persisted agenda rows, generic alerts, or new portfolio review-cadence fields.

Implementation status as of 2026-06-17: implemented, verified through
`npm test`, `npm run lint`, `npm run build`, and the canonical
`node scripts/run.js qa` sweep with retained evidence at
`issues/qa/2026-06-17T08-58-14-514Z/report.json`.

Non-goals for M5:

- Do not add automated scraping, notifications, or scheduled refresh jobs.
- Do not add a dedicated agenda table or Dexie version bump for v1.
- Do not add portfolio-level `ic.review` fields in v1.
- Do not add generic news or price-alert reasons disconnected from thesis
  objects, decision triggers, or saved exposure signals.

## Product And UX Contract

### Workspace Entry And Navigation

- The Agenda becomes the default home view when the user is not inside an
  analysis or portfolio.
- The sidebar gets a first-class `Agenda` entry so the user can return to the
  ranked queue after opening a record.
- The existing Library remains intact as the lightweight browser for analyses
  and portfolios. M5 does not replace Library filtering or record browsing.
- The current empty-home affordances stay available inside the Agenda home:
  `+ NEW ANALYSIS`, `+ MANUAL ASSET`, and `+ PORTFOLIO` remain one click away.

### Queue Behavior

- The Agenda shows a ranked queue, not just counts or passive groups.
- Each row shows:
  - target title / asset name
  - target kind and asset type
  - derived current status and latest decision summary
  - review-due or follow-up-due state when present
  - top plain-language reasons explaining why the item is ranked here
- Clicking a row opens the target analysis or portfolio detail view.

### Agenda Filters

M5 v1 supports visible filters for:

- `due now`
- `stale`
- `contradictory evidence`
- `valuation drift`
- `shared exposure`
- `watching`
- `decided`
- `archived`

Filters narrow the ranked queue. They do not replace the underlying deterministic
priority order.

### Plain-Language Reasons

Every surfaced reason must be readable without opening implementation details.
Examples:

- `Review overdue by 10 days`
- `Contradictory evidence linked to deposit-cost assumption`
- `Last decision follow-up is overdue`
- `Valuation stance drifted from UNDERVALUED to FAIR since the latest decision`
- `Shares macro exposure with 2 other names`

Shared exposure may appear as a reason and a filter in v1, but M5 does not
require a separate cluster visualization yet.

## Engineering Contract

### Derived Domain Layer

Add a pure agenda domain module with the following contract:

```typescript
type AgendaTarget = { kind: "analysis" | "portfolio"; id: string };

type AgendaReasonCategory =
  | "review_due"
  | "stale_thesis"
  | "thesis_breaker_pressure"
  | "contradiction_pressure"
  | "valuation_drift"
  | "conviction_review"
  | "shared_macro_exposure"
  | "decision_follow_up";

interface AgendaReason {
  category: AgendaReasonCategory;
  message: string;
  score: number;
  refs: {
    thesisTarget?: string;
    thesisId?: string | null;
    evidenceId?: string;
    decisionId?: string;
    relatedTargetIds?: string[];
  };
}

interface AgendaItem {
  target: AgendaTarget;
  title: string;
  assetType: AssetType | "portfolio";
  status: AnalysisStatus;
  latestDecisionSummary: string | null;
  reviewDueAt: number | null;
  followUpDueAt: number | null;
  reasons: AgendaReason[];
  priorityScore: number;
}
```

The agenda module must stay deterministic and testable. The UI may sort by
`priorityScore`, but visible ranking must always be explainable from the
attached reasons.

### Inputs And Signal Rules

Analyses use `analysis.ic.review` directly.

Portfolios do not gain new review fields in v1. Portfolios join the queue only
through:

- overdue decision follow-up from latest `decisionHistory[].trigger.dueAt`
- portfolio stance / concentration drift vs the latest portfolio decision
  snapshot
- shared exposure overlap with analyses or other portfolios

Required signal behavior:

- `review_due`
  - triggered when `ic.review.nextReviewDue` is in the past
- `stale_thesis`
  - triggered when review is overdue by the default stale threshold of 7 days
- `contradiction_pressure`
  - derived from evidence relation mix, weighted toward contradictory and
    unresolved evidence
- `thesis_breaker_pressure`
  - triggered by active breakers plus contradictory evidence or unresolved watch
    items
- `valuation_drift`
  - derived from current saved stance/metrics vs latest decision snapshot for
    analyses and portfolios
- `conviction_review`
  - triggered when saved conviction remains high/medium while stale,
    contradictory, or weak-evidence conditions are present
- `shared_macro_exposure`
  - derived from overlapping assumptions, watch items, valuation assumptions,
    tags, and manual-asset `manualMeta.macroDependencies`
- `decision_follow_up`
  - triggered from overdue `latestDecision.trigger.dueAt`

### Data And Compatibility Rules

- No Dexie version bump for M5.
- No persisted agenda rows or agenda cache table.
- No new review fields on `PortfolioAnalysis` in v1.
- Analyses missing evidence, metrics, manual metadata, or decision history must
  degrade gracefully.
- Manual assets with `valuationMode: "manual"` must still produce agenda items
  using review, evidence, decision, and manual metadata inputs even when
  engine metrics are absent.
- Backup/export/import do not change because the agenda is recomputed from
  existing saved objects.

### Workspace Integration

- Extend main-pane state with an explicit `agenda` home view instead of treating
  the home surface as `null`.
- Default initial main-pane state to Agenda after bootstrap when no analysis or
  portfolio is opened.
- Keep analysis and portfolio routing unchanged once a row is opened from the
  queue.

## Implementation Slices

1. Packet and domain slice:
   add the milestone packet, agenda types, reason taxonomy, deterministic
   signal helpers, and ranking tests.
2. Compatibility slice:
   cover missing evidence/history/manual-metric scenarios and portfolio-only
   decision-follow-up/shared-exposure behavior.
3. Workspace slice:
   replace the empty home with Agenda, add the sidebar Agenda entry, preserve
   Library behavior, and keep creation affordances visible.
4. Agenda interaction slice:
   add row rendering, filters, and navigation into analyses or portfolios.
5. Verification slice:
   run automated gates and browser QA against mixed review/evidence/decision
   scenarios.

## Verification

Automated tests:

- review-due vs stale-threshold behavior
- contradiction pressure from supporting vs contradictory evidence mixes
- valuation drift against latest decision snapshot for analysis and portfolio
  targets
- shared macro exposure from assumptions, watch items, valuation assumptions,
  tags, and manual-asset macro dependencies
- decision follow-up from overdue `trigger.dueAt`
- explainable ranking order when multiple reasons compete
- analyses missing evidence or decision history degrade gracefully
- manual assets with `valuationMode: "manual"` still produce agenda items
- portfolios without review cadence still produce decision-follow-up and
  shared-exposure items
- Agenda home state and filters derive the expected visible queue

Browser checks:

- load analyses with mixed due dates, evidence relations, and decision states
- confirm overdue/stale items rank above quiet names
- confirm contradictory evidence and valuation-drift reasons are shown in plain
  language
- confirm a portfolio can appear because of overdue decision follow-up even
  without portfolio review cadence
- confirm the Agenda home still exposes one-click creation affordances
- confirm no generic news/price-alert style reasons appear

Acceptance criteria:

- The default workspace home is the Agenda, with a sidebar route back to it.
- The queue ranks analyses and portfolios using saved thesis/evidence/decision
  data without persisting separate agenda rows.
- Visible reasons explain why an item is ranked, and the top results favor
  overdue or stale work above soft overlap-only signals.
- Manual assets and portfolios participate within the narrower v1 rules.
- M5 passes the global quality gates in `EXECUTION_PLAN.md`.

## Assumptions And Deferrals

- M5 v1 uses manual/on-open recomputation in the current local-first app.
- The stale threshold remains 7 days past `nextReviewDue` unless the product
  later formalizes a configurable rule.
- Shared exposure in v1 uses explicit text/tag overlap and saved manual macro
  dependency fields; deeper ontology or clustering is deferred.
- Portfolio agenda coverage is intentionally narrower than analysis coverage in
  v1 because portfolios do not yet carry `ic.review`.
- Notifications, background refresh, and automated monitoring belong to a later
  milestone if product value justifies them.
