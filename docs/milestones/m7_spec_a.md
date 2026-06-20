# Milestone 7 Specification (Variant A): IC Chair Triage + Everyday-User Front Door

## Status Of This Document

This is a revision of `m7_spec.md`. It folds in the parts of
`m7_spec_ux_review_v2.md` that are low-risk and in-scope, scaled down where
needed. It deliberately excludes:

- automatic metric extraction from pasted/uploaded pitch decks
- making required private-asset fields optional
- a "create custom reminder" notification feature
- a full persistent split-screen workspace architecture

Those four items either conflict with locked product-strategy decisions or
exceed M7's scope as a workflow/language milestone. They are deferred, not
rejected — see `m7_spec_ux_review_v2.md` for the original proposals if a
later milestone wants to revisit them.

## Summary

M7 defines the workspace intent gate and the everyday-user front door for the
AI Investment Committee.

The milestone is no longer only about preventing accidental persistence from
broad prompts. It also makes the workflow simple enough for a normal investor
to understand without learning internal IC vocabulary first.

The outcome is a simple-by-default decision desk:

- Home remains the default surface for saved work and next actions.
- Explore is the only broad-discovery entry point.
- Saved reviews are created only by explicit user action.
- The user can always tell whether they are exploring, saving, checking facts,
  or reviewing a tracked investment.
- The user can always tell whether something is temporary or saved, on sight,
  without reading copy.
- If a request can't be done, the user is always handed a next step, never a
  dead end.

Non-goals:

- Do not build a fully automated stock recommendation engine.
- Do not add new market-data connectors, brokerage import, notifications, or
  scheduled monitoring.
- Do not weaken M1 thesis confirmation or M3 cited-fact locking.
- Do not introduce a separate beginner-only product or remove advanced IC
  depth from the underlying system.
- Do not auto-extract financial metrics from uploaded documents.
- Do not make required manual-asset fields optional.

## Product And UX Contract

### Product Positioning

- M7 must support a dual-mode product direction:
  - default experience: plain-language, everyday-user-friendly workflow
  - advanced depth: retained IC rigor, evidence discipline, and decision memory
- The default UI should explain the next action in simple language before
  exposing deeper IC structure.

### Canonical Workspace Hierarchy

- `Home` is the main front door.
- `Explore an idea` is the only broad-discovery destination.
- `Library` is for browsing saved work, not for onboarding or first-run
  guidance.
- `Settings` is utility-only:
  - keep header access
  - do not present it as a peer Home destination beside investment actions
  - do not make it compete with `Home` or `Explore an idea`

### Canonical User Intents

The product should route users by intent, not by internal system architecture.

Supported top-level intents:

- `Explore an idea`
- `Add something I already own`
- `Track a startup or private business`
- `Track another private or custom asset`
- `Create a portfolio`

The user should not need to decide between manual-vs-engine architecture as a
first product choice.

### Triage Contract

- `Explore an idea` is temporary:
  - broad prompts
  - casual greetings
  - rough screens
  - early framing questions
  do not create saved records on their own
- Triage output frames investigation candidates, not recommendations.
- Candidate actions are explicit:
  - `Start review` creates and opens a saved review
  - `Save to watchlist` creates a saved draft without opening the full review
  - `Compare` and `Dismiss` remain local triage actions
- The user must always be able to tell whether a result is temporary or saved.

### Exploration Carry-Forward (new)

When the user picks `Start review`, do not discard the Explore session.

- On `Start review`, copy the raw Explore chat transcript verbatim into the new
  review's Evidence Locker as a single note.
- Label the note `Imported from Exploration` and mark it `Unverified — not yet
  confirmed`.
- Do not summarize, extract, or restructure the transcript. Raw copy only. No
  new AI call is made at this step.
- This note behaves like any other unverified evidence item: it does not
  count as a cited or locked fact, and it does not pre-fill or auto-confirm
  any field in the review.
