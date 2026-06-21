# CODE ANATOMY - app/

> Implementation map for the active product in `app/`.
> Product direction lives in `../PRODUCT_STRATEGY.md`.
> Roadmap truth lives in `../BUILD_PLAN.md` and `../docs/milestones/`.
> Last updated: 2026-06-21

---

## What This Is

`app/` is the active local-first AI Investment Committee workspace.

The product no longer centers on the old single-asset cockpit. The verified
default flow now starts from saved-work triage:

- `Home` / Agenda for saved work and next actions
- `Explore an idea` for temporary broad/private/business exploration
- saved review kickoff only after explicit save
- fact check before grounded review

The core product promise is now split cleanly:

- temporary exploration helps the user think before saving anything
- saved reviews hold thesis memory, evidence, valuation context, and decisions
- deterministic metrics remain the only lockable numeric grounding

Broad/private/business prompts stay temporary at first. The first direction pick
also stays temporary and deepens the reasoning. Saving becomes explicit only
after that deeper exploration stage. Explore-originated manual/private ideas now
open in saved kickoff, not the old generic manual recovery surface. `ConfirmCard`
remains explicitly user-triggered through `Check the facts` or concrete fact
submission.

Latest verified isolated QA for this refreshed flow:

- `../issues/qa/2026-06-21T07-59-57-668Z/report.json`

---

## Current Product Surfaces

- `AgendaView`: default saved-work dashboard and next-action queue
- `IdeaTriageView`: temporary Explore surface for broad prompts and direct asset
  starts
- `AnalysisView`: saved review surface with `kickoff -> fact_check -> review`
- `PortfolioView`: saved portfolio composition and cross-asset review
- `Library`: saved records browser
- `Settings`: BYOK provider setup plus backup import/export

The app stores work locally in IndexedDB via Dexie and keeps provider settings
in browser storage. AI calls use user-provided keys.

---

## Architecture In One Sentence

The app is a local-first Next.js workspace where temporary exploration stays
unsaved until explicit commitment, while saved analyses persist thesis memory,
evidence, decisions, and deterministic valuation state that grounds later AI
review.

---

## File Map

```text
app/
|-- src/
|   |-- app/
|   |   |-- page.tsx                  "/" route; renders <Workspace />
|   |   |-- layout.tsx                HTML shell, fonts, metadata
|   |   |-- globals.css               base styles and tokens
|   |   |-- workspace.css             workspace and component layout rules
|   |   `-- api/
|   |       |-- web-search/route.ts   Tavily proxy for search fallback
|   |       `-- web-fetch/route.ts    URL fetch fallback
|   |-- components/
|   |   |-- Workspace.tsx             top-level router, persistence wiring, triage save boundary
|   |   |-- AgendaView.tsx            saved-work home and ranked agenda queue
|   |   |-- IdeaTriageView.tsx        temporary Explore flow and deeper exploration UI
|   |   |-- AnalysisView.tsx          saved review lifecycle, Evidence Locker, fact check, grounded review
|   |   |-- PortfolioView.tsx         portfolio thesis review and cross-asset chat
|   |   |-- Library.tsx               saved analyses/portfolios browser
|   |   |-- Settings.tsx              provider config and backup UI
|   |   |-- DecisionLedger.tsx        append-only decision workflow
|   |   `-- charts.tsx                deterministic valuation charts
|   |-- data/
|   |   |-- fields.ts                 stock engine field metadata and formatting
|   |   `-- presets.ts                seeded engine presets and blank params
|   `-- lib/
|       |-- ai/
|       |   |-- registry.ts           provider lookup
|       |   |-- types.ts              shared provider interface
|       |   |-- analyze.ts            intake, debate, review orchestration
|       |   |-- discovery.ts          AI idea-discovery finalization
|       |   |-- prompts.ts            debate, intake, chat, and discovery prompts
|       |   |-- schemas.ts            structured-output contracts
|       |   |-- grounding.ts          numeric grounding lint rules
|       |   |-- intakeContext.ts      intake web/link evidence helpers
|       |   |-- report.ts             written review report builder
|       |   `-- providers/            Anthropic, OpenAI, Gemini adapters
|       |-- domain/
|       |   |-- types.ts              Analysis, PortfolioAnalysis, evidence, decisions, reviewMode
|       |   |-- ic.ts                 IC defaults, normalization, labels, review helpers
|       |   |-- triage.ts             Explore contracts, deterministic inspection, carry-forward seeding
|       |   |-- evidence.ts           Evidence Locker helpers
|       |   |-- decisions.ts          Decision Ledger helpers
|       |   |-- manualAssets.ts       manual/private asset guards and prompts
|       |   `-- stockFields.ts        stock provenance helpers
|       |-- finance/
|       |   |-- compute.ts            single-analysis deterministic metrics
|       |   |-- portfolio.ts          portfolio deterministic metrics
|       |   |-- equities.ts           P/E, DCF, IRR
|       |   |-- ventures.ts           LTV, CAC, runway
|       |   `-- operating.ts          break-even point
|       |-- qa/
|       |   `-- fixtures/             browser QA workspace seed data
|       |-- repo/
|       |   |-- db.ts                 Dexie schema
|       |   |-- index.ts              repository and normalize-on-read seam
|       |   `-- backup.ts             import/export serialization
|       |-- storage/index.ts          local settings storage
|       `-- ui/inspectorWidth.ts      persisted inspector width
|-- public/pdf.worker.min.mjs
`-- package.json
```

