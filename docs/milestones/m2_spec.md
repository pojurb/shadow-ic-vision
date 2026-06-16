# Milestone 2 Specification: Manual Private Asset IC Entry

## Summary

M2 adds a first-class manual asset workflow so the workspace can cover private
and non-public assets without pretending deterministic valuation coverage
exists. The same `Analysis` object, thesis memory, Evidence Locker, Decision
Ledger, and review cadence continue to apply, but manual assets store
user-authored valuation context instead of engine-computed metrics.

Outcome:

- users can create and manage manual `conventional_business`, `startup`,
  `real_estate`, `crypto`, `macro_view`, and `other` analyses
- manual assets live in the same Library and thesis-detail workflow as current
  analyses
- the UI clearly distinguishes deterministic engine-backed analyses from manual
  assets

Non-goals:

- do not add automated private-company, property, crypto, or macro data feeds
- do not run AI valuation, persona debate, expert review, or grounded chat for
  manual assets in M2
- do not add manual assets to current portfolio composition pickers or
  portfolio-metric calculations until a later milestone defines that behavior

## Product And UX Contract

### Entry Points

- Keep the current chat-first `+ NEW ANALYSIS` flow unchanged for engine-backed
  work.
- Add a peer `+ MANUAL ASSET` entry point in:
  - the empty workspace state
  - the Library toolbar
- Manual entry opens an asset-type-first chooser with:
  - `conventional_business`
  - `startup`
  - `real_estate`
  - `crypto`
  - `macro_view`
  - `other`

### Creation Rules

- `stocks` remain engine-only and are not part of the manual flow.
- Manual `startup` and manual `conventional_business` entries always create
  `valuationMode: "manual"`.
- The existing chat-first route remains the engine-backed creation path for
  `startup` and `conventional_business`.
- `real_estate`, `crypto`, `macro_view`, and `other` are manual-only in M2.
- Manual entry must work even if the user has no valuation number yet.

### Manual Detail Workflow

- Manual assets open inside the existing thesis/detail page instead of a
  separate screen.
- The manual form captures:
  - asset name
  - thesis memory
  - manual valuation amount
  - valuation date
  - valuation source
  - pricing freshness
  - liquidity
  - expected duration
  - portfolio role
  - sizing intent
  - macro dependencies
  - Risk Officer notes
- Reuse the current Evidence Locker and Decision Ledger unchanged.
- Show manual-asset state clearly when no deterministic model exists.

### Manual Risk Officer Prompts

- Every manual asset shows shared prompts for:
  - illiquidity and exit path
  - valuation quality and source freshness
  - concentration
  - key-person or operator dependency
  - balance-sheet or burn risk
  - legal or regulatory risk
  - macro exposure
- Asset-specific prompts:
  - `startup`: dilution, cap table, funding runway, follow-on risk
  - `real_estate`: vacancy, tenant, leverage, refinancing risk
  - `crypto`: custody, protocol, liquidity, regulatory, smart-contract risk
  - `macro_view`: rates, FX, hidden-correlation risk

### Display And Guard Rules

- When `analysis.valuationMode === "manual"`:
  - use `assetType` labels for badges and headers
  - do not render fake valuation `vertical` tags
  - hide engine-only surfaces:
    - valuation charts
    - per-vertical engine field editors
    - stock provenance UI
    - persona and stance chips
    - debate card
    - expert review
    - grounded chat
  - show clear copy that no deterministic model is active
- Manual assets remain visible in the Library and analysis detail workflow.
- Manual assets are excluded from current portfolio member pickers and portfolio
  metric paths.

## Engineering Contract

### Domain Model

Extend `Analysis` with manual-aware valuation state:

```ts
type ValuationMode = "engine" | "manual";

interface ManualRiskNote {
  promptId: ManualRiskPromptId;
  note: string;
}

interface AnalysisManualMeta {
  valuationAmount: number | null;
  valuationDate: string;
  valuationSource: string;
  pricingFreshness: string;
  liquidity: string;
  expectedDuration: string;
  portfolioRole: string;
  sizingIntent: string;
  macroDependencies: string[];
  riskNotes: ManualRiskNote[];
}
```

Required `Analysis` changes:

- add `valuationMode: ValuationMode`
- change `vertical` from `Vertical` to `Vertical | null`
- change `metrics` from `ComputedMetrics` to `ComputedMetrics | null`
- add `manualMeta: AnalysisManualMeta | null`
- keep `parameters` as the current optional-key bag

### Valuation And Persistence Rules

