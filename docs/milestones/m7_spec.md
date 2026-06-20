# Milestone 7 Specification: IC Chair Triage + Everyday-User Front Door

## Summary

M7 defines the workspace intent gate and the everyday-user front door for the
AI Investment Committee.

This simple pass keeps the verified M7 seams, removes internal-facing language,
and makes the saved-vs-temporary workflow obvious without adding new schema,
provider logic, reminder features, or a second workspace architecture.

The outcome is a simple-by-default decision desk:

- `Home` remains the default surface for saved work and next actions.
- `Explore an idea` is the only broad-discovery entry point.
- Saved reviews are still created only through explicit user action.
- `Explore an idea` always reads as temporary and not saved.
- Saved reviews and watchlist entries always read as saved.
- `Start review` carries forward only the raw Explore prompt as one unverified
  Evidence Locker note.

Non-goals:

- Do not add a new top-level table, Dexie version bump, or backup format.
- Do not add provider-side recommendation, notification, or scheduling logic.
- Do not build a new fact engine, split-screen workspace, or document
  extraction flow.
- Do not change required manual/private-asset fields.
- Do not weaken M1 thesis confirmation or M3 cited-fact locking.

## Product And UX Contract

### Canonical Workspace Hierarchy

- `Home` is the default front door.
- `Explore an idea` is the only broad-discovery destination.
- `Library` is for browsing saved work, not first-run guidance.
- `Settings` is utility-only and must not compete with `Home` or
  `Explore an idea`.

### Canonical User-Facing Naming

Use one plain-language naming system across Agenda, Explore, Library, and saved
reviews:

- `Explore an idea`
- `Start review`
- `Save to watchlist`
- `Check the facts`
- `Ready for review`
- `Decision made`

Remove competing user-visible copy such as:

- `Start case`
- `Open investment review`
- `case file`
- `figures locked`
- `decision logged`

### Triage And Save Contract

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

### Temporary Vs Saved Cues

- `Explore an idea` must show a persistent temporary/not-saved indicator.
- `Start review` must show a saved confirmation, where the record went, and the
  next action.
- `Save to watchlist` must show a saved confirmation, where the record went,
  and the next action.
- Saved reviews and watchlist entries must keep a visible saved-state cue after
  the confirmation moment, not only in a toast.

### Exploration Carry-Forward

On `Start review` only, create one Evidence Locker item from the raw Explore
prompt text.

- Save it as a normal `EvidenceItem` in the existing evidence store.
- Use:
  - `title: "Imported from Exploration"`
  - `type: "transcript"`
  - `relation: "unresolved"`
  - `reliability: "user_provided"`
  - `note: <raw prompt>`
- This carried-forward note is unverified and must not auto-fill or confirm any
  thesis field, stock field, chat history, or decision state.
- `Save to watchlist` does not create carry-forward evidence.
- Do not save triage-generated summary text, chair notes, or candidate cards in
  this pass.

### Review Surface State Model

The top-level saved-review lifecycle should show one primary plain-language
state at a time:

- `Needs fact check`
- `Ready for review`
- `Decision made`

Supporting indicators such as field-level provenance or lock markers may remain,
but they must be secondary and must not compete with the primary header state.

### Fact-Check Framing

- Preserve the existing intake flow and `ConfirmCard` seam as the fact-checking
  mechanism for this milestone.
- Pre-verification saved stock reviews should read as task-oriented fact
  checking, not generic chat:
  - intake empty state
  - composer placeholder
  - confirm-card title
  - disabled review copy
- After required facts are confirmed and the grounded review is available, the
  top-level state changes to `Ready for review`.
- Editing or reopening confirmation for previously locked figures returns the
  visible mode to `Needs fact check`.

### Startup And Private-Asset Routing

- Keep the current intent-first creation flow.
- For startup/private entry, add a plain-language sub-choice based on what the
  user has:
  - `I have structured numbers` routes to the existing engine-backed
    startup/conventional path
  - `I have notes, a deck, or incomplete info` routes to the current
    manual/private path