---

## Main Flows

### Flow 1 - Saved Work Home

```text
Workspace
  -> default active view = Agenda
  -> listAnalyses() + listPortfolios()
  -> AgendaView ranks saved work from persisted thesis/review/evidence/decision state
```

`AgendaView` is the default landing surface for saved work. `Library` remains a
browser for records, not the primary entry point for early exploration.

### Flow 2 - Temporary Explore

```text
User opens Explore an idea
      |
      v
IdeaTriageView
      |
      |-- deriveIdeaTriage(prompt)
      |     -> casual
      |     -> direct_asset
      |     -> broad_screen (requires discovery)
      |
      |-- if broad/private/business:
      |     viewState = loading
      |     provider.discoverIdeas()
      |     inspectIdeaDiscoveryOutput()
      |
      v
resolved_temporary | unavailable
```

Important current rules:

- view state is explicit: `idle | loading | resolved_temporary | unavailable`
- loading is not rendered as terminal unavailable
- invalid AI output resolves to unavailable instead of fake fallback content
- nothing is saved during temporary exploration

### Flow 3 - First Direction Pick And Deeper Exploration

```text
Temporary exploration result
      |
      v
User picks one direction
      |
      v
provider.deepenIdea()
      |
      v
deeper temporary exploration
      |
      +-> Start review
      `-> Save to watchlist
```

The first direction pick is not a save event. It deepens the reasoning first.
Only the deeper stage unlocks explicit save actions.

### Flow 4 - Explore To Saved Review Boundary

```text
Workspace.buildCaseFromTriage()
      |
      |-- createAnalysis() for public equity
      |-- createManualAnalysis() for manual/private assets
      |-- buildExplorationCarryForwardEvidence(prompt)
      |-- seedICStateFromExploration() or seedICStateFromTriageCandidate()
      `-- set reviewMode
            broad Explore save -> kickoff
            direct asset start -> fact_check
```

Current carry-forward behavior:

- raw Explore prompt becomes one `Imported from Exploration` evidence item
- selected direction seeds thesis summary, risks, and open questions
- carried-forward content remains unverified
- exploration output does not get written into `chat`

### Flow 5 - Saved Review Lifecycle

```text
Analysis.reviewMode
  kickoff
    -> saved kickoff panel
    -> explicit Check the facts
  fact_check
    -> composer / evidence intake
    -> ConfirmCard only after explicit trigger
  review
    -> grounded debate, follow-up chat, decision workflow
```

`AnalysisView` derives a visible saved-review lifecycle:

- `kickoff`: explains what was carried forward and what to do next
- `fact_check`: intake and confirmation stage
- `review`: grounded saved analysis after fact-checking / debate

This is the seam that replaced the older prompt-only or generic manual recovery
handoff.

### Flow 6 - Fact Check And Deterministic Review

```text
User clicks Check the facts
or submits concrete notes/ticker/links
      |
      v
submitIntake()
      |
      |-- optional web/link evidence gathering
      |-- provider.runIntake()
      `-- pendingIntake
              |
              v
          ConfirmCard
              |
              v
          confirmIntake()
              |
              |-- save thesis memory
              |-- save stock provenance when relevant
              |-- computeMetrics()
              `-- optional runAnalysis()
```

`ConfirmCard` is intentionally explicit. It is not opened by passive screen
conditions alone.

### Flow 7 - Manual / Private Saved Work

Manual/private assets use the same `Analysis` object with
`valuationMode: "manual"`.

Rules that matter:

- broad/private/business prompts start in Explore, not manual detail
- Explore-originated manual/private saves start in `kickoff`
- manual assets reuse thesis memory, Evidence Locker, review cadence, and
  Decision Ledger
- manual assets do not pretend to have deterministic valuation, stock
  provenance, debate, expert review, or grounded chat

---

## Core Data Model

`Analysis` remains the main record, but it now carries both saved-review
lifecycle state and the asset-agnostic IC schema.

Key distinctions:

