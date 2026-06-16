# AI Investment Committee Build Plan

Source of truth: `PRODUCT_STRATEGY.md`.

This plan turns the current single-asset cockpit into the broader AI Investment
Committee product while preserving the local-first Next.js/Dexie architecture.

## Latest Status - 2026-06-16

The app has moved beyond the original single-asset cockpit. It now supports
thesis intake, IC thesis memory, grounded debate, portfolio composition,
cross-asset chat, export/import, verified stock-intake field provenance, and an
analysis-scoped Evidence Locker. Browser QA now has a canonical dedicated
harness instead of relying on ad hoc browser state.

Current milestone status:

| Milestone | Status | Notes |
|---|---|---|
| M1 - IC Primitives + Frictionless Thesis Intake | Mostly implemented | IC state, thesis memory, review defaults, intake extraction, user confirmation, and inspector display exist. |
| M2 - Manual Private Asset IC Entry | Implemented, verification pending | Added `docs/milestones/m2_spec.md`, manual `valuationMode`, nullable engine fields, manual metadata/risk prompts, `+ MANUAL ASSET` entry points, manual thesis/detail editing, and portfolio-picker exclusion. `npm test`, `npm run lint`, and `npm run build` passed. Manual browser-path verification is still pending because the local in-app browser tool crashed during setup in this environment. |
| M3 - Stock Intake Trust + Field Provenance | Implemented, verified | Stock provenance types, lockable sourced facts, candidate blocking, manual promotion, saved inspector provenance, `npm test`, `npm run build`, and isolated browser QA are complete. |
| M4 - Evidence Locker Primitives | Implemented, verified | First-class `Analysis.evidence`, legacy candidate normalization, inline Evidence Locker UI, source/thesis links, backup/import preservation, and decision snapshot coverage are built. `npm test`, `npm run lint`, `npm run build`, isolated `m6`, expected-failure `broken-m4`, and the full canonical `node scripts/run.js qa` sweep passed on 2026-06-16. |
| M5 - Watchlist IC Agenda + Assumption Monitoring | Not implemented | Review cadence is stored, but there is no agenda ranking or monitoring engine. |
| M6 - Decision Ledger + Review Loop | Implemented, verified | Append-only `decisionHistory`, analysis/portfolio ledger UI, derived badges, snapshots, outcome reviews, legacy normalization, and backup round-trip tests are built. `npm run lint -- --quiet`, `npm test`, `npm run build`, and browser QA passed. Browser QA used local Playwright + Edge because the in-app browser helper still crashes during setup in this environment. |

Recommended next build order:

1. Complete the pending browser verification pass for the new M2 manual-asset workflow.
2. Close any UX or browser issues found in that M2 manual-flow verification.
3. Build M5 IC Agenda and assumption monitoring once M2/M3/M4 inputs are trustworthy enough.

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

Status: implemented, verification pending.

Goal: support non-public/manual assets in the same workflow without pretending
automated data coverage exists.

Current state:

- Added the authoritative packet at `docs/milestones/m2_spec.md`.
- `Analysis` now supports `valuationMode`, nullable `vertical` / `metrics`, and
  manual `manualMeta`.
- Manual assets can be created from a new `+ MANUAL ASSET` path and edited in
  the existing thesis/detail page.
- Manual assets now keep deterministic engine, provenance, debate, expert
  review, grounded chat, and portfolio-composition paths disabled.
- Added normalization, snapshot, and backup coverage for manual assets.
- `npm test`, `npm run lint`, and `npm run build` passed on 2026-06-16.
- Remaining verification gap: a live browser pass over the new manual flow is
  still pending in this environment.

Deliverables:

- Add manual asset-type flow for Conventional Business, Startup, Real Estate,
  Crypto, Macro View, and Other.
- Capture manual valuation, valuation date, valuation source, pricing freshness,
  liquidity, duration, portfolio role, sizing intent, and macro dependencies.
- Add risk-officer prompts by asset type.
- Keep automated feeds disabled for non-public/manual assets.

Detailed implementation plan:

- Scope: add a true manual-analysis flow for non-public or non-automated assets
  inside the existing `Analysis` object and thesis-detail workflow.
- Goal of this slice: let users create and manage private/alternative assets in
  the same IC system without pretending the app has live connectors or automated
  valuation coverage.
