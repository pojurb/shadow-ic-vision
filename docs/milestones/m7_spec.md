# Milestone 7 Specification: IC Chair Triage + Intake Intent Gate

## Summary

M7 adds a non-persistent Idea Triage surface before case-file creation. It lets
the user ask broad advisory or screening questions without accidentally creating
an analysis, thesis memory, evidence candidates, or lockable valuation fields.

The outcome is a decision-desk workflow:

- Agenda remains the default IC Chair surface for saved work.
- Idea Triage screens temporary ideas and frames candidates for investigation.
- Case files are created only by explicit `Start case` or `Add to watchlist`
  actions.

Non-goals:

- Do not build a fully automated stock recommendation engine.
- Do not add new market-data connectors, brokerage import, notifications, or
  scheduled monitoring.
- Do not make generic chat the primary workspace.
- Do not weaken M1 thesis confirmation or M3 cited-fact locking.

## Product And UX Contract

- The primary Agenda action is `Investigate idea`, not direct analysis creation.
- Idea Triage is temporary: broad prompts, casual greetings, and screening
  questions do not write to Library or the persisted workspace.
- Triage output frames candidates as investigation candidates, not buy/sell
  recommendations.
- Candidate actions are explicit:
  - `Start case` creates and opens a case file.
  - `Add to watchlist` creates a draft saved record without forcing immediate
    verification.
  - `Compare` and `Dismiss` remain local triage interactions.
- `Confirm before locking` behavior is reframed as `Verify thesis and facts`
  and appears only inside a case file.
- Case files show a clear stage label: draft thesis, needs verification, figures
  locked, or decision logged.
- During draft thesis / verification stages, committee review is disabled until
  thesis/fact verification has occurred.
- Post-lock follow-up remains grounded chat over a case file, not a route for
  hidden state mutation.

Required states:

- Empty triage: explains screen-before-saving behavior.
- Casual prompt: returns no candidates and no saved records.
- Broad screen: returns investigation candidates and next actions.
- Direct asset prompt: returns one explicit case-start candidate.
- Saved candidate: visibly marks that the candidate was added.
- Case file: starts in structured case-building mode, not open-ended chat.

## Engineering Contract

- Add a pure triage derivation helper with deterministic output for v1.
- Do not add a new persisted triage table or Dexie version bump.
- Keep triage results in component state only.
- Case creation reuses the existing `Analysis` / manual asset factories:
  - public-equity candidates create stock engine draft cases
  - non-public/manual candidates create manual asset draft cases
- Do not pass broad triage prompts into intake chat history. If a case is created
  from triage, the prompt may be stored as an open question or local context, but
  it must not cause automatic thesis extraction.
- Existing Agenda, Library, Evidence Locker, Decision Ledger, export/import, and
  normalization behavior remain unchanged for saved records.

## Implementation Slices

1. Add the M7 packet and update roadmap/status documents.
2. Add pure triage helper coverage for casual, broad-screen, and direct-asset
   prompts.
3. Add the Idea Triage workbench and route Agenda's primary CTA into it.
4. Add explicit `Start case` / `Add to watchlist` transitions into existing
   analysis factories.
5. Reframe case-file copy and stage labels so intake is visibly structured
   verification, not hidden chat automation.
6. Run global gates and browser-check the triage-to-case workflow.

## Verification

Automated tests:

- casual prompts return no candidates and no persistence payload
- broad Indonesian-equity prompts return investigation candidates
- direct ticker prompts return one explicit case-start candidate

Browser checks:

- `Investigate idea` opens Idea Triage and does not create a Library record
- `hi there` returns no candidates and no confirm card
- `any Indonesian stocks worth digging into?` returns candidates without
  creating a saved analysis
- `Start case` creates and opens a case file
- `Add to watchlist` creates a saved draft without opening verification
- case file composer says thesis/evidence extraction, not generic analysis chat
- `Verify thesis and facts` appears only after case-file extraction

Retained evidence:

- Isolated browser QA `node scripts/run.js qa m7` passed on 2026-06-18 with
  retained evidence at `issues/qa/2026-06-18T13-53-23-771Z/report.json`

Acceptance criteria:

- Broad questions never mutate workspace state.
- Casual text never triggers intake, research, confirm cards, or evidence
  candidates.
- Case files are created only through explicit candidate actions.
- Saved case files still flow into Agenda, Library, Evidence Locker, Decision
  Ledger, and review cadence.
- M1/M3 locking discipline remains intact.

## Assumptions And Deferrals

- V1 triage is deterministic and local so the workflow can be proven without a
  new provider contract.
- AI-powered triage can be added later if it preserves the same non-persistent
  intent gate.
- Candidate lists are investigation frames, not investment recommendations.
- Deeper compare workflows, source fetching, and scoring belong to later
  milestones after the triage boundary is validated.
