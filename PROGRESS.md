# Progress Tracker - AI Investment Workspace

**Goal:** Turn the investment-cockpit concept into a production-ready BYOK AI
Investment Committee workspace with saved analyses, thesis memory, evidence,
history, chat, portfolio composition, and decision review.

- **Repo:** github.com/pojurb/demo1
- **New product:** `app/` -> Next.js 16 + TypeScript + Dexie
- **Roadmap source of truth:** `BUILD_PLAN.md`
- **Data model:** `DATA_MODEL.md`
- **Documentation source of truth:** `docs/process/DOC_SOT.md`

---

## Active Handoff - 2026-06-21

This session implemented and verified the guided-exploration refresh for the
Explore -> saved review workflow.

Key shipped behavior:

- broad/private/business prompts now stay temporary through two stages:
  initial guided exploration, then deeper temporary exploration after the first
  direction pick
- Explore now shows explicit loading vs unavailable states instead of using a
  terminal-looking placeholder while work is still in progress
- the first direction pick no longer creates a saved review
- `Start review` and `Save to watchlist` appear only after deeper temporary
  exploration
- saved reviews created from Explore now seed kickoff context from the chosen
  direction and preserve exactly one `Imported from Exploration` evidence item
- Explore-originated manual/private saves open in kickoff mode first and no
  longer fall into the old generic manual recovery surface
- `ConfirmCard` remains explicitly user-triggered; passive screen state alone
  does not open it

Implementation touched the Explore domain/provider contract, the `IdeaTriage`
UI, `Workspace` save boundary logic, manual/private kickoff routing in
`AnalysisView`, QA mock discovery, and the isolated M7 browser scenario.

Verified milestone state:

| Milestone | State | Latest Evidence |
|---|---|---|
| M1 - IC Primitives + Frictionless Thesis Intake | Implemented, verified | `issues/qa/2026-06-18T04-15-23-825Z/report.json` |
| M2 - Manual Private Asset IC Entry | Implemented, verified; Explore-originated kickoff refresh shipped | `issues/qa/2026-06-17T05-02-10-481Z/report.json`, full sweep `issues/qa/2026-06-17T08-58-14-514Z/report.json`, and refreshed M7 flow evidence `issues/qa/2026-06-21T07-59-57-668Z/report.json` |
| M3 - Stock Intake Trust + Field Provenance | Implemented, verified | Covered by canonical browser QA and milestone docs |
| M4 - Evidence Locker Primitives | Implemented, verified | Full canonical QA sweep passed on 2026-06-16 |
| M5 - Watchlist IC Agenda + Assumption Monitoring | Implemented, verified | `issues/qa/2026-06-17T08-58-14-514Z/report.json` |
| M6 - Decision Ledger + Review Loop | Implemented, verified | Browser QA, unit tests, lint, and build passed |
| M7 - IC Chair Triage + Everyday-User Front Door | Implemented, verified with guided-exploration refresh | `npm test`, `npm run lint`, `npm run build`, and `node scripts/run.js qa m7` passed on 2026-06-21; evidence at `issues/qa/2026-06-21T07-59-57-668Z/report.json` |

Latest retained verification snapshot:

- `npm test` passed on 2026-06-21: 23 files / 196 tests.
- `npm run lint` passed with pre-existing warnings only:
  - `app/src/app/layout.tsx` custom font warning
  - `app/src/components/charts.tsx` unused `CYAN_STROKE`
  - `app/src/lib/ai/providers/gemini.ts` unused `_drop` and `_enum`
- `npm run build` passed on 2026-06-21.
- Latest full canonical browser QA evidence remains
  `issues/qa/2026-06-18T07-07-18-098Z/report.json` for M1-M6.
- Refreshed isolated M7 browser QA passed:
  `issues/qa/2026-06-21T07-59-57-668Z/report.json`.
- That retained artifact validates:
  - explicit loading vs unavailable Explore state
  - deeper temporary exploration after the first direction pick
  - no saved review creation until explicit save action
  - Explore-originated manual/private kickoff replacing the old generic
    recovery surface

Current tooling note:

- The in-app browser helper remains deferred by decision.
- Browser QA for product work should use `node scripts/run.js qa` and the
  fallback Edge/CDP harness documented in `docs/qa/BROWSER_QA_HARNESS.md`.

Next exact step:

- If the refreshed Explore flow is accepted, update roadmap/docs status only if
  another canonical doc still describes the old M7 follow-up as pending.
- Otherwise continue with the next product milestone or follow-up issue from
  `BUILD_PLAN.md`.

---

## Archive Summary

Earlier phases built the local-first Next.js workspace from the original
single-asset cockpit into the current IC system:

- P0-P6 established the Next.js app, deterministic finance engine, Dexie data
  layer, BYOK AI providers, file/link context, web research fallback, and
  grounded chat/debate.
- P7-P8 added portfolio composition, cross-asset chat, grounding guardrails, and
  the eval harness.
- P9a-P9c completed backup/restore, UI readability/density improvements, and
  deployment handoff/cutover documentation.
- M1-M7 then implemented the current product roadmap: IC thesis memory, manual
  private assets, stock provenance, Evidence Locker, IC Agenda, Decision
  Ledger/review loop, and the M7 everyday-user front door with AI discovery
  plus deterministic inspection.

Durable implementation details live in `BUILD_PLAN.md`, `DATA_MODEL.md`,
`EXECUTION_PLAN.md`, milestone packets under `docs/milestones/`, and retained QA
artifacts under `issues/qa/`.