- Non-goal: do not add automated startup/private-company/property/crypto feeds,
  pricing sync, cap-table sync, wallet sync, or macro data connectors.

Data-model direction:

- Keep `Analysis` as the central object; manual assets should not require a
  separate object type.
- Keep `assetType` as the product classification and continue using `vertical`
  only where the deterministic engine genuinely applies.
- Add a manual/private-asset metadata shape on `Analysis` for fields that the
  current `assetMeta` does not cover cleanly.
- The manual metadata shape should include:
  - manual valuation
  - valuation date
  - valuation source
  - pricing freshness
  - liquidity
  - expected duration
  - portfolio role
  - sizing intent
  - macro dependencies
- Keep these fields asset-agnostic so they can apply across conventional
  businesses, startups, real estate, crypto, macro views, and `other`.
- Prefer explicit enums or constrained labels where the product strategy already
  gives a stable vocabulary, and free text where the repo does not yet have a
  stable taxonomy.

Asset-type and valuation-engine rules:

- Public equity continues to use the current stock intake and deterministic
  valuation engine flow.
- Conventional Business and Startup already have deterministic engine branches. These asset types can be created in either valuation-engine mode (for structured modeling) or manual-asset mode (for tracking thesis/evidence without numeric modeling), chosen by the user at creation time.
- Real Estate, Crypto, Macro View, and Other are manual-only with no automated research/valuation lock flow.
- Manual assets must still be able to carry thesis memory, evidence, review
  cadence, decisions, and later agenda signals even when no computed valuation is
  available.
- Automated web-research and stock-intake shortcuts should stay disabled or
  clearly bypassed for non-public/manual assets in v1.

Creation and editing flow:

- Expand the new-analysis flow so the user can choose asset type first, not just
  one of the three current valuation verticals.
- Support these manual asset types in the UI:
  - Conventional Business
  - Startup
  - Real Estate
  - Crypto
  - Macro View
  - Other
- For manual assets, open a manual IC entry form instead of the current
  stock/startup/conventional intake-only flow.
- The manual entry form should capture:
  - asset name and asset type
  - thesis summary and IC memory
  - manual valuation block
  - liquidity / duration / freshness labels
  - portfolio role / sizing intent
  - macro dependencies
  - evidence attachments
- Manual entry must work even when the user has zero valuation numbers yet; the
  thesis/evidence/review workflow should still be usable in draft form.

Risk Officer workflow:

- Add a manual-asset risk section with prompts tailored by asset type.
- Minimum prompt coverage should follow the product strategy:
  - all manual assets: illiquidity, stale valuation/source quality,
    concentration, key-person/operator risk, legal/regulatory risk, exit path,
    macro exposure
  - startups: dilution, cap-table, funding/follow-on risk
  - real estate: vacancy, tenant, leverage, location, refinancing risk
  - crypto: custody, protocol, liquidity, regulatory, smart-contract risk
  - macro view: rate, FX, hidden-correlation, and portfolio exposure prompts
- Keep this as structured user-facing prompts/checklists in M2, not a separate
  always-visible multi-persona AI workflow.

UI and workflow behavior:

- Update the new-analysis dialog and empty-state affordances so manual asset
  entry is first-class, not hidden behind the current three vertical presets.
- Show clear labels in the thesis/detail page for:
  - asset type
  - manual valuation freshness
  - liquidity
  - duration
  - valuation source
  - portfolio role / sizing intent
- Preserve the current Evidence Locker and Decision Ledger surfaces so manual
  assets use the same downstream workflow as public equities.
- Ensure manual assets can later appear in the same IC Agenda with explicit
  freshness/liquidity labeling.

Persistence and normalization:

- Extend normalization so older analyses without manual metadata continue to read
  cleanly.
- Backfill safe defaults for new manual-asset fields on read.
- Keep backup/export/import compatible with the added metadata.
- Do not force a Dexie version bump unless implementation makes it necessary.

Testing and verification:

- Type/normalization tests:
  - new manual metadata defaults normalize correctly
  - old analyses without manual metadata remain readable
  - manual asset types persist and reload correctly
- Workflow tests:
  - create manual real-estate / crypto / macro / other entries without automated
    feeds
  - create manual startup/conventional entries without forcing stock-style intake
  - manual assets save thesis memory, evidence, and decisions correctly