- Do not expose engine/manual jargon as the first decision.
- Keep all existing required manual/private fields unchanged.

### Unsupported-Request Recovery

Unsupported requests inside saved reviews must not end in refusal-only copy.
They must offer one concrete next action. This pass implements deterministic UI
recovery, not provider logic.

Recovery examples for this milestone:

- Stock buy/sell recommendation requests inside a saved stock review route the
  user back to `Explore an idea`.
- Manual/private review surfaces offer concrete recovery actions such as review
  cadence or evidence capture instead of dead ends.

## Engineering Contract

- Keep `deriveIdeaTriage()` pure and non-persistent.
- Do not add a new persisted triage table or Dexie version bump.
- Do not change backup/import shape beyond reusing existing `Analysis.evidence`.
- Add one small helper at the workspace/domain seam to build the carry-forward
  evidence item from the Explore prompt so the behavior is unit-testable.
- Saved reviews continue to reuse existing `Analysis` factories and the current
  `AnalysisView` / `ManualAnalysisView` split.
- Do not write carry-forward content into intake chat history, thesis fields,
  stock fields, or decision history.
- `Save to watchlist` must remain lightweight and must not create carry-forward
  evidence.
- Existing Agenda, Library, Evidence Locker, Decision Ledger, normalization, and
  export/import behavior remain the storage backbone.

## Implementation Slices

1. Fold the agreed simple pass into `docs/milestones/m7_spec.md` and sync the
   roadmap/status docs.
2. Unify plain-language naming across Agenda, Explore, Library, and saved
   reviews.
3. Add persistent temporary-vs-saved cues and saved confirmations.
4. Carry forward only the raw Explore prompt on `Start review`.
5. Reframe the saved stock-review surface around `Check the facts` using the
   current intake and confirm seams.
6. Refine startup/private routing copy so users choose by the information they
   have, not by internal architecture.
7. Add deterministic recovery actions for unsupported requests in saved reviews.
8. Run global gates, refresh M7 browser QA, retain the new evidence, and close
   the docs only after verification passes.

## Verification

Automated tests:

- casual prompts return no candidates and no persistence payload
- `deriveIdeaTriage()` remains non-persistent for casual and broad prompts
- the carry-forward helper returns one `transcript` evidence item with the raw
  prompt only
- `Save to watchlist` creates no carry-forward evidence
- carry-forward evidence never mutates thesis fields, stock fields, or decision
  history
- creating a review from triage preserves the imported evidence item through
  save/load
- backup export/import preserves the imported evidence item unchanged
- legacy analyses without imported exploration notes still normalize unchanged

Browser checks:

- `Explore an idea` shows a persistent temporary/not-saved indicator
- `Start review` opens a saved review, shows saved confirmation, and Evidence
  Locker contains `Imported from Exploration`
- `Save to watchlist` shows saved confirmation and does not create imported
  evidence
- saved stock review starts in `Needs fact check` mode with guided copy
- after confirmation, the review transitions to `Ready for review`
- edit or recheck paths return the visible mode to `Needs fact check`
- startup/private creation uses intent-first language and does not expose
  engine/manual jargon first
- unsupported requests in saved reviews show a recovery action instead of a
  dead end

Acceptance criteria:

- broad questions never mutate workspace state
- casual text never triggers intake, confirm cards, or saved review creation
- the user can always tell whether they are exploring or working in a saved
  review
- the user can always tell whether an action saved something
- saved reviews are still created only through explicit user actions
- exploration carry-forward means prompt-only, not prompt plus triage-generated
  summary output
- existing M1/M3 verification and locking discipline remain intact

## Assumptions And Deferrals

- This pass is workflow/copy/state simplification only.
- V1 triage remains deterministic and local.
- Existing `ConfirmCard` remains the fact-checking mechanism for this milestone;
  no new checklist engine is introduced.
- Manual/private required fields remain unchanged from current product rules.
- Automated document extraction, reminder scheduling, provider-side unsupported
  request handling, and a split-screen redesign are deferred.
