# Milestone 7 Specification: Guided Exploration Front Door

## Summary

M7 defines the everyday-user front door for temporary guided exploration before
saved review creation.

This milestone is no longer only a persistence-guard and naming pass. It must
help the user think through broad, private, and business ideas before the app
asks them to save a review, manage cadence, or enter a manual asset workflow.

The outcome is a simple-by-default exploration desk:

- `Explore an idea` remains temporary by default.
- broad/private/business prompts return guided exploration, not just candidate
  cards
- selecting one exploration direction stays temporary and deepens the thinking
- loading, resolved, and unavailable states are visibly distinct
- a saved review is created only after the user has received enough decision
  guidance and explicitly chooses to save the idea
- `ConfirmCard` appears only after explicit user action

Non-goals:

- do not add a new top-level triage table, Dexie version bump, or backup format
- do not turn broad exploration into automatic persistence
- do not weaken M1 cited-fact confirmation or M3 locking discipline
- do not add recommendation, notification, or reminder logic
- do not add automated private-company or alternative-asset data feeds

## Product And UX Contract

### Canonical Workspace Hierarchy

- `Home` is the default surface for saved work and next actions.
- `Explore an idea` is the temporary front door for broad curiosity, messy
  prompts, and early investment thinking.
- `Library` is for saved work, not first-run exploration.
- `Settings` is utility-only and must not compete with `Home` or `Explore an
  idea`.

### Explore Intent

- `Explore an idea` must help the user answer:
  - why might this opportunity be interesting
  - what economics or drivers matter
  - what could make it fail
  - what questions change the investment answer
  - which direction deserves deeper follow-up
- It must not move the user into saved-review management before delivering that
  value.
- It remains temporary by default and must never silently create a saved record.

### Explore State Model

`Explore an idea` has an explicit state model:

- `idle`
- `loading`
- `resolved_temporary`
- `unavailable`

Rules:

- loading must show loading, not a final-looking unavailable/result panel
- unavailable appears only when the request is actually resolved as unavailable
- resolved temporary must always show that the content is still temporary and
  not saved

### Explore Result Contract

For broad/private/business prompts, a valid temporary exploration result must
include:

- a plain-language summary
- 2-4 exploration directions when the idea is still broad
- for each direction:
  - `title`
  - `thesisAngle`
  - `whyItCouldWork`
  - `mainRisks`
  - `nextQuestions`

The result must help the user think, not just choose storage actions.

### Direction-Pick Contract

- choosing one temporary direction must remain temporary
- the app must deepen that direction inside Explore before offering saved-review
  commitment
- `Start review` must not be the primary next step immediately after first
  direction selection
- deeper temporary exploration should continue to sharpen:
  - what makes the direction attractive
  - what could break it
  - what evidence matters
  - what unknowns determine whether it deserves a saved review

### Candidate And Save Actions

- `Compare` and `Dismiss` remain temporary Explore actions
- `Save to watchlist` remains explicit and lightweight
- `Start review` becomes the transition from matured temporary exploration into
  a saved review kickoff
- a direction pick is not a save event

### Saved-Review Handoff

When the user explicitly starts a review from matured exploration:

- create a saved review kickoff state, not an empty or generic detail view
- carry forward:
  - the raw Explore prompt as one unverified Evidence Locker transcript item
  - the selected exploration direction's thesis framing
  - the selected direction's open questions
  - the selected direction's main risks
- do not auto-lock figures, stock fields, or decision state from Explore output
- do not insert AI-generated exploration copy into `chat`

### Saved Review State Model

Saved reviews created from Explore must use an explicit visible mode:

- `kickoff`
- `fact_check`
- `review`

Rules:

- `kickoff` shows what was carried forward and what the user should do next
- `fact_check` begins only after explicit user action
- `review` begins only after the required fact-check flow is complete

### Fact-Check Trigger Contract

- `ConfirmCard` must appear only after explicit user action
- valid triggers:
  - clicking `Check the facts`
  - submitting concrete notes, ticker, links, or evidence in the composer
- invalid trigger:
  - passive screen conditions alone

### Manual And Private Review Routing

- broad/private/business prompts begin in temporary Explore
- manual/private saved reviews are not the first answer to a broad exploratory
  question
- if the user eventually saves a private/manual idea, the first saved state
  must be a kickoff aligned with the chosen exploration direction, not the old
  generic manual recovery surface