- UI tests:
  - new-analysis flow exposes manual asset choices
  - manual entry form captures valuation freshness/liquidity/duration/source
  - thesis detail page renders manual metadata clearly
- Browser verification after implementation:
  - create one manual real-estate entry and one macro-view entry
  - attach evidence and set review cadence
  - confirm no automated stock-intake or fake live-data behavior appears
  - confirm both assets remain visible and editable after reload

Implementation sequencing inside M2:

- First: define the manual-asset metadata shape and normalization defaults.
- Second: update creation flows so asset type selection supports manual assets.
- Third: build the manual IC entry form and thesis-detail rendering.
- Fourth: add Risk Officer prompt blocks by asset type.
- Fifth: extend tests, backup compatibility, and browser verification.

Exit criteria:

- Manual assets can appear beside public equities in the same IC agenda data
  structure.
- The UI clearly labels manual valuation freshness, liquidity, and duration.

## Milestone 3 - Stock Intake Trust + Field Provenance

Status: implemented, verified.

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
- Intake eval fixtures and pure scorecards now guard ticker detection, evidence
  relevance, no-fabrication behavior, and scoping-vs-figures mode.
- Stock field/domain types now distinguish user facts, sourced facts,
  candidates, derived candidates, default assumptions, and legacy unverified
  values.
- Stock intake schema and `finalizeIntake()` now accept and validate field-level
  provenance for stock figures.
- Inferred stock figures only become lockable sourced facts when provenance is
  complete and confidence is high enough; incomplete or low-confidence values
  remain candidates.
- Auto-derived stock `invested` is now stored as a derived candidate instead of
  pretending it was directly sourced.
- Stock analyses now persist `stockFields`, and repo normalization backfills
  older saved stock analyses into readable non-audited provenance state.
- The stock confirm card now carries stock field records through confirmation
  and allows explicit manual promotion of a candidate into a user-provided
  locked value.
- The stock confirm card and saved-analysis inspector now render sourced,
  candidate, user-provided, and derived stock field provenance in distinct,
  scannable states.
- Intake tests, repo normalization tests, and eval fixtures now cover stock
  provenance behavior.
- Verification passed with `npm test`, `npm run build`, and browser QA for cited
  evidence, partial evidence, uncited candidate promotion, and reload
  persistence.

Remaining:

- None for M3. Additional stock fields beyond `price`, `eps`, `roe`, and
  derived `invested` can be added later if needed.

Detailed implementation plan:

- Scope: focus M3 on public-equity intake and the stock confirm-and-lock flow.
- Goal of this slice: make every auto-filled stock figure auditable before it can
  become a locked engine input.
- Non-goal: do not build the full qualitative Evidence Locker here; M3 should reuse and
  reference the visible research/source material specifically to cite quantitative stock facts. M4 will handle qualitative evidence.

Storage and type changes:

- Extend stock intake rows from `stated` / `inferred` only into a richer field
  contract that distinguishes:
  - user-provided facts
  - sourced facts
  - inferred candidate values
  - engine/default assumptions
- Add field-level provenance payload for stock figures such as `price`, `eps`,
  `roe`, and any other auto-filled stock input that may be locked.
- Provenance payload must include:
  - source title
  - source URL
  - period or timestamp
  - value type such as current, delayed, TTM, annual, estimated, or
    user-provided
  - confidence label
- Do not introduce black-box percentage confidence scoring. Use explicit
  confidence labels or buckets instead.
- Persist provenance with the analysis so locked stock figures remain auditable
  after save/load and export/import.

Intake and normalization rules:

- Upgrade the provider-agnostic intake schema so stock `fields` can carry
  provenance, not only `key`, `value`, and `source`.
- Keep the current `finalizeIntake` seam as the single validation point for:
  - allowed stock keys
  - numeric coercion and unit normalization
  - provenance validation and clamping
  - lockable-vs-candidate classification
- Continue to treat web/link-extracted values as non-user values by default.
- Only values with complete provenance may become lockable sourced facts.
- Low-confidence or incomplete-provenance values must remain confirmation
  candidates, not locked facts.
- Search snippets alone must never become lockable figures.
- `discountRate`, `terminalMult`, and similar valuation assumptions remain user
  assumptions unless explicitly visible in trusted evidence.