- `vertical`: deterministic engine route for `stocks | startups | conventional`
- `assetType`: product classification across public and manual/private assets
- `valuationMode`: `"engine" | "manual"`
- `reviewMode`: `"kickoff" | "fact_check" | null`

Important saved state on `Analysis`:

- `ic.thesis`: summary, assumptions, thesis breakers, watch items, valuation
  assumptions, catalysts, open questions, conviction
- `ic.review`: cadence, last reviewed, next review due
- `evidence[]`: first-class Evidence Locker items
- `stockFields[]`: provenance for lockable stock facts and candidates
- `decisionHistory[]`: append-only IC actions and reviews

`PortfolioAnalysis` stays separate and derives its metrics from referenced
analyses plus explicit capital inputs.

---

## AI System

Provider adapters expose one shared interface across Anthropic, OpenAI, and
Gemini.

Current important seams:

- `runIntake()` for fact-check intake drafts
- `runAnalysis()` for grounded saved review
- `streamChat()` for grounded follow-up after review exists
- `discoverIdeas()` for temporary broad exploration
- `deepenIdea()` for the second temporary reasoning stage
- `runPortfolioAnalysis()` and `streamPortfolioChat()` for portfolio work

The app keeps a hard boundary between:

- temporary exploration output
- user-confirmed saved-review state
- deterministic lockable figures

---

## Persistence

### IndexedDB / Dexie

Repository code under `src/lib/repo/` is the local source of truth.

Tables:

- `analyses`
- `portfolios`
- `folders`
- `blobs`

Normalization on read keeps older records compatible with newer fields such as:

- `assetType`
- `manualMeta`
- `evidence`
- `decisionHistory`
- `reviewMode`

### localStorage

`src/lib/storage/index.ts` stores provider settings and API keys locally in the
browser.

---

## Where To Edit

| File | Touch when... |
|---|---|
| `src/components/Workspace.tsx` | changing default routing, triage save boundary, notices, QA bootstrap |
| `src/components/AgendaView.tsx` | changing home/default saved-work ranking or agenda copy |
| `src/components/IdeaTriageView.tsx` | changing temporary Explore states, deeper exploration, or save unlock behavior |
| `src/components/AnalysisView.tsx` | changing kickoff/fact-check/review lifecycle, ConfirmCard triggers, Evidence Locker, or saved-review chat |
| `src/components/PortfolioView.tsx` | changing portfolio review behavior |
| `src/components/Library.tsx` | changing saved-record browsing/filtering |
| `src/lib/domain/triage.ts` | changing deterministic triage, exploration inspection, or carry-forward seeding |
| `src/lib/domain/ic.ts` | changing IC defaults or normalization |
| `src/lib/domain/evidence.ts` | changing Evidence Locker helpers |
| `src/lib/domain/decisions.ts` | changing Decision Ledger rules |
| `src/lib/domain/manualAssets.ts` | changing manual/private asset guardrails |
| `src/lib/ai/discovery.ts` | changing AI exploration parsing/finalization |
| `src/lib/ai/analyze.ts` | changing intake, debate, or review orchestration |
| `src/lib/repo/index.ts` | changing persistence or back-compat normalization |
| `src/lib/qa/fixtures/*` | changing browser QA seed coverage |

---

## Design Decisions

**Explore is temporary by default.**
Broad/private/business prompts do not create saved records until the user
explicitly starts a review or saves to watchlist.

**Deeper exploration comes before persistence.**
The first direction pick sharpens the reasoning. It does not jump straight into
saved review.

**Saved review has an explicit lifecycle.**
`kickoff`, `fact_check`, and grounded review are distinct states because the app
must show when work is still unverified.

**ConfirmCard is explicit.**
Fact checking starts from user action, not from passive screen conditions.

**Manual/private assets are saved-work surfaces, not exploration-first answers.**
Explore handles early-stage thinking. Manual detail handles durable workspace
management after commitment.

**Deterministic metrics remain the numeric authority.**
The model can interpret saved facts, but it cannot invent lockable figures.

**Normalize on read instead of frequent schema churn.**
Repo helpers absorb shape changes so the Dexie store stays stable.

---

## Current Verified Status

Working and verified in the current build:

- Agenda as the default saved-work home
- temporary Explore flow with explicit loading vs unavailable state
- AI-guided broad exploration with 2-4 structured directions when available
- deeper temporary exploration after the first direction pick
- explicit save boundary after deeper exploration
- Explore-originated public and manual/private kickoff handoff
- user-triggered fact-check flow and `ConfirmCard`
- thesis memory, Evidence Locker, review cadence, IC Agenda, Decision Ledger
- deterministic stock valuation and stock-field provenance
- portfolio composition and cross-asset review

Still deferred:

- auth, sync, cloud backup, scheduled monitoring
- in-app browser helper repair
- M8 BYOK trust / local-provider setup work