- `Save to watchlist` does NOT trigger this carry-forward. Watchlist saves stay
  fast and lightweight, with no transcript packaging step.
- Show a confirmation line when this happens:
  > "Review started for [Asset]. Your exploration notes were saved into the
  > Evidence Locker as an unverified note."

### Everyday-User Naming Rules

Use one user-facing naming system across Home, Explore, and saved reviews:

- `Explore an idea`
- `Start review`
- `Save to watchlist`
- `Check the facts`
- `Ready for review`
- `Decision made`

Avoid mixing these with competing labels in the same user-visible flow, such
as:

- investigate idea
- research idea
- open investment review
- case file
- figures locked
- decision logged

### Plain-Language State Model

The top-level user-visible lifecycle should show one primary state at a time:

- `Not started`
- `Needs fact check`
- `Ready for review`
- `Decision made`

Implementation may preserve deeper internal state, but the main header and
list surfaces should not force users to interpret multiple parallel status
systems. Field-level indicators (for example a per-fact "locked" marker) are
allowed but must never be presented as a second, competing top-level state
next to the header.

### Stock Workflow Rules

- Broad stock questions belong in `Explore an idea`, not directly in a saved
  review.
- `Start review` opens a saved stock review in structured note/evidence intake
  mode.
- `Check the facts` is the user-facing framing for confirm-before-lock
  behavior.
- During pre-verification mode, the screen should feel like guided fact
  checking, not generic chat.
- After facts are confirmed, grounded follow-up can become more
  conversational.

### Fact-Check Mode Distinction (revised, scaled down)

The pre-verification and post-verification screens must be visually and
structurally distinguishable, without building a new persistent dual-pane
workspace.

- Pre-verification ("Check the facts" mode):
  - the screen shows a structured list/checklist of facts to confirm, each
    with its source and a confirm action
  - free-text input, if present, is scoped to answering the active fact, not
    an open-ended conversation
  - a visible mode label or header state reads something like `Checking
    facts`
- Post-verification (conversational mode):
  - once all required facts are confirmed, the screen switches to an
    open-ended chat surface
  - a visible mode label or header state reads something like `Reviewing`
- The two modes can live in a single panel that swaps content, rather than a
  permanent two-panel layout. A full persistent split-screen ledger/console
  workspace is deferred to a later milestone if still desired.
- Editing a previously confirmed fact switches the screen back into
  `Checking facts` mode for that fact.

### Startup And Private-Asset Routing Rules

- The user should choose based on what they have, not on engine-vs-manual
  architecture.
- For startups and private businesses:
  - if the user has structured metrics and wants a fuller modeled review, the
    system may route into the engine-backed path
  - if the user has incomplete information, decks, notes, or qualitative
    material, the system should route into the manual/private workflow
- The user should not experience this as choosing the "wrong" path.
- Routing is based on what the user tells the system about their own
  information (a simple choice in their own words), not on automated
  detection of metrics inside pasted or uploaded documents. Automated
  detection is explicitly out of scope for this milestone.

### Manual / Private Asset Rules

- Manual assets must feel honest and low-pressure:
  - no fake automation claims
  - no implied live data coverage
  - no expectation that all fields must be known immediately
- The workflow should emphasize:
  - what the asset is
  - what it may be worth
  - why it matters
  - what could go wrong
  - when to check it again
- All fields defined as required for manual private assets in
  `PRODUCT_STRATEGY.md` (valuation, valuation date, valuation source, pricing
  freshness, liquidity, duration, portfolio role, sizing intent) remain
  required. M7 does not change which fields are required — it only changes how
  the routing and entry point feel. Any proposal to make these optional is a
  separate product decision, not part of this milestone.

### Confirmation And Recovery States

- `Save to watchlist` must visibly confirm:
  - the item was saved
  - where it went
  - what the user can do next