- Auto-derived helper fields such as stock `invested` from `price` must be marked
  as derived candidates rather than pretending they were directly sourced.

Research-source policy and provenance classification:

- Keep the current free-source model:
  - official-first for fundamentals
  - free quote/market source for current or delayed price
  - web search for discovery and page fetch, not as an uncited fact source
- Add source classification so stock facts can be labeled as official,
  third-party, or user-provided at the field level.
- Prefer official/filing-style sources for EPS and ROE where available.
- Allow price from quote data only when freshness and source type are carried
  through the provenance payload.
- Where evidence is visible but ambiguous, surface the candidate with its source
  and require manual verification instead of omitting that ambiguity from the UI.

Confirm-card and UI behavior:

- Upgrade the stock confirm card so each extracted stock field shows its
  provenance inline before locking.
- For each auto-filled stock field, display:
  - field label and value
  - provenance source title
  - source URL
  - period/timestamp
  - value type
  - confidence label
- Locking behavior:
  - user-provided values can still confirm directly; when confirmed, their provenance is explicitly set to `user_provided` with the current timestamp.
  - sourced values can lock only when provenance is complete
  - low-confidence or incomplete values stay editable confirmation candidates
  - uncited values cannot be committed as locked figures
- Make the ambiguity explicit in the UI rather than silently downgrading a field.
- Preserve the current thesis-intake flow; this milestone changes trust and
  audibility of stock figures, not the broader thesis-memory workflow.

Shared helpers and persistence behavior:

- Add shared stock-provenance helpers for:
  - source classification
  - value-type normalization
  - confidence normalization
  - completeness checks for lockability
  - display formatting for provenance in the confirm card and inspector
- Update repo normalization to backfill older stock analyses that have no field
  provenance yet, keeping them readable while clearly treating legacy values as
  non-audited.
- Ensure backup/export/import round-trips the new field-provenance data.

Eval and test additions:

- Extend intake schema/finalization tests to cover:
  - valid stock provenance payloads
  - incomplete provenance downgraded to candidates
  - uncited values blocked from lockable sourced-fact status
  - unit normalization still working with provenance attached
  - legacy values normalizing safely
- Extend intake eval cases and scorecards to check:
  - required provenance on lockable stock fields
  - snippet-only evidence cannot lock values
  - low-confidence values remain candidates
  - `discountRate` and `terminalMult` stay absent unless explicitly visible
  - candidate/evidence URLs match visible research evidence
- Browser verification after implementation:
  - run a stock intake with clean cited evidence
  - run a price-only / partial-evidence stock intake
  - confirm the UI blocks uncited values from locking
  - confirm saved analyses retain per-field provenance after reload

Implementation sequencing inside M3:

- First: define the provenance shape and finalization rules at the schema/type
  seam.
- Second: wire provenance through provider intake output and research evidence
  formatting.
- Third: upgrade the confirm card and persistence model.
- Fourth: extend eval fixtures, scorecards, and browser verification.

Exit criteria:

- Met: search snippets cannot lock valuation numbers.
- Met: low-confidence values become confirmation candidates, not facts.
- Met: every lockable stock figure has auditable provenance.

## Milestone 4 - Evidence Locker Primitives

Status: implemented, verified.

Goal: reframe the library as evidence tied to theses.

Implemented:

- Added first-class `Analysis.evidence` records plus normalize-on-read migration
  from legacy `thesis.evidenceCandidates`.
- Added shared evidence helpers for promotion, source linking, thesis-link
  formatting, grouping, and filtering.
- Added inline Evidence Locker UI in `AnalysisView` with note/URL creation,
  candidate promotion, source linkage, relation/reliability editing, and
  thesis-link rendering.
- Preserved evidence through backup/export/import and M6 decision snapshots.
- Isolated browser QA now passes for the M4 fixture through the canonical
  harness; broader QA sweep remains open.

Remaining:

- None for M4. Browser QA closure completed on 2026-06-16.

Detailed implementation plan:

- Scope: make evidence first-class inside each analysis/thesis detail record
  before attempting a global cross-analysis knowledge base.
- Goal of this slice: turn `thesis.evidenceCandidates` plus attached `sources`
  into a real Evidence Locker workflow with durable records, thesis linkage, and
  active-context visibility.