- Engine-backed analyses normalize to:
  - `valuationMode: "engine"`
  - non-null `vertical`
  - non-null `metrics`
  - `manualMeta: null`
- Manual analyses normalize to:
  - `valuationMode: "manual"`
  - `vertical: null`
  - `metrics: null`
  - `parameters: {}`
  - populated or empty-default `manualMeta`
- Manual assets must never call `computeMetrics`.
- Existing backup/export/import continues to round-trip analyses with the added
  fields.
- Decision snapshots must tolerate nullable `vertical` and `metrics`, and must
  capture `manualMeta`.

### Compatibility Rules

- Legacy analyses missing `valuationMode` normalize as engine-backed.
- Legacy analyses missing `manualMeta` normalize with `manualMeta: null`.
- Existing code paths that assume `vertical` or `metrics` exist must be guarded
  or narrowed before use.
- Normalize-on-read must stay idempotent and should avoid a Dexie version bump
  unless implementation forces it.

### Manual Risk Prompt Contract

Define `ManualRiskPromptId` as a stable union covering:

- shared prompts:
  - `illiquidity_exit`
  - `valuation_quality`
  - `concentration`
  - `key_person`
  - `balance_sheet_burn`
  - `legal_regulatory`
  - `macro_exposure`
- startup prompts:
  - `startup_dilution_funding`
- real-estate prompts:
  - `real_estate_vacancy_tenant`
  - `real_estate_leverage_refinancing`
- crypto prompts:
  - `crypto_custody`
  - `crypto_protocol`
  - `crypto_liquidity`
  - `crypto_regulatory`
  - `crypto_smart_contract`
- macro prompts:
  - `macro_rates_fx`
  - `macro_hidden_correlation`

Store prompt ids and free-text notes in `manualMeta.riskNotes`.

## Implementation Slices

1. Types and normalization
   Add `valuationMode`, nullable `vertical` and `metrics`, `manualMeta`,
   `ManualRiskPromptId`, normalize-on-read defaults, decision-snapshot updates,
   and guards that keep manual assets out of portfolio composition pickers.
2. Creation flow
   Add `+ MANUAL ASSET`, manual asset-type selection, and draft creation for all
   six manual asset classes without entering the engine-backed intake flow.
3. Manual detail surface
   Build manual valuation, liquidity, duration, role, sizing, macro dependency,
   and risk-note editing inside the existing analysis detail page.
4. Engine-only UI guards
   Hide deterministic-model charts, provenance, stance, debate, expert review,
   and grounded chat for manual assets; show explicit manual/no-model state.
5. Verification and closeout
   Add unit tests, compatibility checks, browser scenarios, and documentation
   updates in `PROGRESS.md` and roadmap status docs.

## Verification

Automated tests:

- legacy analyses without `valuationMode`, `manualMeta`, nullable `vertical`, or
  nullable `metrics` normalize safely
- manual assets persist and reload across all supported asset types
- manual assets round-trip through backup/export/import
- decision snapshots preserve manual `vertical: null`, `metrics: null`, and
  `manualMeta`
- manual assets never call `computeMetrics`
- manual assets do not derive persona, debate, expert review, or grounded chat
- manual assets do not appear in current portfolio composition pickers

Browser checks:

- create manual `real_estate` and `macro_view` entries from `+ MANUAL ASSET`
- create manual `startup` and `conventional_business` entries without entering
  engine-backed intake
- fill manual valuation and Risk Officer fields, attach evidence, set review
  cadence, save, reload, and confirm persistence
- confirm manual assets show asset-type labels and no fake stock, chart, or
  debate UI
- confirm manual assets are absent from current portfolio member pickers

Acceptance criteria:

- all six manual asset types can be created and persisted
- manual assets share thesis memory, Evidence Locker, and Decision Ledger
  behavior with existing analyses
- manual assets never present automated-data or deterministic-valuation claims
- M2 passes the global quality gates in `EXECUTION_PLAN.md`

## Assumptions And Deferrals

- `pricingFreshness`, `liquidity`, `expectedDuration`, `portfolioRole`, and
  `sizingIntent` remain free-text user-authored labels in M2 because the repo
  does not yet define a stable controlled vocabulary.
- Manual assets are analysis-level records only in M2; portfolio composition and
  metric participation are deferred.
- AI debate/chat for manual assets is deferred to a later milestone to avoid
  false precision and trust problems.
- M2 continues to use the current local-first Dexie architecture and
  normalize-on-read compatibility strategy.