### Unsupported And Unhelpful States

- unsupported or unavailable states must offer one concrete next action
- manual/private recovery actions must answer the user's next investment
  question, not only expose workspace-management controls
- recovery UI must not pretend to resolve the core exploration question if it
  only offers storage/admin actions

## Engineering Contract

### Explore Output Shape

Add a deterministic contract for broad/private/business exploration output:

```ts
interface ExploreDirection {
  title: string;
  thesisAngle: string;
  whyItCouldWork: string[];
  mainRisks: string[];
  nextQuestions: string[];
}

interface ExploreResult {
  summary: string;
  directions: ExploreDirection[];
}
```

The inspector must validate:

- summary present
- 2-4 directions for broad prompts when possible
- each direction has all required fields
- invalid or incomplete directions are dropped
- if no valid result survives inspection, return `unavailable` rather than fake
  fallback content

### Explore Interaction Contract

- first broad prompt -> temporary exploration result
- pick one direction -> deeper temporary exploration result
- explicit save action -> saved review kickoff

No implicit persistence and no direct jump from first direction pick into saved
review.

### Persistence And Carry-Forward Rules

- do not add a new persisted triage table
- reuse existing `Analysis` storage
- save the raw prompt as one `Imported from Exploration` evidence item
- allow saved-review kickoff seeding from the chosen direction into thesis
  memory/open questions/risk framing
- keep all carried-forward exploration content unverified until fact-checking
- do not write exploration output into `chat`

### Saved Review Mode Contract

Add an explicit saved-review mode contract for Explore-created reviews:

- `kickoff`
- `fact_check`
- `review`

This can be persisted minimally if needed for reload continuity.

### Loading And Availability Rules

- loading must be explicitly represented in UI state
- unavailable must be a terminal resolved state, not a temporary placeholder
- the UI must not render a terminal-looking unavailable panel while the request
  is still in progress

## Implementation Slices

1. Revise the M7 packet and related strategy/docs to redefine Explore as guided
   temporary reasoning before saved review.
2. Add explicit Explore UI states for idle, loading, resolved temporary, and
   unavailable.
3. Upgrade broad/private/business exploration output from shallow candidate
   cards to structured guided exploration with summary, thesis angle, why it
   could work, risks, and next questions.
4. Keep direction picks temporary and add deeper in-Explore follow-up instead
   of immediate saved review creation.
5. Change `Start review` to create a saved kickoff state only after deeper
   exploration and explicit save intent.
6. Enforce the explicit saved-review mode contract and explicit `ConfirmCard`
   trigger behavior.
7. Add browser and regression coverage for loading, guided exploration, deeper
   temporary exploration, and deferred save behavior.

## Verification

Automated tests:

- broad/private prompts validate into the new `ExploreResult` structure
- invalid exploration output is rejected without fake fallback
- loading and unavailable state logic stay distinct
- first direction pick does not create a saved review
- `Start review` is available only after deeper temporary exploration
- saved-review kickoff seeds summary, open questions, and risks from the chosen
  direction
- raw prompt evidence still persists exactly once
- exploration output does not enter `chat`
- `ConfirmCard` appears only after explicit user trigger

Browser checks:

- `private laundry business` returns useful guided exploration rather than only
  storage/review actions
- selecting one exploration direction stays temporary and deepens the reasoning
- no saved review is created until explicit save action
- `AI infrastructure ideas?` returns decision-shaping distinctions, not only
  generic categories
- loading is visibly different from unavailable
- unavailable appears only after resolution
- a saved review from matured exploration opens in kickoff mode, not a blank or
  generic surface
- `Check the facts` and composer submit are the only ways to open
  `ConfirmCard`

Acceptance criteria:

- broad/private/business exploration helps the user think before asking them to
  manage a review
- users can always tell whether they are still exploring or working in saved
  state
- selecting one temporary direction is not a save event
- no saved review is created until explicit user action
- manual/private ideas do not jump straight into a generic saved-manual-review
  surface after first direction selection

## Assumptions And Deferrals

- This pass corrects the exploration-to-review workflow and does not introduce
  automated private-asset data feeds.
- Explore remains non-persistent by default.
- Saved manual/private reviews remain the place for thesis memory, evidence,
  valuation context, cadence, and decision tracking after explicit commitment.
- Recommendation engines, reminder systems, and document-extraction workflows
  remain deferred.