- Non-goal: do not build a separate global Evidence table or standalone Library
  screen yet; M4 should stay aligned with the current analysis-centric local-first
  architecture.

Storage and type changes:

- Add a first-class evidence collection on `Analysis` such as `evidence:
  EvidenceItem[]`.
- Keep existing `sources` for active AI context and existing thesis-memory fields
  for summary/assumptions/breakers/watch items.
- Define `EvidenceItem` as a durable record with:
  - `id`
  - `title`
  - `type`
  - `relation`
  - `reliability`
  - `sourceDate` or reporting/reference date
  - `url?`
  - `note?`
  - `sourceRefIds: string[]` for linked `ContextSource` attachments where
    applicable
  - `thesisRefs`
  - `createdAt`
  - `updatedAt`
- Define `thesisRefs` so evidence can point to concrete thesis objects, not just
  free text. Cover:
  - thesis summary
  - assumptions
  - thesis breakers
  - watch items
  - valuation assumptions
  - catalysts
  - open questions
- Reuse the existing enums for:
  - `EvidenceType`
  - `EvidenceRelation`
  - `EvidenceReliability`

Migration and normalization rules:

- Migrate current `thesis.evidenceCandidates` into first-class `evidence` records
  on read, preserving their title, URL, note, type, relation, reliability, and
  creation time where possible.
- Apply deduplication during migration: if an evidence candidate matches the URL or exact title of an existing first-class evidence item on the analysis, do not spawn a duplicate.
- Keep `thesis.evidenceCandidates` readable during the migration period, but make
  `evidence` the canonical storage after M4.
- Do not auto-delete or repurpose `sources`; instead link evidence items to
  existing `ContextSource` records through `sourceRefIds`.
- Follow the repo's existing normalize-on-read pattern and avoid a Dexie version
  bump unless implementation proves it necessary.
- Ensure backup/export/import round-trips the new first-class evidence records and
  their attachment links.

Workflow and UI behavior:

- Add an Evidence Locker section to the thesis detail page in `AnalysisView`.
- The Evidence Locker should support:
  - viewing all evidence items on the analysis
  - adding a manual note/URL evidence item
  - promoting current `evidenceCandidates` into saved evidence items
  - linking uploaded files and attached URLs to evidence items
  - editing relation, reliability, date, note, and thesis linkage
- Show active-context state in the locker by indicating whether an evidence item
  is linked to currently attached `sources`.
- Keep the current source-chip flow for context attachment, but let the user tie
  those sources to evidence records instead of leaving them as detached context.
- Show evidence grouped or filterable by relation:
  - supporting
  - contradictory
  - neutral
  - unresolved
- Surface evidence linkage directly in the thesis-memory area so a user can see
  which assumptions, breakers, or open questions are backed or challenged by
  specific evidence.
- Evidence must be usable before a valuation model exists, so draft/scoping
  analyses can carry evidence without locked figures or debate output.

Design rules for M4:

- Evidence is a source-and-thesis object, not just an attachment list.
- A raw file/link attachment is not enough on its own; the user must be able to
  classify what it is, how reliable it is, how it relates to the thesis, and
  what thesis object it informs.
- Do not introduce AI-generated evidence summaries as authoritative facts in M4.
  The milestone is about structured storage and linkage, not autonomous evidence
  interpretation.
- Preserve manual/private-asset usefulness: pitch decks, memos, PDFs,
  screenshots, deal documents, and notes must fit the same model as filings and
  market-data pages.

Shared helpers and repo updates:

- Add shared helpers for:
  - promoting `evidenceCandidates` into `EvidenceItem`
  - linking/unlinking evidence to `ContextSource` ids
  - formatting thesis-link labels for the UI
  - grouping/filtering evidence by relation and type
  - normalizing legacy analyses that lack first-class evidence
- Update any report/snapshot logic introduced by M6 so decision snapshots can
  freeze first-class evidence items once M4 exists.

Required tests and verification:

- Normalization tests:
  - legacy `evidenceCandidates` become first-class `evidence` records
  - normalization is idempotent
  - `sources` remain intact while evidence links are added
- Type/workflow tests:
  - evidence item creation from manual note/URL
  - promotion from evidence candidate to saved evidence item
  - linking and unlinking a `ContextSource`
  - thesis references persist and render correctly
  - grouped relation filters behave correctly