- `Start review` must visibly confirm that a saved review has been opened.
- Unsupported requests inside a saved review must not end in refusal-only
  copy. They must offer a recovery path such as:
  - attach a source
  - continue with notes
  - move back to Explore for broad discovery
  - enable allowed research behavior where applicable

#### Recovery Path Mapping

Concrete copy for common unsupported requests, so engineering and copy stay
consistent:

| User Request | Why It's Unsupported | Recovery Copy / Action |
| :--- | :--- | :--- |
| "Sync live price feed" (on a private asset) | Private assets have no public ticker or live feed | "We can't track live prices for private assets. Want to set a manual review reminder instead? [Set review cadence]" — uses the existing weekly review cadence, not a new reminder feature |
| "Analyze this stock chart" (inside a private asset review) | No public market chart exists | "No public market data for this asset. You can upload a cap table or balance sheet to update the model manually. [Upload source document]" |
| "Find public sentiment" (on a private asset) | No search connector or data coverage for private assets | "We don't search social channels for private assets, to avoid false signals. You can add research notes or investor updates as evidence instead. [Add note]" |
| "Tell me what stocks to buy" (inside a saved stock review) | The product is decision-support, not an advisory engine | "We don't make buy/sell recommendations. You can explore general stock ideas in the Sandbox, or add this stock to your watchlist for fact-checking. [Go to Explore]" |

This table is illustrative, not exhaustive. Any new unsupported-request case
discovered during implementation should follow the same pattern: name the
limit plainly, then offer one concrete next action.

### Visual Distinction: Temporary Sandbox vs. Saved Review

- `Explore an idea` must visually read as temporary at all times, for example
  a persistent header label such as `Temporary Sandbox — Not Saved`.
- A saved review or watchlist entry must visually read as saved, for example
  a persistent save-state indicator such as `Saved Review` or `Saved to
  Watchlist`.
- This is a styling/labeling requirement, not a new data feature. No new
  reminder, notification, or scheduling capability is introduced as part of
  this visual distinction.
- `Save to watchlist` confirmation should point at where the item went, for
  example: "Saved to your watchlist. [Go to watchlist]". No additional
  "create reminder" action is added in this milestone.

### Case / Review Surface Rules

- A saved review must start in structured review-building mode, not
  open-ended chat.
- Draft/pre-verification mode should emphasize note capture, evidence, and
  fact checking.
- Post-verification mode may support grounded follow-up, but should remain
  clearly tied to the saved review and must not hide state mutation.

## Engineering Contract

- Keep the pure deterministic triage derivation helper for v1.
- Do not add a new persisted triage table or Dexie version bump.
- Keep triage results in component state only, until the moment `Start
  review` is clicked — at that point the raw transcript is written once into
  the existing Evidence Locker store as a normal evidence item. No new table
  or schema is introduced for this.
- Saved reviews continue to reuse existing `Analysis` and manual-asset
  factories.
- Do not pass broad triage prompts into intake chat history as if they were
  already verified thesis input. The carried-forward transcript note is
  explicitly unverified and must never auto-fill or auto-confirm a field.
- Do not call any extraction/summarization model on the Explore transcript.
  Carry it forward as-is.
- Do not build pasted/uploaded-document metric extraction in this milestone.
- Do not change which manual-asset fields are required.
- Do not add reminder/notification scheduling beyond the existing weekly
  review cadence.
- Existing Agenda, Library, Evidence Locker, Decision Ledger, export/import,
  and normalization behavior remain the storage backbone for saved records.

Implementation-facing UX constraints:

- there must be one canonical settings entry in the main workflow hierarchy
- startup/private creation must be routed by user intent, not raw system mode
- the visible review lifecycle must collapse to one primary state label at a
  time
- unsupported requests must surface a recovery action, not a dead end
- sandbox vs. saved state must be visually distinguishable at a glance

## Implementation Slices

1. Update the M7 packet and roadmap/status docs to reflect the everyday-user
   front-door scope.
2. Keep deterministic triage coverage for casual, broad-screen, and
   direct-asset prompts.
