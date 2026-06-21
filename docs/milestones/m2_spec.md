# Milestone 2 Specification: Manual Private Asset Saved Workspace

## Summary

M2 defines the saved workspace for manual private and non-public assets.

This milestone remains about durable thesis memory, valuation context, evidence,
review cadence, and decision tracking for assets without automated data
coverage. It is not the first exploratory reasoning surface for broad prompts
such as `private laundry business`.

Outcome:

- users can create and manage manual `conventional_business`, `startup`,
  `real_estate`, `crypto`, `macro_view`, and `other` analyses
- manual assets live in the same Library and saved-review workflow as current
  analyses
- the UI clearly distinguishes manual saved work from temporary guided
  exploration

Non-goals:

- do not add automated private-company, property, crypto, or macro data feeds
- do not make manual/private review the first response to a broad exploratory
  prompt
- do not run deterministic valuation, persona debate, expert review, or
  grounded chat for manual assets in M2

## Product And UX Contract

### Relationship To Explore

- broad/private/business prompts begin in `Explore an idea`
- `Explore an idea` is the temporary reasoning surface
- `Manual Private Asset IC Entry` is the post-commit saved workspace
- a private/manual idea should move into M2 only after the user explicitly
  chooses to save the opportunity as a review

### Entry Points

- Keep the current intent-first creation flow.
- Manual asset creation can still begin from:
  - `+ MANUAL ASSET`
  - the empty workspace state
  - saved Explore handoff after explicit commitment
- Manual entry opens an asset-type-first chooser with:
  - `conventional_business`
  - `startup`
  - `real_estate`
  - `crypto`
  - `macro_view`
  - `other`

### Creation Rules

- `stocks` remain engine-only and are not part of the manual flow
- manual `startup` and manual `conventional_business` entries always create
  `valuationMode: "manual"`
- `real_estate`, `crypto`, `macro_view`, and `other` are manual-only in M2
- manual entry must work even if the user has no valuation number yet
- if a manual/private idea comes from Explore, the first saved state must be a
  kickoff aligned with the chosen exploration direction

### Saved Kickoff Before Manual Detail

When a private/manual idea is saved from Explore:

- the first saved state is `kickoff`, not the old generic manual recovery
  surface
- the kickoff must explain:
  - what direction the user saved
  - why it may matter
  - what risks or questions were carried forward
  - what the next fact-check or evidence step is
- only after this kickoff should the user settle into the normal saved
  manual-review workflow

### Manual Detail Workflow

- Manual assets open inside the existing thesis/detail page instead of a
  separate screen
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
- Reuse the current Evidence Locker and Decision Ledger unchanged
- Show manual-asset state clearly when no deterministic model exists

### Manual Review Purpose

Manual/private saved reviews are for:

- captured thesis memory
- evidence
- valuation context
- review cadence
- decision tracking

They are not the initial reasoning surface for broad exploratory questions.

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
- Manual assets remain visible in the Library and saved-review workflow
- Manual assets are excluded from current portfolio member pickers and portfolio
  metric paths

## Engineering Contract

### Domain Model

Keep the existing manual-aware `Analysis` shape:

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

Required `Analysis` behavior:

- manual analyses use `valuationMode: "manual"`
- manual analyses keep `vertical: null`
- manual analyses keep `metrics: null`
- manual analyses keep `parameters: {}`
- manual analyses store user-authored `manualMeta`

### Explore-To-Manual Handoff Rules

If a saved manual/private review originates from Explore:

- preserve the raw prompt as one exploration evidence item
- preserve the chosen direction's summary/risk/open-question framing as
  unverified saved-review kickoff context
- do not write exploration output into `chat`
- do not auto-create deterministic figures or fake grounded-analysis state

### Saved Review Mode Contract

Manual/private reviews created from Explore must support a visible saved-review
mode contract:

- `kickoff`
- `fact_check`
- `review`

The kickoff exists to prevent the user from landing immediately in the old
generic manual-recovery surface.

### Valuation And Persistence Rules

- Manual assets must never call `computeMetrics`
- Existing backup/export/import continues to round-trip analyses with manual
  fields and kickoff state
- Decision snapshots must tolerate nullable `vertical` and `metrics`, and must
  capture `manualMeta`

### Compatibility Rules

- Legacy analyses missing `valuationMode` normalize as engine-backed
- Legacy analyses missing `manualMeta` normalize with `manualMeta: null`
- Existing code paths that assume `vertical` or `metrics` exist must stay
  guarded or narrowed before use
- Normalize-on-read must stay idempotent and should avoid a Dexie version bump
  unless implementation forces it

### Manual Risk Prompt Contract

Keep `ManualRiskPromptId` as a stable union covering:

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

## Implementation Slices

1. Keep the manual/private saved-workspace packet aligned with the new Explore
   front-door contract.
2. Add or preserve a saved-review kickoff state for Explore-originated
   manual/private ideas before the normal manual detail workflow.
3. Ensure manual/private saved reviews receive carried-forward direction framing
   without pretending the idea is already fact-checked.
4. Keep the existing manual valuation, liquidity, duration, role, sizing,
   macro, and risk-note editing workflow as the long-lived saved workspace.
5. Verify that manual/private reviews do not appear as the first answer to
   broad exploratory prompts.

## Verification

Automated tests:

- legacy analyses without `valuationMode`, `manualMeta`, nullable `vertical`, or
  nullable `metrics` normalize safely
- manual assets persist and reload across all supported asset types
- manual assets round-trip through backup/export/import
- Explore-originated manual reviews preserve kickoff state and carried-forward
  unverified framing
- manual assets never call `computeMetrics`
- manual assets do not derive persona, debate, expert review, or grounded chat
- manual assets do not appear in current portfolio composition pickers

Browser checks:

- `private laundry business` stays temporary during early exploration
- saving a chosen private/business direction opens a saved kickoff, not the old
  generic manual recovery surface
- fill manual valuation and Risk Officer fields, attach evidence, set review
  cadence, save, reload, and confirm persistence
- confirm manual assets show asset-type labels and no fake stock, chart, or
  debate UI
- confirm manual assets are absent from current portfolio member pickers

Acceptance criteria:

- all six manual asset types can be created and persisted
- manual/private saved reviews begin only after explicit user commitment
- manual/private saved reviews share thesis memory, Evidence Locker, and
  Decision Ledger behavior with existing analyses
- manual/private reviews never present automated-data or deterministic-valuation
  claims
- manual/private reviews are clearly saved work, not exploratory-first surfaces

## Assumptions And Deferrals

- `pricingFreshness`, `liquidity`, `expectedDuration`, `portfolioRole`, and
  `sizingIntent` remain free-text user-authored labels in M2
- Manual assets are analysis-level records only in M2; portfolio composition and
  metric participation are deferred
- AI debate/chat for manual assets remains deferred to avoid false precision and
  trust problems
- M2 continues to use the current local-first Dexie architecture and
  normalize-on-read compatibility strategy