- Backup tests:
  - export/import preserves first-class evidence records and linked source refs
- Browser verification after implementation:
  - attach a file and a URL
  - promote them or link them into evidence items
  - add a contradictory evidence note against a thesis assumption
  - confirm the thesis detail page shows the linkage and active-context state

Implementation sequencing inside M4:

- First: define the first-class `EvidenceItem` and thesis-reference model.
- Second: add normalization from `evidenceCandidates` to canonical `evidence`.
- Third: wire evidence linking to existing `sources`.
- Fourth: add the Evidence Locker UI in `AnalysisView`.
- Fifth: extend backup, tests, and browser verification.

Exit criteria:

- Every confirmed thesis can point to the evidence supporting or challenging it.
- Evidence can exist before a full valuation model exists.

## Milestone 5 - Watchlist IC Agenda + Assumption Monitoring

Status: not implemented.

Goal: make the dashboard answer what deserves attention.

Deliverables:

- Aggregate single-asset analyses and portfolios into an IC agenda queue.
- Consume existing `nextReviewDue` and `lastReviewedAt` cadence fields.
- Add stale threshold and assumption-pressure signals.
- Flag thesis breakers, stale theses, contradiction pressure, valuation drift,
  and shared macro exposure.
- Avoid generic news or price alerts unless they intersect with a thesis object.

Detailed implementation plan:

- Scope: build a derived IC Agenda and assumption-monitoring layer over all existing
  analyses (both automated/equity and manual/private assets), leveraging the manual asset metadata structure established in M2.
- Goal of this slice: make the top-level workspace answer "what deserves
  attention now?" using thesis objects, review state, evidence, valuation state,
  and decision history.
- Non-goal: do not build automated news scraping, scheduled background jobs, or
  generic market alerts in M5 v1.

Monitoring model and refresh policy:

- Use manual refresh in MVP, consistent with the product decision for a
  local-first workflow.
- Keep weekly as the default review cadence for active watchlist names.
- Use the product's stale threshold default: 7 days past `nextReviewDue`.
- Compute agenda signals on demand from saved workspace state rather than trying
  to persist a separate monitoring engine result as the primary source of truth.
- Treat M5 as a read-model / derived-queue milestone: canonical inputs remain
  thesis memory, evidence, review state, locked metrics, and decision history.

Derived agenda data model:

- Add a derived `AgendaItem` / `AgendaSignal` layer in code rather than a new
  top-level persisted table for v1.
- Each agenda item should include:
  - `target: { kind: "analysis" | "portfolio"; id: string }`
  - title / asset name
  - asset type
  - latest decision summary
  - review cadence fields
  - priority rank or score
  - `reasons: AgendaReason[]`
- Analysis targets route to the thesis detail view; portfolio targets route to
  the portfolio detail view.
- Each `AgendaReason` should be explicit and cite the thesis object or condition
  that triggered it.
- Reason categories for M5 v1:
  - review due
  - stale thesis
  - thesis breaker pressure
  - contradiction pressure
  - valuation drift
  - conviction review
  - shared macro exposure
  - capital relevance / latest decision follow-up
- Do not use a black-box confidence score. Ranking should be explainable from the
  visible reasons.

Signal rules for M5 v1:

- Review due:
  - triggered when the asset's overall `nextReviewDue` is in the past
  - escalates to stale thesis once the stale threshold is crossed
- Thesis breaker pressure:
  - triggered by active breaker objects and linked contradictory evidence or
    unresolved watch items
- Contradiction pressure:
  - derived from Evidence Locker relation counts and recent contradictory items
- Valuation drift:
  - derived from current locked valuation stance/metrics versus last committed
    decision context
  - should flag cases where the business may still be sound but the investment
    case has changed materially
- Shared macro exposure:
  - derived from overlapping assumptions, watch items, valuation assumptions,
    tags, and later manual-asset macro dependencies
  - in v1, use explicit shared text/tag overlap and asset metadata rather than
    pretending to infer a deep ontology
- Conviction review:
  - triggered when evidence quality deteriorates, contradiction pressure rises,
    or thesis freshness is poor relative to the saved conviction label
- Capital relevance / latest decision follow-up:
  - triggered from the latest decision history entry, specifically when the decision's `trigger.dueAt` (from M6) is in the past, or following up on add/increase/watch/research-more actions