3. Simplify workspace hierarchy:
   - Home as front door
   - Explore as the only broad-discovery entry
   - Settings as utility-only
4. Unify copy and naming across Agenda, Triage, Library, and saved reviews.
5. Simplify review lifecycle language into one primary plain-language state
   model.
6. Simplify startup/private entry so the user chooses by intent and available
   information, not by system architecture.
7. Add confirmation and recovery states for watchlist saves, review creation,
   and blocked requests, using the recovery path mapping as the source of
   truth for copy.
8. Add exploration carry-forward: on `Start review`, write the raw transcript
   into the Evidence Locker as an unverified note.
9. Add the simple two-mode fact-check/conversational screen swap, including
   the mode label and the edit-to-recheck behavior.
10. Add sandbox-vs-saved visual distinction (banner/label treatment).
11. Run global gates and browser-check the simplified flows.

## Verification

Automated tests:

- casual prompts return no candidates and no persistence payload
- broad Indonesian-equity prompts return investigation candidates
- direct ticker prompts return one explicit review-start candidate
- broad prompts never create saved records without explicit user action
- `Start review` writes exactly one unverified Evidence Locker note containing
  the raw transcript; `Save to watchlist` writes none
- the carried-forward note never sets or confirms any review field

Browser checks:

- `Home` is the clear default surface
- `Explore an idea` opens triage and does not create a Library record
- Settings is accessible as a utility action and does not appear as a
  competing Home workflow destination
- `hi there` returns no candidates and no saved record
- `any Indonesian stocks worth digging into?` returns candidates without
  creating a saved analysis
- `Start review` creates and opens a saved review with clear confirmation,
  and the Evidence Locker shows the imported, unverified transcript note
- `Save to watchlist` creates a saved draft with visible confirmation and a
  clear next step, and does not create a transcript note
- stock review starts in structured fact-checking mode, not generic chat mode,
  with a visible mode label
- editing a confirmed fact switches the screen back to fact-checking mode
- startup/private entry does not require the user to understand
  engine-vs-manual architecture before starting
- blocked/unsupported review requests provide a recovery path rather than a
  refusal-only message, matching the recovery path mapping
- the header never shows competing lifecycle labels that force the user to
  reconcile multiple states
- Explore always shows a visible "temporary/not saved" indicator; saved
  reviews and watchlist entries always show a visible "saved" indicator

Retained evidence:

- Existing M7 evidence remains valid for non-persistent triage behavior.
- Updated browser QA should retain a new report path once the everyday-user
  simplification pass is implemented.

Acceptance criteria:

- Broad questions never mutate workspace state.
- Casual text never triggers intake, research, confirm cards, or evidence
  candidates.
- The user can always tell whether they are exploring or working in a saved
  review.
- The user can always tell whether an action saved something.
- Saved reviews are still created only through explicit user actions.
- Startup/private entry does not force everyday users to reason about
  internal system architecture.
- Saved reviews still flow into Agenda, Library, Evidence Locker, Decision
  Ledger, and review cadence.
- M1/M3 locking discipline remains intact.
- Exploration notes carried into a review are clearly unverified and never
  silently treated as confirmed facts.
- No required manual-asset field has been made optional.
- No new notification, reminder, or document-extraction capability has been
  introduced.

## Assumptions And Deferrals

- V1 triage remains deterministic and local so the workflow can be proven
  without a new provider contract.
- Advanced IC rigor remains part of the product, but the default UX should use
  plain language and simpler entry-point structure.
- Everyday-user simplification in M7 is a workflow and language milestone,
  not a backend or data-connector milestone.
- Deeper compare workflows, source fetching, and scoring remain later work
  after the front-door and clarity issues are resolved.
- Deferred to a later milestone, pending product decision: automated metric
  extraction from pasted/uploaded documents, a full persistent split-screen
  fact-check workspace, and any loosening of required manual-asset fields.