Dependencies and source inputs:

- M5 should consume:
  - `ic.review` cadence and review dates
  - thesis assumptions, breakers, watch items, valuation assumptions, and
    conviction
  - first-class evidence from M4 once implemented
  - decision history and review triggers from M6
  - locked metrics and stance for valuation context
- M5 depends on manual asset metadata fields established in M2 (valuation freshness, liquidity, duration, macro dependencies) to rank and filter private/manual assets alongside public equities.
- Do not depend on live price/news connectors for M5 v1; manual/private assets
  should rely on saved evidence and scheduled review prompts.

UI and workflow behavior:

- Add a top-level IC Agenda view as the primary watchlist/dashboard surface in
  the workspace.
- The agenda should show a ranked queue of analyses requiring attention, not just
  a flat library list.
- Each row/card should show:
  - asset name
  - asset type
  - latest decision/status
  - next review due / stale state
  - top agenda reasons
  - quick path into the thesis detail page
- Support filtering or grouping by:
  - due now
  - stale
  - contradictory evidence
  - valuation drift
  - shared exposure
  - watching / decided / archived
- Surface reasons in plain language tied to thesis objects, for example:
  - "Review overdue by 10 days"
  - "Contradictory evidence linked to deposit-cost assumption"
  - "Valuation stance drifted from UNDERVALUED to FAIR since last decision"
- Preserve the existing Library as a lightweight record browser, but make the IC
  Agenda the higher-level answer to what needs attention.

Shared helpers and repo updates:

- Add pure agenda-derivation helpers for:
  - stale-thesis detection
  - review-due and stale-threshold calculation
  - contradiction-pressure scoring from evidence relations
  - valuation-drift detection using metrics/stance plus latest decision snapshot
  - shared-exposure grouping from assumptions/watch items/tags
  - explainable priority ranking
- Keep these helpers deterministic and unit-testable so the agenda behavior is
  inspectable and stable.
- Update exports/backups only as needed for any new persisted review fields; the
  agenda itself should be recomputable after import.

Required tests and verification:

- Pure derivation tests:
  - review due vs stale threshold behavior
  - contradiction pressure from supporting vs contradictory evidence mixes
  - valuation drift detection against prior decision snapshot
  - shared-exposure grouping from overlapping assumptions/tags
  - explainable priority ordering when multiple reasons compete
- Normalization/back-compat tests:
  - legacy analyses without M4/M6 data still derive safe agenda items
  - missing evidence or decision history degrades gracefully
- UI tests:
  - agenda view renders ranked items with visible reasons
  - filters/grouping behave correctly
  - opening an agenda row routes to the correct analysis or portfolio detail page
- Browser verification after implementation:
  - create or load analyses with varied review dates and thesis states
  - confirm overdue/stale items rank above quiet names
  - confirm contradictory evidence and valuation-drift reasons surface clearly
  - confirm the agenda never shows generic "news/price alert" style reasons

Implementation sequencing inside M5:

- First: define the derived agenda types and reason taxonomy.
- Second: build pure signal/ranking helpers over thesis, evidence, review, and
  decision data.
- Third: add the top-level IC Agenda UI and wire navigation into analyses.
- Fourth: integrate M4/M6-derived signals for contradiction pressure and review
  follow-up.
- Fifth: extend tests and browser verification.

Exit criteria:

- The top-level view ranks attention needs across public and manual assets.
- Monitoring reasons cite the relevant assumption, breaker, valuation condition,
  or exposure.

## Milestone 6 - Decision Ledger + Review Loop

Status: implemented, verified.

Goal: preserve decisions and evaluate decision quality over time.

Current state:

- `ICAction` is now used by the live Decision Ledger surfaces.
- `Analysis` and `PortfolioAnalysis` persist append-only `decisionHistory`.
- Legacy `APPROVE`, `HOLD`, and `REJECT` decisions normalize into preserved
  legacy history entries instead of being mapped into new IC actions.
- Each new decision can store rationale, required trigger, conditional
  pre-mortem, frozen snapshot, and one outcome review.
- Library badges and filters derive status from latest decision history for
  analyses and portfolios.
- Verification on 2026-06-15: `npm run lint -- --quiet`, `npm test`
  (19 files / 151 tests), `npm run build`, and browser QA passed. Browser QA
  was completed through local Playwright + Edge because the in-app browser
  helper still crashed during setup, although the local dev server reached
  ready state.

Deliverables:

- Replace the old approve/hold/reject UI with IC action vocabulary.
- Require pre-mortem for Add / Increase Position decisions.
- Track decision rationale, linked thesis state, linked evidence, and review
  trigger.
- Add outcome review so decisions can be judged against later thesis evolution.

Detailed implementation plan:

- Scope: cover both single-asset analyses and portfolios in the first M6 slice.
- Storage model: replace the single legacy `decision` record with append-only
  decision history stored on `Analysis` and `PortfolioAnalysis`.
- Current-state rule: derive the latest/current decision from history order
  instead of storing a second "current decision" field.
- Legacy migration: normalize old `APPROVE` / `HOLD` / `REJECT` decisions into a
  one-entry history record on read, preserve them as legacy labels, and do not
  auto-map them into new IC actions.
- Back-compat approach: follow the repo's existing normalize-on-read pattern and
  avoid a Dexie version bump unless implementation proves it is necessary.

Decision entry shape:

- `id`, `decidedAt`, `rationale`
- `action: ICAction | null`
- `legacyAction?: "APPROVE" | "HOLD" | "REJECT"`
- `preMortem?: string`
- `trigger: { dueAt: number | null; note: string } | null`
- `snapshot`
- `review: DecisionOutcomeReview | null`

Outcome review shape:

- One review per decision in M6 v1.
- `reviewedAt`
- `outcome: "worked" | "mixed" | "did_not_work" | "unresolved"`
- `reasoningAssessment: "right_right_reason" | "wrong_right_reason" | "lucky" |
  "unclear"`
- `notes`

Decision-time snapshot rules:

- Analysis snapshot freezes thesis memory, review state, locked metrics, stance,
  attached source refs, and available evidence-candidate data.
- Portfolio snapshot freezes members, capital and derived weights, portfolio
  metrics, member stance labels, and linked analysis ids.
- M6 must snapshot the evidence/source structures that exist today; it must not
  wait for M4's first-class Evidence Locker schema.

Workflow and UI rules:

- Replace the "Make the call" card in `AnalysisView` with a Decision Ledger card
  using the `ICAction` vocabulary.
- Add the same Decision Ledger card to `PortfolioView`.
- Require rationale for every new decision.
- Require pre-mortem only for `add_increase_position`.
- Require review trigger as date + note for every new decision except
  `archive`.
- Show decision history newest-first under the commit form.
- Add a manual "Review decision" flow on each history entry.
- Mark a decision as due once `trigger.dueAt` is in the past.
- Limit stored outcome review to one manual review per decision in M6 v1.

Status derivation rules:

- No decisions -> `draft`
- Latest decision `watch` -> `watching`
- Latest decision `archive` -> `archived`
- Any other committed IC action -> `decided`

Library and repo updates:

- Update analysis badges and filters to use derived latest-decision and status
  semantics instead of the current single-record decision check.
- Add equivalent derived status and latest-decision badge behavior for portfolios; do not store a separate status field on PortfolioAnalysis, derive it from decision history exactly as done for single analyses.
- Add shared helpers for decision validation, latest-decision lookup, legacy
  label rendering, and snapshot building for analysis vs portfolio.
- Ensure backup/export/import round-trips decision history and outcome reviews.

Required tests and verification:

- Normalization: legacy `decision` becomes one history entry; preserved as
  legacy; normalization remains idempotent.
- Validation: `add_increase_position` requires pre-mortem; non-`archive`
  actions require trigger date + note; `archive` does not.
- Snapshot coverage: analysis snapshots freeze thesis + metrics + refs;
  portfolio snapshots freeze members + weights + metrics.
- UI/repo behavior: latest badge/filtering derive from history correctly; first
  decision moves records out of `draft`; `watch` and `archive` map to
  `watching` / `archived`.
- Backup round-trip preserves history and outcome reviews.
- Browser verification after implementation: commit an analysis decision, commit
  a portfolio decision, review a due decision, and confirm Library badges and
  filters update correctly.

Exit criteria:

- Every committed decision stores why it was made and what would falsify it.
- The app can show whether the thesis was right for the right reason, wrong for
  the right reason, or merely lucky.
